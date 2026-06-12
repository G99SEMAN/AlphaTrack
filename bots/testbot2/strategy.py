"""
TestBot2 — Timer-basierte Test-Strategie mit einstellbaren Parametern.
Kauft alle interval_minutes Minuten 0.01 Lot EURUSDp und schließt die
Position nach hold_minutes Minuten.

Parameter (editierbar in AlphaTrack unter Bots → Settings):
  - hold_minutes:     Wie lange ein Trade offen bleibt (Minuten)
  - interval_minutes: Abstand zwischen zwei Trade-Eröffnungen (Minuten)

Die Parameter werden im Heartbeat gemeldet und via set_parameters-Command
geändert. Änderungen werden in config.json persistiert (restart-safe).
"""
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scaffold.base_bot import BaseBot
from bot_display import BotDisplay


class TestBot2(BaseBot):
    """Timer-Bot: BUY alle interval_minutes, CLOSE nach hold_minutes."""

    def __init__(self, bot_id: str, name: str, port: int):
        super().__init__(bot_id, name, port)
        self._last_buy_time: float = 0.0
        self._display: BotDisplay | None = None  # Live-Terminal (nach display_header() aktiv)

    # ── Terminal-Display-Overrides ───────────────────────────────────────

    def display_header(self) -> None:
        """
        Startet das rich-Live-Terminal statt des print-Headers der Basisklasse.
        Wird von base run() nach der Registrierung aufgerufen — Latenz und Config
        sind zu diesem Zeitpunkt bereits gesetzt.
        KEIN super().display_header() — der wuerde print-Zeilen erzeugen, die das
        Live-Layout zerstoeren.
        """
        self._display = BotDisplay(self.name)
        self._display.attach(self)
        self._display.start()

    def log(self, level: str, message: str, details: str = None) -> None:
        """
        Routet Bot-Logs ins Live-Display (wenn aktiv) statt auf die Konsole.
        Vor Display-Start: Verhalten der Basisklasse (BotLog + ws_client).
        KEIN super().log() wenn Display aktiv — der Fallback-Pfad der Basisklasse
        druckt auf die Konsole und wuerde das Live-Layout zerstoeren.
        """
        # WS-Client-Push (wie base_bot.py Z.244-245) — immer, unabhaengig vom Display
        if self._ws_client:
            self._ws_client.send_log(level, message, details)

        if self._display is not None:
            # Display aktiv: nur ins Terminal routen, kein Konsolen-Print
            msg = message + (f" | {details}" if details else "")
            self._display.log(level, "BOT", msg)
        else:
            # Display noch nicht gestartet: Verhalten der Basisklasse beibehalten
            if self._log:
                self._log.add(level, message, details)

    def on_mt5_error(self, error: str) -> None:
        """
        Leitet MT5-Fehler ins Display-Log weiter, ohne direkt auf die Konsole zu
        drucken (base_bot.py Z.294 wuerde das Live-Layout zerstoeren).
        """
        self.log("error", "MT5-Fehler", error)

    def run(self) -> None:
        """Startet den Bot-Loop und stellt sicher, dass das Display beim Beenden gestoppt wird."""
        try:
            super().run()
        finally:
            if getattr(self, "_display", None) is not None:
                self._display.stop()

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
                    self.log("info", f"{params['hold_minutes']:g}min abgelaufen — schließe #{ticket}")
                    return {"action": "close", "ticket": ticket}
            return {"action": "hold"}

        if now - self._last_buy_time >= interval_sec:
            self._last_buy_time = now
            self.log("info", f"{params['interval_minutes']:g}min-Intervall — öffne BUY EURUSDp 0.01")
            return {"action": "buy", "lots": float(self._config.get("strategy", {}).get("lots", 0.01))}

        return {"action": "hold"}
