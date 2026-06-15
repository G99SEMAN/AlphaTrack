"""
Strategie: Scalping V1
Beschreibung: EMA-Crossover (5/20) mit RSI-14-Filter auf M5 waehrend London+NY-Session.
              Einstieg bei EMA-Cross + RSI-Richtungsfilter, SL/TP fix in Pips.
Parameter (in config.json unter 'strategy'):
  - symbol: Handelssymbol (EURUSDp)
  - timeframe: M5
  - candles_count: 50
  - lots: Lot-Groesse
  - max_positions: Max. gleichzeitige Positionen
  - sl_pips: StopLoss in Pips
  - tp_pips: TakeProfit in Pips (Empfehlung: 1.5 * sl_pips)
  - ema_fast: Periode des schnellen EMA (Standard: 5)
  - ema_slow: Periode des langsamen EMA (Standard: 20)
  - rsi_period: RSI-Periode (Standard: 14)
  - session_start_utc: Handelsbeginn UTC-Stunde (Standard: 7)
  - session_end_utc: Handelsende UTC-Stunde (Standard: 16)
  - tick_interval_sec: Wie oft on_tick() laeuft in Sekunden (Standard: 60)
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scaffold.base_bot import BaseBot


class ScalpingV1Strategy(BaseBot):
    """EMA-Crossover + RSI-Filter Scalping auf EURUSDp M5, London/NY-Session."""

    def get_parameters(self) -> dict:
        strat = self._config.get("strategy", {})
        return {
            "sl_pips": float(strat.get("sl_pips", 10)),
            "tp_pips": float(strat.get("tp_pips", 15)),
            "lots": float(strat.get("lots", 0.05)),
            "ema_fast": float(strat.get("ema_fast", 5)),
            "ema_slow": float(strat.get("ema_slow", 20)),
            "rsi_period": float(strat.get("rsi_period", 14)),
            "session_start_utc": float(strat.get("session_start_utc", 7)),
            "session_end_utc": float(strat.get("session_end_utc", 16)),
            "tick_interval_sec": float(strat.get("tick_interval_sec", 60)),
        }

    def on_tick(self, candles: list, positions: list) -> dict:
        """
        Handelsstrategie: EMA-Crossover + RSI-Filter.

        Returns:
            {"action": "hold"}
            {"action": "buy",  "lots": 0.05, "sl": 1.0800, "tp": 1.0815}
            {"action": "sell", "lots": 0.05, "sl": 1.0815, "tp": 1.0800}
        """
        cfg = self._config.get("strategy", {})

        # Session-Filter: nur innerhalb der London/NY-Handelszeit
        now_utc = self._now()
        session_start = int(cfg.get("session_start_utc", 7))
        session_end = int(cfg.get("session_end_utc", 16))
        if not (session_start <= now_utc.hour < session_end):
            return {"action": "hold"}

        ema_fast_period = int(cfg.get("ema_fast", 5))
        ema_slow_period = int(cfg.get("ema_slow", 20))
        rsi_period = int(cfg.get("rsi_period", 14))
        min_candles = ema_slow_period + rsi_period + 2

        if len(candles) < min_candles:
            self.log("warn", "Zu wenig Kerzen", f"Benoetigt: {min_candles}, vorhanden: {len(candles)}")
            return {"action": "hold"}

        closes = [float(c["close"]) for c in candles]

        # EMA-Cross: vorige Kerze vs. aktuelle Kerze
        ema_fast_prev = self._ema(closes[:-1], ema_fast_period)
        ema_slow_prev = self._ema(closes[:-1], ema_slow_period)
        ema_fast_curr = self._ema(closes, ema_fast_period)
        ema_slow_curr = self._ema(closes, ema_slow_period)

        rsi = self._rsi(closes, rsi_period)

        sl_pips = float(cfg.get("sl_pips", 10))
        tp_pips = float(cfg.get("tp_pips", 15))
        lots = float(cfg.get("lots", 0.05))
        pip = 0.0001  # EURUSD Pip-Groesse

        price = closes[-1]

        # Keine neue Position wenn bereits offen
        if positions:
            return {"action": "hold"}

        # Bullisches Crossover: EMA fast ueberschreitet EMA slow von unten + RSI > 50
        if ema_fast_prev < ema_slow_prev and ema_fast_curr > ema_slow_curr and rsi > 50:
            sl = round(price - sl_pips * pip, 5)
            tp = round(price + tp_pips * pip, 5)
            self.log("info", "BUY-Signal", f"EMA-Cross bullish | RSI={rsi:.1f} | SL={sl} TP={tp}")
            return {"action": "buy", "lots": lots, "sl": sl, "tp": tp}

        # Bearisches Crossover: EMA fast unterschreitet EMA slow von oben + RSI < 50
        if ema_fast_prev > ema_slow_prev and ema_fast_curr < ema_slow_curr and rsi < 50:
            sl = round(price + sl_pips * pip, 5)
            tp = round(price - tp_pips * pip, 5)
            self.log("info", "SELL-Signal", f"EMA-Cross bearish | RSI={rsi:.1f} | SL={sl} TP={tp}")
            return {"action": "sell", "lots": lots, "sl": sl, "tp": tp}

        return {"action": "hold"}

    # ── Hilfsfunktionen ──────────────────────────────────────────────────

    def _ema(self, prices: list, period: int) -> float:
        """Exponentieller Gleitender Durchschnitt (Wilder-Methode)."""
        if len(prices) < period:
            return sum(prices) / len(prices)
        k = 2.0 / (period + 1)
        ema = sum(prices[:period]) / period
        for price in prices[period:]:
            ema = price * k + ema * (1 - k)
        return ema

    def _rsi(self, prices: list, period: int) -> float:
        """Relative Strength Index (Wilder-Glaettung)."""
        if len(prices) < period + 1:
            return 50.0
        gains, losses = [], []
        for i in range(-period, 0):
            diff = prices[i] - prices[i - 1]
            if diff >= 0:
                gains.append(diff)
                losses.append(0.0)
            else:
                gains.append(0.0)
                losses.append(-diff)
        avg_gain = sum(gains) / period
        avg_loss = sum(losses) / period
        if avg_loss == 0:
            return 100.0
        rs = avg_gain / avg_loss
        return 100.0 - (100.0 / (1 + rs))
