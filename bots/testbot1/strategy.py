"""
TestBot1 — Timer-basierte Test-Strategie.
Kauft alle 30 Minuten 0.01 Lot EURUSDp und schließt die Position nach 10 Minuten.
"""
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scaffold.base_bot import BaseBot

BUY_INTERVAL_SEC = 1800  # 30 Minuten
HOLD_DURATION_SEC = 600  # 10 Minuten


class TestBot1(BaseBot):
    """Timer-Bot: BUY alle 30 Minuten, CLOSE nach 10 Minuten."""

    def __init__(self, bot_id: str, name: str, port: int):
        super().__init__(bot_id, name, port)
        self._last_buy_time: float = 0.0
        self._buy_open_time: float = 0.0

    def on_tick(self, candles: list, positions: list) -> dict:
        now = time.time()

        if positions:
            if self._buy_open_time > 0 and now - self._buy_open_time >= HOLD_DURATION_SEC:
                ticket = positions[0].get("ticket")
                if ticket:
                    self.log("info", f"10min abgelaufen — schließe #{ticket}")
                    self._buy_open_time = 0.0
                    return {"action": "close", "ticket": ticket}
            return {"action": "hold"}

        if now - self._last_buy_time >= BUY_INTERVAL_SEC:
            self._last_buy_time = now
            self._buy_open_time = now
            self.log("info", "30min-Intervall — öffne BUY EURUSDp 0.01")
            return {"action": "buy", "lots": 0.01}

        return {"action": "hold"}
