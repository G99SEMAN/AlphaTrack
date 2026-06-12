"""
TestBot2 — Timer-basierte Test-Strategie mit einstellbaren Parametern.
Kauft alle interval_minutes Minuten 0.01 Lot EURUSDp und schliesst die
Position nach hold_minutes Minuten.

Parameter (editierbar in AlphaTrack unter Bots → Settings):
  - hold_minutes:     Wie lange ein Trade offen bleibt (Minuten)
  - interval_minutes: Abstand zwischen zwei Trade-Eroeffnungen (Minuten)

Die Parameter werden im Heartbeat gemeldet und via set_parameters-Command
geaendert. Aenderungen werden in config.json persistiert (restart-safe).
"""
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scaffold.base_bot import BaseBot


class TestBot2(BaseBot):
    """Timer-Bot: BUY alle interval_minutes, CLOSE nach hold_minutes."""

    def __init__(self, bot_id: str, name: str, port: int):
        super().__init__(bot_id, name, port)
        self._last_buy_time: float = 0.0

    # ── Strategie-Methoden ───────────────────────────────────────────────

    def get_parameters(self) -> dict:
        strat = self._config.get("strategy", {})
        return {
            "hold_minutes": float(strat.get("hold_minutes", 10)),
            "interval_minutes": float(strat.get("interval_minutes", 30)),
        }

    def on_tick(self, candles: list, positions: list) -> dict:
        now = time.time()
        params = self.get_parameters()
        hold_sec = params["hold_minutes"] * 60
        interval_sec = params["interval_minutes"] * 60

        if positions:
            # Haltedauer mit der lokalen Uhr seit Trade-Eroeffnung messen
            # (MT5-Zeitstempel sind Broker-Zeit und dafuer unbrauchbar);
            # nach Restart geladene Tickets gelten als abgelaufen
            for pos in positions:
                ticket = pos.get("ticket")
                age = self.ticket_age_sec(ticket) if ticket else None
                if ticket and age is not None and age >= hold_sec:
                    self.log("info", f"{params['hold_minutes']:g}min abgelaufen — schliesse #{ticket}")
                    return {"action": "close", "ticket": ticket}
            return {"action": "hold"}

        if now - self._last_buy_time >= interval_sec:
            self._last_buy_time = now
            self.log("info", f"{params['interval_minutes']:g}min-Intervall — oeffne BUY EURUSDp 0.01")
            return {"action": "buy", "lots": float(self._config.get("strategy", {}).get("lots", 0.01))}

        return {"action": "hold"}
