"""
Strategie: BB Squeeze Breakout
Symbol:    GBPJPYp, Timeframe: M15
Fenster:   08:00–11:00 Uhr Berliner Zeit (London Open)

Einstieg:  Kerze schließt außerhalb der BB nach einem Squeeze (BandWidth-Minimum)
Ausstieg:  SL = gegenüberliegendes Band | TP = 1.5× SL-Distanz | Break-Even bei +20 Pips
Risiko:    1% des Kontoguthabens pro Trade (dynamische Lotberechnung)
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scaffold.base_bot import BaseBot

# Timezone-Handling: zoneinfo (Python 3.9+) → pytz → UTC+2 Fallback
try:
    from zoneinfo import ZoneInfo
    _BERLIN = ZoneInfo("Europe/Berlin")
except Exception:
    try:
        import pytz
        _BERLIN = pytz.timezone("Europe/Berlin")
    except ImportError:
        _BERLIN = None


class BBSqueezeStrategy(BaseBot):
    """BB Squeeze Breakout — GBPJPYp M15, London Open 08:00–11:00 Uhr Berlin."""

    def __init__(self, bot_id: str, name: str, port: int):
        super().__init__(bot_id, name, port)
        # {ticket: {"entry": float, "direction": str, "be_activated": bool}}
        self._be_tracker = {}
        self._last_entry_date: str = ""  # YYYY-MM-DD Berliner Zeit

    def get_parameters(self) -> dict:
        strat = self._config.get("strategy", {})
        return {
            "bb_period":           float(strat.get("bb_period", 20)),
            "bb_std":              float(strat.get("bb_std", 2.0)),
            "squeeze_lookback":    float(strat.get("squeeze_lookback", 50)),
            "squeeze_recent_bars": float(strat.get("squeeze_recent_bars", 5)),
            "rr_ratio":            float(strat.get("rr_ratio", 1.5)),
            "risk_percent":        float(strat.get("risk_percent", 1.0)),
            "pip_value_per_lot":   float(strat.get("pip_value_per_lot", 7.0)),
            "be_threshold_pips":   float(strat.get("be_threshold_pips", 20)),
            "trading_start_hour":  float(strat.get("trading_start_hour", 8)),
            "trading_end_hour":    float(strat.get("trading_end_hour", 11)),
            "ema_period":          float(strat.get("ema_period", 50)),
            "atr_sl_cap_multiplier": float(strat.get("atr_sl_cap_multiplier", 2.0)),
        }

    def on_tick(self, candles: list, positions: list) -> dict:
        cfg = self._config.get("strategy", {})

        # --- Break-Even-Verwaltung (auch außerhalb Handelsfenster aktiv) ---
        close_result = self._manage_breakeven(positions, cfg)
        if close_result:
            return close_result

        # --- Handelsfenster prüfen (Berliner Zeit) ---
        if not self._is_trading_time(cfg):
            start_h = int(cfg.get("trading_start_hour", 8))
            end_h   = int(cfg.get("trading_end_hour", 11))
            return {"action": "hold", "reason": f"Außerhalb Fenster {start_h:02d}:00–{end_h:02d}:00 Uhr Berlin"}

        # --- Maximale Positionen ---
        max_pos = int(cfg.get("max_positions", 1))
        if len(positions) >= max_pos:
            return {"action": "hold", "reason": "Max. 1 Position bereits offen"}

        # --- Tages-Limit: max. 1 Trade pro Handelstag ---
        today_str = self._today_berlin()
        if self._last_entry_date == today_str:
            return {"action": "hold", "reason": f"Tages-Limit erreicht ({today_str})"}

        # --- Mindestanzahl Kerzen ---
        bb_period      = int(cfg.get("bb_period", 20))
        sq_lookback    = int(cfg.get("squeeze_lookback", 50))
        sq_recent_bars = int(cfg.get("squeeze_recent_bars", 5))
        min_candles    = bb_period + sq_lookback + sq_recent_bars + 5

        if len(candles) < min_candles:
            return {"action": "hold", "reason": f"Zu wenig Kerzen ({len(candles)}/{min_candles})"}

        # --- Bollinger Bands berechnen ---
        closes = [float(c["close"]) for c in candles]
        bb_std = float(cfg.get("bb_std", 2.0))
        bands  = self._calc_bb(closes, bb_period, bb_std)

        # --- Squeeze in den letzten Kerzen? ---
        if not self._detect_recent_squeeze(bands, sq_lookback, sq_recent_bars):
            bw = bands[-1]["bandwidth"] if bands[-1] else 0
            return {"action": "hold", "reason": f"Kein Squeeze erkannt | BandWidth {bw:.4f}"}

        # --- Breakout-Signal der letzten Kerze ---
        current_band = bands[-1]
        if current_band is None:
            return {"action": "hold", "reason": "BB nicht berechenbar"}

        last_close = closes[-1]
        upper      = current_band["upper"]
        lower      = current_band["lower"]

        if lower <= last_close <= upper:
            bw = current_band["bandwidth"]
            return {
                "action": "hold",
                "reason": f"Squeeze erkannt – warte auf Breakout | Close {last_close:.3f} | BB {lower:.3f}–{upper:.3f} | BW {bw:.4f}",
            }

        # --- Richtung des Breakouts ---
        direction = "buy" if last_close > upper else "sell"

        # --- Trendfilter: nur mit EMA-Trend handeln ---
        ema_period = int(cfg.get("ema_period", 50))
        ema = self._calc_ema(closes, ema_period)
        if ema is not None:
            if direction == "buy" and last_close < ema:
                return {"action": "hold", "reason": f"Trendfilter: BUY blockiert (Preis {last_close:.3f} < EMA{ema_period} {ema:.3f})"}
            if direction == "sell" and last_close > ema:
                return {"action": "hold", "reason": f"Trendfilter: SELL blockiert (Preis {last_close:.3f} > EMA{ema_period} {ema:.3f})"}

        # --- SL und TP berechnen ---
        sl_price = lower if direction == "buy" else upper
        sl_dist  = abs(last_close - sl_price)
        rr_ratio = float(cfg.get("rr_ratio", 1.5))
        tp_price = (last_close + sl_dist * rr_ratio) if direction == "buy" else (last_close - sl_dist * rr_ratio)

        # --- ATR-Cap für SL-Distanz (verhindert übermäßig breite SL bei hoher Volatilität) ---
        atr_cap_mult = float(cfg.get("atr_sl_cap_multiplier", 2.0))
        atr = self._calc_atr(candles, period=14)
        if atr is not None and sl_dist > atr * atr_cap_mult:
            sl_dist  = atr * atr_cap_mult
            sl_price = (last_close - sl_dist) if direction == "buy" else (last_close + sl_dist)
            tp_price = (last_close + sl_dist * rr_ratio) if direction == "buy" else (last_close - sl_dist * rr_ratio)

        # --- Lotgröße: 1% Kontorisiko ---
        lots = self._calc_lots(sl_dist, cfg)
        tp_dist = abs(tp_price - last_close)

        arrow  = "↑" if direction == "buy" else "↓"
        reason = (
            f"{arrow} Breakout nach Squeeze | "
            f"Close {last_close:.3f} | "
            f"SL {sl_price:.3f} | TP {tp_price:.3f} | Lots {lots:.2f}"
        )

        self._last_entry_date = today_str
        return {
            "action":  direction,
            "lots":    lots,
            "sl":      round(sl_price, 3),
            "tp":      round(tp_price, 3),
            "sl_pips": round(sl_dist / 0.01, 1),   # JPY-Pair: 1 Pip = 0.01
            "tp_pips": round(tp_dist / 0.01, 1),
            "reason":  reason,
        }

    # -------------------------------------------------------------------------
    # Private Hilfsmethoden
    # -------------------------------------------------------------------------

    def _is_trading_time(self, cfg: dict) -> bool:
        """Prüft ob aktuelle Zeit im Handelsfenster liegt (Berliner Lokalzeit, DST-korrekt)."""
        import datetime
        now_utc = self._now()
        start_h = int(cfg.get("trading_start_hour", 8))
        end_h   = int(cfg.get("trading_end_hour", 11))

        if _BERLIN is not None:
            now_berlin = now_utc.astimezone(_BERLIN)
            return start_h <= now_berlin.hour < end_h

        # Fallback: UTC+2 (CEST) — keine DST-Anpassung
        offset     = datetime.timezone(datetime.timedelta(hours=2))
        now_approx = now_utc.astimezone(offset)
        return start_h <= now_approx.hour < end_h

    def _today_berlin(self) -> str:
        """Aktuelles Datum in Berliner Zeit als YYYY-MM-DD."""
        import datetime as _dt
        now_utc = self._now()
        if _BERLIN is not None:
            return now_utc.astimezone(_BERLIN).strftime("%Y-%m-%d")
        offset = _dt.timezone(_dt.timedelta(hours=2))
        return now_utc.astimezone(offset).strftime("%Y-%m-%d")

    def _calc_ema(self, closes: list, period: int) -> float | None:
        """Berechnet den letzten EMA-Wert über alle verfügbaren Kerzen."""
        if len(closes) < period:
            return None
        k = 2.0 / (period + 1)
        ema = sum(closes[:period]) / period
        for price in closes[period:]:
            ema = price * k + ema * (1 - k)
        return ema

    def _calc_atr(self, candles: list, period: int = 14) -> float | None:
        """Berechnet ATR(period) über Wilder's Smoothing auf den letzten Kerzen."""
        if len(candles) < period + 1:
            return None
        true_ranges = []
        for i in range(1, len(candles)):
            high       = float(candles[i]["high"])
            low        = float(candles[i]["low"])
            prev_close = float(candles[i - 1]["close"])
            tr = max(high - low, abs(high - prev_close), abs(low - prev_close))
            true_ranges.append(tr)
        return sum(true_ranges[-period:]) / period

    def _manage_breakeven(self, positions: list, cfg: dict) -> dict:
        """
        Verfolgt offene Positionen und schließt sie, wenn Break-Even
        aktiviert wurde und der Preis auf den Einstieg zurückkehrt.
        """
        if not positions:
            self._be_tracker.clear()
            return None

        # Einträge geschlossener Positionen entfernen
        open_tickets = {int(p.get("ticket", 0)) for p in positions}
        for t in list(self._be_tracker):
            if t not in open_tickets:
                del self._be_tracker[t]

        be_threshold_price = float(cfg.get("be_threshold_pips", 20)) * 0.01  # JPY: pip = 0.01
        be_buffer_price    = 3 * 0.01  # 3 Pips Puffer für Rückkehr-Erkennung

        for pos in positions:
            ticket    = int(pos.get("ticket", 0))
            direction = "buy" if pos.get("type") == "long" else "sell"
            entry     = float(pos.get("entry", 0))
            current   = float(pos.get("currentPrice", entry))

            if ticket not in self._be_tracker:
                self._be_tracker[ticket] = {
                    "entry":        entry,
                    "direction":    direction,
                    "be_activated": False,
                }

            state = self._be_tracker[ticket]

            # Break-Even aktivieren wenn Preis weit genug in Gewinnzone
            if not state["be_activated"]:
                triggered = (
                    (direction == "buy"  and current >= entry + be_threshold_price) or
                    (direction == "sell" and current <= entry - be_threshold_price)
                )
                if triggered:
                    state["be_activated"] = True
                    self.log("INFO", f"Break-Even aktiviert #{ticket} | Entry {entry:.3f} | Preis {current:.3f}")

            # Position schließen wenn BE aktiv und Preis auf Entry zurückkehrt
            if state["be_activated"]:
                be_close = (
                    (direction == "buy"  and current <= state["entry"] + be_buffer_price) or
                    (direction == "sell" and current >= state["entry"] - be_buffer_price)
                )
                if be_close:
                    self.log("INFO", f"BE-Schließung #{ticket} | Preis {current:.3f} → Entry {entry:.3f}")
                    return {
                        "action": "close",
                        "ticket": ticket,
                        "reason": f"Break-Even Schutz | Preis {current:.3f} | Entry {entry:.3f}",
                    }

        return None

    def _calc_lots(self, sl_dist_price: float, cfg: dict) -> float:
        """Berechnet Lotgröße für eingestelltes Kontorisiko (Standard: 1%)."""
        risk_percent    = float(cfg.get("risk_percent", 1.0))
        pip_val_per_lot = float(cfg.get("pip_value_per_lot", 7.0))

        account = self._bridge.get_account_info() if self._bridge else None
        balance = float(account.get("balance", 1000.0)) if account else 1000.0

        risk_amount = balance * (risk_percent / 100.0)
        # JPY-Pair: 1 Pip = 0.01 Preiseinheiten
        sl_pips = sl_dist_price / 0.01

        if sl_pips <= 0 or pip_val_per_lot <= 0:
            return 0.01

        lots = risk_amount / (sl_pips * pip_val_per_lot)
        # Runden auf 0.01-Schritte, Grenzen: 0.01–10.0
        lots = max(0.01, min(10.0, round(lots / 0.01) * 0.01))
        return lots

    def _calc_bb(self, closes: list, period: int, std_mult: float) -> list:
        """Berechnet Bollinger Bands in reinem Python."""
        result = []
        for i in range(len(closes)):
            if i < period - 1:
                result.append(None)
                continue
            window    = closes[i - period + 1 : i + 1]
            mean      = sum(window) / period
            variance  = sum((x - mean) ** 2 for x in window) / period
            std       = variance ** 0.5
            upper     = mean + std_mult * std
            lower     = mean - std_mult * std
            bandwidth = (upper - lower) / mean if mean > 0 else 0.0
            result.append({"upper": upper, "middle": mean, "lower": lower, "bandwidth": bandwidth})
        return result

    def _detect_recent_squeeze(self, bands: list, lookback: int, recent_bars: int) -> bool:
        """
        True wenn mindestens eine der letzten recent_bars Kerzen
        (exkl. aktuelle Kerze) ein lokales BandWidth-Minimum war.
        """
        valid = [b for b in bands if b is not None]
        n     = len(valid)

        if n < lookback + recent_bars + 1:
            return False

        # Kerzen [n-recent_bars-1 .. n-2] prüfen (aktuelle Kerze = potentieller Breakout)
        for i in range(n - recent_bars - 1, n - 1):
            if i < lookback:
                continue
            history_bw = [valid[j]["bandwidth"] for j in range(i - lookback, i)]
            if not history_bw:
                continue
            if valid[i]["bandwidth"] <= min(history_bw):
                return True

        return False
