"""
Strategie: ICT Fair Value Gap + Liquidity Scalping
Beschreibung:
  Multi-Timeframe Scalping auf Basis von ICT/SMC-Konzepten.
  M5 Fair Value Gap gibt Richtung und Bias (live: konfigurierbar auf H1/H4).
  M1 triggert den Entry: Sweep eines Swings + Break of Structure.
  Break-even nach TP1, TP2 = tieferes Struktur-Level.

Parameter (config.json -> strategy):
  symbol            : Handelssymbol (NDAQ.OQ)
  timeframe         : M1 (Entry-Monitoring, wird von BaseBot gefetcht)
  candles_count     : Anzahl M1-Kerzen (100)
  lots              : Lot-Groesse (0.01)
  max_positions     : 1
  session_start_cet : Handelsbeginn CET (08:00)
  session_end_cet   : Handelsende CET (17:00)
  htf               : Hoehererer TF fuer FVG-Suche (M5 fuer Backtest, H1 live)
  htf_candles       : Anzahl HTF-Kerzen (100)
  htf_bias_lookback : Kerzen fuer Bias-Erkennung (10)
  sweep_lookback    : Lookback fuer Sweep-Erkennung (6)
  fvg_tolerance     : Preis-Toleranz fuer FVG-Zone in % (0.001 = 0.1%)
  min_crv           : Minimum CRV (1.5)
"""
import os
import sys
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scaffold.base_bot import BaseBot


def _cet_offset() -> int:
    month = datetime.now(timezone.utc).month
    return 2 if 4 <= month <= 10 else 1


