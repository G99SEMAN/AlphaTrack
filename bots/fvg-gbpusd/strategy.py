"""
Strategie: ICT Fair Value Gap (FVG) Retest
Symbol:    GBPUSDp, Timeframe: M15
Session:   London 07:00–10:00 UTC | New York 12:00–15:00 UTC

Einstieg:  BUY/SELL wenn Preis in unberührte FVG-Zone retracet (EMA-Trendfilter)
Ausstieg:  TP am gegenüberliegenden Ende der FVG-Zone | SL außerhalb Zone + Puffer
Risiko:    Feste Lotgröße (Standard: 0.01 Lots)
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scaffold.base_bot import BaseBot

PIP_SIZE = 0.0001  # GBP/USD: 1 Pip = 0.0001 (5-stelliger Broker)


class FVGStrategy(BaseBot):
    """ICT FVG Retest — GBPUSDp M15, London + NY Session."""

    def __init__(self, bot_id: str, name: str, port: int):
        super().__init__(bot_id, name, port)
        self._triggered_fvgs: set = set()

    @property
    def _fvg_seen(self) -> set:
        # Lazy init — BacktestBot nutzt object.__new__() und überspringt __init__
        if not hasattr(self, "_triggered_fvgs"):
            self._triggered_fvgs = set()
        return self._triggered_fvgs

    def get_parameters(self) -> dict:
        strat = self._config.get("strategy", {})
        return {
            "lots":                  float(strat.get("lots", 0.01)),
            "ema_period":            float(strat.get("ema_period", 200)),
            "fvg_max_age_bars":      float(strat.get("fvg_max_age_bars", 20)),
            "sl_buffer_pips":        float(strat.get("sl_buffer_pips", 5)),
            "session_filter":        float(strat.get("session_filter", 1)),
            "min_rr":                float(strat.get("min_rr", 1.0)),
            "tp_extension_mult":     float(strat.get("tp_extension_mult", 2.0)),
        }

    def on_tick(self, candles: list, positions: list) -> dict:
        cfg = self._config.get("strategy", {})

        max_pos = int(cfg.get("max_positions", 1))
        if len(positions) >= max_pos:
            return {"action": "hold", "reason": "Max. 1 Position offen"}

        if len(candles) < 5:
            return {"action": "hold", "reason": "Zu wenig Kerzen"}

        session_on = bool(int(cfg.get("session_filter", 1)))
        if session_on and not self._in_session():
            return {"action": "hold", "reason": "Außerhalb Session (London 07–10 / NY 12–15 UTC)"}

        closes        = [float(c["close"]) for c in candles]
        current_price = closes[-1]

        ema_period = int(cfg.get("ema_period", 200))
        ema        = self._calc_ema(closes, ema_period)

        lots             = float(cfg.get("lots", 0.01))
        sl_buffer_pips   = float(cfg.get("sl_buffer_pips", 5))
        sl_buffer        = sl_buffer_pips * PIP_SIZE
        min_rr           = float(cfg.get("min_rr", 1.0))
        fvg_max_age      = int(cfg.get("fvg_max_age_bars", 20))
        tp_ext_mult      = float(cfg.get("tp_extension_mult", 2.0))

        # FVGs nur aus abgeschlossenen Kerzen ermitteln (aktuelle Kerze ausschließen)
        fvgs = self._detect_fvgs(candles[:-1], fvg_max_age)

        for fvg in fvgs:
            fvg_id   = fvg["id"]
            fvg_type = fvg["type"]
            bottom   = fvg["bottom"]
            top      = fvg["top"]

            if fvg_id in self._fvg_seen:
                continue

            if not (bottom <= current_price <= top):
                continue

            # EMA-Trendfilter: nur mit dem übergeordneten Trend handeln
            if ema is not None:
                if fvg_type == "bullish" and current_price < ema:
                    return {
                        "action": "hold",
                        "reason": f"Trendfilter: BUY blockiert (Preis {current_price:.5f} < EMA{ema_period} {ema:.5f})",
                    }
                if fvg_type == "bearish" and current_price > ema:
                    return {
                        "action": "hold",
                        "reason": f"Trendfilter: SELL blockiert (Preis {current_price:.5f} > EMA{ema_period} {ema:.5f})",
                    }

            zone_size = top - bottom
            if fvg_type == "bullish":
                direction = "buy"
                tp = top + zone_size * tp_ext_mult   # über FVG-Zone hinaus ✓
                sl = bottom - sl_buffer              # unterhalb FVG-Zone ✓
            else:
                direction = "sell"
                tp = bottom - zone_size * tp_ext_mult  # unter FVG-Zone hinaus ✓
                sl = top + sl_buffer                   # oberhalb FVG-Zone ✓

            tp_dist = abs(tp - current_price)
            sl_dist = abs(current_price - sl)

            if sl_dist <= 0 or tp_dist <= 0:
                continue

            rr = tp_dist / sl_dist
            if rr < min_rr:
                continue

            self._fvg_seen.add(fvg_id)
            if len(self._fvg_seen) > 200:
                self._triggered_fvgs = set(list(self._fvg_seen)[-100:])

            arrow  = "↑" if direction == "buy" else "↓"
            reason = (
                f"{arrow} FVG Retest | Zone {bottom:.5f}–{top:.5f} | "
                f"Preis {current_price:.5f} | SL {sl:.5f} | TP {tp:.5f} | RR {rr:.2f}"
            )
            return {
                "action":  direction,
                "lots":    lots,
                "sl":      round(sl, 5),
                "tp":      round(tp, 5),
                "sl_pips": round(sl_dist / PIP_SIZE, 1),
                "tp_pips": round(tp_dist / PIP_SIZE, 1),
                "reason":  reason,
            }

        n_active = len(fvgs)
        ema_info = f" | EMA{ema_period} {ema:.5f}" if ema else ""
        return {
            "action": "hold",
            "reason": f"Kein FVG-Retest | {n_active} FVG(s) aktiv{ema_info} | Preis {current_price:.5f}",
        }

    # -------------------------------------------------------------------------
    # Hilfsmethoden
    # -------------------------------------------------------------------------

    def _detect_fvgs(self, candles: list, max_age: int) -> list:
        """
        Findet alle unberührten FVGs der letzten max_age Kerzen.

        Bullisches FVG:  candles[i].high < candles[i+2].low
        Bärisches FVG:   candles[i].low  > candles[i+2].high
        Eine FVG gilt als mitigiert, sobald eine spätere Kerze innerhalb der Zone schließt.
        """
        fvgs  = []
        n     = len(candles)
        start = max(0, n - max_age - 2)

        for i in range(start, n - 2):
            a      = candles[i]
            c      = candles[i + 2]
            a_high = float(a["high"])
            a_low  = float(a["low"])
            c_high = float(c["high"])
            c_low  = float(c["low"])

            fvg_type = None
            bottom = top = None

            if a_high < c_low:     # Bullisches FVG
                fvg_type = "bullish"
                bottom, top = a_high, c_low
            elif a_low > c_high:   # Bärisches FVG
                fvg_type = "bearish"
                bottom, top = c_high, a_low

            if fvg_type is None:
                continue

            if (top - bottom) < 3 * PIP_SIZE:  # Micro-Gaps ignorieren (<3 Pips)
                continue

            # FVG ist mitigiert, wenn eine spätere Kerze in der Zone schloss
            if any(bottom <= float(candles[j]["close"]) <= top for j in range(i + 3, n)):
                continue

            fvgs.append({
                "id":     (fvg_type, round(bottom, 5), round(top, 5)),
                "type":   fvg_type,
                "bottom": bottom,
                "top":    top,
                "age":    n - 2 - i,
            })

        return fvgs

    def _in_session(self) -> bool:
        """True während London (07–10 UTC) oder New York (12–15 UTC) Session."""
        h = self._now().hour
        return (7 <= h < 10) or (12 <= h < 15)

    def _calc_ema(self, closes: list, period: int) -> float | None:
        if len(closes) < period:
            return None
        k   = 2.0 / (period + 1)
        ema = sum(closes[:period]) / period
        for p in closes[period:]:
            ema = p * k + ema * (1 - k)
        return ema
