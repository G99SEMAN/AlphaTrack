"""
Strategie: Scalping V1
Beschreibung: EMA-Crossover (5/20) mit RSI-14-Filter auf M5 waehrend London+NY-Session.
              Optimierungen: EMA200-Trendfilter, ATR-dynamischer SL/TP, Tages-Limit (max. 2/Tag).
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scaffold.base_bot import BaseBot


class ScalpingV1Strategy(BaseBot):
    """EMA-Crossover + RSI-Filter + EMA200-Trend + ATR-Stop Scalping auf EURUSDp M5."""

    def __init__(self, bot_id: str, name: str, port: int):
        super().__init__(bot_id, name, port)
        self._last_trade_date: str = ""  # YYYY-MM-DD UTC
        self._daily_trades: int = 0

    def get_parameters(self) -> dict:
        strat = self._config.get("strategy", {})
        return {
            "ema_fast":          float(strat.get("ema_fast", 5)),
            "ema_slow":          float(strat.get("ema_slow", 20)),
            "ema_trend":         float(strat.get("ema_trend", 200)),
            "rsi_period":        float(strat.get("rsi_period", 14)),
            "atr_period":        float(strat.get("atr_period", 14)),
            "sl_atr_multiplier": float(strat.get("sl_atr_multiplier", 1.5)),
            "tp_rr_ratio":       float(strat.get("tp_rr_ratio", 1.7)),
            "sl_pips_min":       float(strat.get("sl_pips_min", 8)),
            "sl_pips_max":       float(strat.get("sl_pips_max", 18)),
            "max_daily_trades":  float(strat.get("max_daily_trades", 2)),
            "lots":              float(strat.get("lots", 0.05)),
            "session_start_utc": float(strat.get("session_start_utc", 7)),
            "session_end_utc":   float(strat.get("session_end_utc", 16)),
            "tick_interval_sec": float(strat.get("tick_interval_sec", 60)),
        }

    def on_tick(self, candles: list, positions: list) -> dict:
        cfg = self._config.get("strategy", {})

        # Session-Filter: nur innerhalb der London/NY-Handelszeit (UTC)
        now_utc = self._now()
        session_start = int(cfg.get("session_start_utc", 7))
        session_end   = int(cfg.get("session_end_utc", 16))
        if not (session_start <= now_utc.hour < session_end):
            return {"action": "hold", "reason": f"Außerhalb Session {session_start:02d}:00–{session_end:02d}:00 UTC"}

        # Tages-Limit: max. N Trades pro UTC-Kalendertag
        today_str  = now_utc.strftime("%Y-%m-%d")
        max_daily  = int(cfg.get("max_daily_trades", 2))
        if self._last_trade_date != today_str:
            self._last_trade_date = today_str
            self._daily_trades = 0
        if self._daily_trades >= max_daily:
            return {"action": "hold", "reason": f"Tages-Limit erreicht ({self._daily_trades}/{max_daily})"}

        # Max. Positionen
        max_pos = int(cfg.get("max_positions", 1))
        if len(positions) >= max_pos:
            return {"action": "hold", "reason": "Max. Position offen"}

        # Mindestanzahl Kerzen
        ema_fast_period  = int(cfg.get("ema_fast", 5))
        ema_slow_period  = int(cfg.get("ema_slow", 20))
        ema_trend_period = int(cfg.get("ema_trend", 200))
        rsi_period       = int(cfg.get("rsi_period", 14))
        atr_period       = int(cfg.get("atr_period", 14))
        min_candles = max(ema_trend_period, ema_slow_period + rsi_period + 2, atr_period + 1)

        if len(candles) < min_candles:
            return {"action": "hold", "reason": f"Zu wenig Kerzen ({len(candles)}/{min_candles})"}

        closes     = [float(c["close"]) for c in candles]
        last_close = closes[-1]

        # EMA-Cross: vorige Kerze vs. aktuelle Kerze
        ema_fast_prev = self._ema(closes[:-1], ema_fast_period)
        ema_slow_prev = self._ema(closes[:-1], ema_slow_period)
        ema_fast_curr = self._ema(closes, ema_fast_period)
        ema_slow_curr = self._ema(closes, ema_slow_period)
        rsi           = self._rsi(closes, rsi_period)

        # EMA200 Trendfilter
        ema_trend = self._ema(closes, ema_trend_period)

        # ATR-basierter SL/TP (EUR/USD: 1 pip = 0.0001)
        sl_atr_mult = float(cfg.get("sl_atr_multiplier", 1.5))
        tp_rr       = float(cfg.get("tp_rr_ratio", 1.7))
        sl_pips_min = float(cfg.get("sl_pips_min", 8))
        sl_pips_max = float(cfg.get("sl_pips_max", 18))
        lots        = float(cfg.get("lots", 0.05))

        atr = self._calc_atr(candles, atr_period)
        if atr is None:
            return {"action": "hold", "reason": "ATR nicht berechenbar"}

        sl_pips = max(sl_pips_min, min(sl_pips_max, (atr * sl_atr_mult) / 0.0001))
        tp_pips = round(sl_pips * tp_rr, 1)
        sl_pips = round(sl_pips, 1)

        # RSI-Schwellen (konfigurierbar, Standard: 50)
        rsi_bull = float(cfg.get("rsi_bull_threshold", 50))
        rsi_bear = float(cfg.get("rsi_bear_threshold", 50))

        # Bullisches Crossover + EMA200-Filter + RSI > Schwelle
        bull_cross = ema_fast_prev < ema_slow_prev and ema_fast_curr > ema_slow_curr
        if bull_cross and rsi > rsi_bull and last_close > ema_trend:
            sl = round(last_close - sl_pips * 0.0001, 5)
            tp = round(last_close + tp_pips * 0.0001, 5)
            self._daily_trades += 1
            return {
                "action": "buy",
                "lots":   lots,
                "sl":     sl,
                "tp":     tp,
                "reason": f"BUY EMA-Cross | RSI={rsi:.1f} | EMA200={ema_trend:.5f} | SL={sl_pips}p TP={tp_pips}p",
            }

        # Bearisches Crossover + EMA200-Filter + RSI < Schwelle
        bear_cross = ema_fast_prev > ema_slow_prev and ema_fast_curr < ema_slow_curr
        if bear_cross and rsi < rsi_bear and last_close < ema_trend:
            sl = round(last_close + sl_pips * 0.0001, 5)
            tp = round(last_close - tp_pips * 0.0001, 5)
            self._daily_trades += 1
            return {
                "action": "sell",
                "lots":   lots,
                "sl":     sl,
                "tp":     tp,
                "reason": f"SELL EMA-Cross | RSI={rsi:.1f} | EMA200={ema_trend:.5f} | SL={sl_pips}p TP={tp_pips}p",
            }

        return {"action": "hold", "reason": f"Kein Signal | RSI={rsi:.1f} | EMA200={ema_trend:.5f}"}

    # ── Hilfsfunktionen ──────────────────────────────────────────────────

    def _ema(self, prices: list, period: int) -> float:
        """Exponentieller Gleitender Durchschnitt."""
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

    def _calc_atr(self, candles: list, period: int = 14) -> float | None:
        """ATR(period) via Simple Average of True Range."""
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
