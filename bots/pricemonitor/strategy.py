"""
Strategie: Price Monitor
Beschreibung: Zeigt nur den aktuellen EURUSDp-Kurs an (Schlusskurs der
neuesten M1-Kerze von der Bridge) — handelt NICHT. Dient zum Testen,
ob Kursdaten korrekt von MT5 ueber die Bridge beim Bot ankommen.

Parameter (editierbar in AlphaTrack unter Bots -> Settings):
  - tick_interval_sec: Aktualisierungs-Intervall in Sekunden (Standard: 5)
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scaffold.base_bot import BaseBot


class PriceMonitor(BaseBot):
    """Kurs-Monitor: loggt den aktuellen Kurs, oeffnet keine Trades."""

    def __init__(self, bot_id: str, name: str, port: int):
        super().__init__(bot_id, name, port)
        self._last_price: float | None = None

    def get_parameters(self) -> dict:
        strat = self._config.get("strategy", {})
        return {
            "tick_interval_sec": float(strat.get("tick_interval_sec", 5)),
        }

    def on_tick(self, candles: list, positions: list) -> dict:
        if not candles:
            self.log("warn", "Keine Kerzen von der Bridge erhalten")
            return {"action": "hold"}

        # candles[0] ist die neueste Kerze (Bridge liefert neueste zuerst);
        # Werte kommen als Strings von der Bridge
        try:
            price = float(candles[0]["close"])
        except (KeyError, TypeError, ValueError):
            self.log("warn", "Kerze ohne lesbaren Schlusskurs", str(candles[0])[:120])
            return {"action": "hold"}

        symbol = self._config.get("strategy", {}).get("symbol", "EURUSDp")
        if self._last_price is None:
            richtung = ""
        elif price > self._last_price:
            richtung = " ^"
        elif price < self._last_price:
            richtung = " v"
        else:
            richtung = " ="
        self._last_price = price

        self.log("info", f"{symbol}: {price:.5f}{richtung}")
        return {"action": "hold"}