class FVGScalper(BaseBot):
    """ICT Fair Value Gap + Liquidity Scalping."""

    def __init__(self, bot_id: str, name: str, port: int):
        super().__init__(bot_id, name, port)
        self._bias: str | None = None
        self._htf_name: str | None = None
        self._active_fvg: dict | None = None
        self._entry_price: float | None = None
        self._entry_sl: float | None = None
        self._entry_tp1: float | None = None
        self._entry_tp2: float | None = None
        self._tp1_hit: bool = False

    # ── Session ──────────────────────────────────────────────────────────

    def _in_session(self) -> bool:
        cfg = self._config.get("strategy", {})
        s_start = cfg.get("session_start_cet", "08:00")
        s_end = cfg.get("session_end_cet", "17:00")
        now = datetime.now(timezone.utc) + timedelta(hours=_cet_offset())
        cur = now.hour * 60 + now.minute

        def to_min(t: str) -> int:
            h, m = map(int, t.split(":"))
            return h * 60 + m

        return to_min(s_start) <= cur <= to_min(s_end)

    # ── FVG Detection (inkl. Near-Gap fuer aggregierte Daten) ────────────

    def _find_fvgs(self, candles: list, direction: str) -> list:
        """
        Erkennt FVGs (strikte Luecke) und Near-Gaps (starke Impulske ohne vollstaendige Luecke).
        Near-Gap: starke Richtungskerze in der Mitte (body > 40% der Range).
        Gibt Liste zurueck — neueste zuerst.
        """
        fvgs = []
        for i in range(2, len(candles)):
            c0, c1, c2 = candles[i - 2], candles[i - 1], candles[i]
            c1_range = c1["high"] - c1["low"] or 0.001

            if direction == "bearish":
                c1_body = c1["open"] - c1["close"]
                is_impulse = c1_body > 0 and c1_body / c1_range > 0.40
                if c0["low"] > c2["high"]:
                    # Strikte FVG-Luecke
                    fvgs.append({"low": c2["high"], "high": c0["low"], "type": "gap"})
                elif is_impulse and c0["close"] > c2["open"]:
                    # Near-Gap: Impulskerze hinterlaesst Imbalance-Zone
                    fvgs.append({"low": c2["open"], "high": c0["close"], "type": "near"})

            elif direction == "bullish":
                c1_body = c1["close"] - c1["open"]
                is_impulse = c1_body > 0 and c1_body / c1_range > 0.40
                if c0["high"] < c2["low"]:
                    fvgs.append({"low": c0["high"], "high": c2["low"], "type": "gap"})
                elif is_impulse and c0["open"] < c2["close"]:
                    fvgs.append({"low": c0["open"], "high": c2["close"], "type": "near"})

        return fvgs[::-1]  # neueste zuerst

    def _price_near_fvg(self, price: float, fvg: dict, tolerance: float = 0.001) -> bool:
        """Preis in oder nahe der FVG-Zone (Toleranz in %)."""
        buf = fvg["high"] * tolerance
        return (fvg["low"] - buf) <= price <= (fvg["high"] + buf)

    # ── Bias ─────────────────────────────────────────────────────────────

    def _get_bias(self, candles: list, lookback: int = 10) -> str | None:
        """Lower Highs + Lower Lows = bärisch, umgekehrt = bullisch."""
        if len(candles) < lookback:
            return None
        recent = candles[-lookback:]
        mid = lookback // 2
        fh, sh = recent[:mid], recent[mid:]
        fh_hi = max(c["high"] for c in fh)
        sh_hi = max(c["high"] for c in sh)
        fh_lo = min(c["low"] for c in fh)
        sh_lo = min(c["low"] for c in sh)
        if sh_hi < fh_hi and sh_lo < fh_lo:
            return "bearish"
        if sh_hi > fh_hi and sh_lo > fh_lo:
            return "bullish"
        return None

    # ── Sweep + Displacement (Entry-Signal) ──────────────────────────────

    def _detect_entry(self, candles: list, direction: str, lookback: int = 6) -> bool:
        """
        Erkennt Liquidity Sweep eines Swings + anschliessende Richtungskerze (Displacement).
        Bearisch: Sweep ueber Swing-High → starker Bearclose.
        Bullisch: Sweep unter Swing-Low → starker Bullclose.
        """
        if len(candles) < lookback + 2:
            return False
        ref = candles[-(lookback + 2):-2]
        last2 = candles[-2:]

        if direction == "bearish":
            swing_high = max(c["high"] for c in ref)
            swept = any(c["high"] > swing_high for c in last2)
            last = last2[-1]
            displaced = last["close"] < swing_high and last["open"] > last["close"]
            return swept and displaced

        elif direction == "bullish":
            swing_low = min(c["low"] for c in ref)
            swept = any(c["low"] < swing_low for c in last2)
            last = last2[-1]
            displaced = last["close"] > swing_low and last["close"] > last["open"]
            return swept and displaced

        return False

    # ── Entry Levels ─────────────────────────────────────────────────────

    def _calc_levels(self, m1: list, htf: list, direction: str) -> tuple | None:
        if len(m1) < 15:
            return None
        entry = m1[-1]["close"]

        if direction == "bearish":
            sl = max(c["high"] for c in m1[-5:]) * 1.0003
            tp1 = min(c["low"] for c in m1[-20:-1])
            tp2 = (min(c["low"] for c in htf[-10:]) if len(htf) >= 10
                   else tp1 - abs(entry - tp1))
            if tp2 >= tp1:
                tp2 = tp1 - abs(entry - tp1) * 1.5
            return entry, sl, tp1, tp2

        elif direction == "bullish":
            sl = min(c["low"] for c in m1[-5:]) * 0.9997
            tp1 = max(c["high"] for c in m1[-20:-1])
            tp2 = (max(c["high"] for c in htf[-10:]) if len(htf) >= 10
                   else tp1 + abs(tp1 - entry))
            if tp2 <= tp1:
                tp2 = tp1 + abs(tp1 - entry) * 1.5
            return entry, sl, tp1, tp2

        return None

    # ── Position Management ──────────────────────────────────────────────

    def _manage_positions(self, positions: list, price: float) -> dict:
        if not positions:
            return {"action": "hold"}
        ticket = positions[0].get("ticket")
        if not ticket:
            return {"action": "hold"}

        if self._bias == "bearish":
            if self._entry_tp2 and price <= self._entry_tp2:
                self.log("info", f"TP2 @ {price:.2f}")
                self._reset_state()
                return {"action": "close", "ticket": ticket}
            if not self._tp1_hit and self._entry_tp1 and price <= self._entry_tp1:
                self._tp1_hit = True
                self._entry_sl = self._entry_price
                self.log("info", f"TP1 @ {price:.2f} — Break-even")
            if self._tp1_hit and self._entry_sl and price >= self._entry_sl:
                self.log("info", f"Break-even Exit @ {price:.2f}")
                self._reset_state()
                return {"action": "close", "ticket": ticket}

        elif self._bias == "bullish":
            if self._entry_tp2 and price >= self._entry_tp2:
                self.log("info", f"TP2 @ {price:.2f}")
                self._reset_state()
                return {"action": "close", "ticket": ticket}
            if not self._tp1_hit and self._entry_tp1 and price >= self._entry_tp1:
                self._tp1_hit = True
                self._entry_sl = self._entry_price
                self.log("info", f"TP1 @ {price:.2f} — Break-even")
            if self._tp1_hit and self._entry_sl and price <= self._entry_sl:
                self.log("info", f"Break-even Exit @ {price:.2f}")
                self._reset_state()
                return {"action": "close", "ticket": ticket}

        return {"action": "hold"}

    def _reset_state(self) -> None:
        self._bias = None
        self._htf_name = None
        self._active_fvg = None
        self._entry_price = None
        self._entry_sl = None
        self._entry_tp1 = None
        self._entry_tp2 = None
        self._tp1_hit = False

    # ── Main Strategy ────────────────────────────────────────────────────

    def on_tick(self, candles: list, positions: list) -> dict:
        """
        ICT FVG Scalping — 2-Stufen Multi-Timeframe:
        Stufe 1: HTF (M5/H1) FVG + Bias
        Stufe 2: M1 Entry (Sweep + Displacement)
        """
        if not self._in_session():
            return {"action": "hold"}

        if not self._bridge:
            return {"action": "hold"}

        cfg = self._config.get("strategy", {})
        symbol = cfg.get("symbol", "NDAQ.OQ")
        lots = float(cfg.get("lots", 0.01))
        min_crv = float(cfg.get("min_crv", 1.5))
        htf = cfg.get("htf", "M5")
        htf_count = int(cfg.get("htf_candles", 100))
        bias_lb = int(cfg.get("htf_bias_lookback", 10))
        sweep_lb = int(cfg.get("sweep_lookback", 6))
        fvg_tol = float(cfg.get("fvg_tolerance", 0.001))

        if not candles:
            return {"action": "hold"}

        current_price = candles[-1]["close"]

        # Offene Positionen verwalten
        if positions:
            return self._manage_positions(positions, current_price)

        if self._tp1_hit:
            self._reset_state()

        # ── Stufe 1: HTF FVG + Bias ────────────────────────────────────
        htf_candles = self._bridge.get_candles(symbol, htf, htf_count)
        if not htf_candles:
            return {"action": "hold"}

        bias = self._get_bias(htf_candles, lookback=bias_lb)
        if not bias:
            return {"action": "hold"}

        fvgs = self._find_fvgs(htf_candles, bias)
        if not fvgs:
            return {"action": "hold"}

        active_fvg = None
        for fvg in fvgs[:3]:  # prüfe die 3 neuesten FVGs
            if self._price_near_fvg(current_price, fvg, fvg_tol):
                active_fvg = fvg
                break

        if not active_fvg:
            return {"action": "hold"}

        self.log("info", f"{htf} {bias} FVG [{active_fvg['low']:.2f}–{active_fvg['high']:.2f}]")

        # ── Stufe 2: M1 Entry-Signal ────────────────────────────────────
        if not self._detect_entry(candles, bias, lookback=sweep_lb):
            return {"action": "hold"}

        levels = self._calc_levels(candles, htf_candles, bias)
        if not levels:
            return {"action": "hold"}

        entry, sl, tp1, tp2 = levels
        risk = abs(entry - sl)
        if risk <= 0:
            return {"action": "hold"}

        crv = abs(entry - tp2) / risk
        if crv < min_crv:
            self.log("info", f"CRV {crv:.2f} < {min_crv}")
            return {"action": "hold"}

        self._bias = bias
        self._htf_name = htf
        self._active_fvg = active_fvg
        self._entry_price = entry
        self._entry_sl = sl
        self._entry_tp1 = tp1
        self._entry_tp2 = tp2
        self._tp1_hit = False

        action = "sell" if bias == "bearish" else "buy"
        self.log(
            "info",
            f"ENTRY {action.upper()} {symbol}",
            f"E={entry:.2f} SL={sl:.2f} TP1={tp1:.2f} TP2={tp2:.2f} CRV={crv:.1f}x",
        )
        return {"action": action, "lots": lots, "sl": round(sl, 2), "tp": round(tp2, 2)}
