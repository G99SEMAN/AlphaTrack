"""
Strategie: London Open V1
Beschreibung: Asia-Range Breakout auf GBPUSDp M15.
              Berechnet High/Low der Asia-Session (00:00-07:00 UTC),
              tradet den Breakout im Fenster 07:00-09:00 UTC.
              Max. 1 Trade pro Tag.

Hinweis: Bridge liefert candle["datetime"] in Europe/Berlin-Zeit (CET/CEST).
         OHLC-Werte kommen als Strings. Candles sind neueste zuerst (index 0).

Parameter (in config.json unter 'strategy'):
  - symbol: GBPUSDp
  - timeframe: M15
  - candles_count: 60 (15h Abdeckung)
  - lots: Lot-Groesse
  - sl_buffer_pips: Puffer innerhalb der Range fuer den SL
  - rr_ratio: Reward/Risk-Ratio fuer TP (Standard: 1.5)
  - asia_start_utc: Asia-Session Beginn in UTC-Stunden (Standard: 0)
  - asia_end_utc: Asia-Session Ende in UTC-Stunden (Standard: 7)
  - entry_start_utc: Einstiegs-Fenster Beginn UTC (Standard: 7)
  - entry_end_utc: Einstiegs-Fenster Ende UTC (Standard: 9)
  - tick_interval_sec: Tick-Intervall in Sekunden (Standard: 60)
"""
import sys
import os
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scaffold.base_bot import BaseBot

try:
    from zoneinfo import ZoneInfo
    _TZ_BERLIN = ZoneInfo("Europe/Berlin")
except ImportError:
    try:
        import pytz
        _TZ_BERLIN = pytz.timezone("Europe/Berlin")
    except ImportError:
        _TZ_BERLIN = timezone(timedelta(hours=1))


def _parse_berlin_to_utc(dt_str: str) -> datetime:
    """Parst 'YYYY-MM-DD HH:MM:SS' (Berlin-Zeit) und gibt UTC datetime zurueck."""
    dt_naive = datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S")
    if hasattr(_TZ_BERLIN, "localize"):
        dt_local = _TZ_BERLIN.localize(dt_naive)
    else:
        dt_local = dt_naive.replace(tzinfo=_TZ_BERLIN)
    return dt_local.astimezone(timezone.utc)


class LondonOpenV1Strategy(BaseBot):
    """Asia-Range Breakout zur London Open auf GBPUSDp M15."""

    def __init__(self, bot_id: str, name: str, port: int):
        super().__init__(bot_id, name, port)
        self._last_trade_date: str = ""

    def get_parameters(self) -> dict:
        strat = self._config.get("strategy", {})
        return {
            "lots": float(strat.get("lots", 0.03)),
            "sl_buffer_pips": float(strat.get("sl_buffer_pips", 5)),
            "rr_ratio": float(strat.get("rr_ratio", 1.5)),
            "asia_start_utc": float(strat.get("asia_start_utc", 0)),
            "asia_end_utc": float(strat.get("asia_end_utc", 7)),
            "entry_start_utc": float(strat.get("entry_start_utc", 7)),
            "entry_end_utc": float(strat.get("entry_end_utc", 9)),
            "tick_interval_sec": float(strat.get("tick_interval_sec", 60)),
        }

    def on_tick(self, candles: list, positions: list) -> dict:
        """
        London Open Breakout.

        Returns:
            {"action": "hold"}
            {"action": "buy",  "lots": 0.03, "sl": 1.2500, "tp": 1.2522}
            {"action": "sell", "lots": 0.03, "sl": 1.2545, "tp": 1.2523}
        """
        cfg = self._config.get("strategy", {})
        now_utc = datetime.now(timezone.utc)
        today_str = now_utc.strftime("%Y-%m-%d")

        entry_start = int(cfg.get("entry_start_utc", 7))
        entry_end = int(cfg.get("entry_end_utc", 9))
        asia_start = int(cfg.get("asia_start_utc", 0))
        asia_end = int(cfg.get("asia_end_utc", 7))
        lots = float(cfg.get("lots", 0.03))
        sl_buffer = float(cfg.get("sl_buffer_pips", 5))
        rr = float(cfg.get("rr_ratio", 1.5))
        pip = 0.0001  # GBPUSD Pip-Groesse

        # Kein Trade ausserhalb des Einstiegs-Fensters
        if not (entry_start <= now_utc.hour < entry_end):
            return {"action": "hold"}

        # Bereits heute gehandelt
        if self._last_trade_date == today_str:
            return {"action": "hold"}

        # Offene Position → kein weiterer Trade
        if positions:
            return {"action": "hold"}

        # Candles sind neueste zuerst → umkehren fuer chronologische Auswertung
        candles_chron = list(reversed(candles))

        # Asia-Range berechnen: Kerzen des heutigen Tages zwischen asia_start und asia_end UTC
        asia_highs, asia_lows = [], []
        for c in candles_chron:
            try:
                candle_utc = _parse_berlin_to_utc(c["datetime"])
            except Exception:
                continue
            if candle_utc.strftime("%Y-%m-%d") != today_str:
                continue
            if not (asia_start <= candle_utc.hour < asia_end):
                continue
            asia_highs.append(float(c["high"]))
            asia_lows.append(float(c["low"]))

        if not asia_highs:
            self.log("warn", "Asia-Range leer", f"Keine Kerzen zwischen {asia_start}:00-{asia_end}:00 UTC")
            return {"action": "hold"}

        asia_high = max(asia_highs)
        asia_low = min(asia_lows)
        asia_range_pips = round((asia_high - asia_low) / pip)

        # Aktueller Kurs = neueste Kerze (index 0)
        current_close = float(candles[0]["close"])

        self.log("info", "Asia-Range",
                 f"H={asia_high:.5f} L={asia_low:.5f} Range={asia_range_pips}p | Kurs={current_close:.5f}")

        # Breakout BUY: Kurs schliess ueber Asia-High
        if current_close > asia_high:
            sl = round(asia_high - sl_buffer * pip, 5)
            sl_distance = round(current_close - sl, 5)
            tp = round(current_close + sl_distance * rr, 5)
            self._last_trade_date = today_str
            self.log("info", "BUY-Signal", f"Breakout ueber Asia-High {asia_high:.5f} | SL={sl} TP={tp}")
            return {"action": "buy", "lots": lots, "sl": sl, "tp": tp}

        # Breakout SELL: Kurs schliess unter Asia-Low
        if current_close < asia_low:
            sl = round(asia_low + sl_buffer * pip, 5)
            sl_distance = round(sl - current_close, 5)
            tp = round(current_close - sl_distance * rr, 5)
            self._last_trade_date = today_str
            self.log("info", "SELL-Signal", f"Breakout unter Asia-Low {asia_low:.5f} | SL={sl} TP={tp}")
            return {"action": "sell", "lots": lots, "sl": sl, "tp": tp}

        return {"action": "hold"}
