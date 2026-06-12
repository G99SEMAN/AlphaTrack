"""
BaseBot — Pflicht-Basisklasse fuer alle neuen AlphaTrack Trading Bots (C6).

Jeder neue Bot muss BaseBot erben. Damit wird sichergestellt:
- Sofortige Erkennbarkeit im Netzwerk (ID-System, Auto-Registration)
- Reibungslose Kommunikation ueber die Bridge
- Korrektes Terminal-Layout (statischer Header: ID, Name, IP:Port, Latenz, Status, Trades)
- Korrekte Log-Trennung (nur bot-relevante Logs)
- C4: Jeder Trade traegt bot_id als Metadatum
- C3: MT5-Fehler werden angezeigt

Verwendung:
    from scaffold.base_bot import BaseBot

    class MyBot(BaseBot):
        def on_tick(self, candles, positions):
            # Implementiere Handelsstrategie hier
            return {"action": "hold"}

    if __name__ == "__main__":
        bot = MyBot(bot_id="mybot-001", name="Mein Bot", port=8769)
        bot.run()
"""

import json
import os
import signal
import socket
import sys
import time
import threading

# Importpfad beachten: PYTHONPATH muss auf bots/ gesetzt sein (via start.bat)
# Paketrelative Imports setzen voraus, dass scaffold als Package geladen wird.

try:
    from .ws_client import BridgeWSClient
    from .bridge_client import BridgeClient
except ImportError as e:
    raise ImportError(
        f"BaseBot konnte ws_client/bridge_client nicht importieren: {e}\n"
        "Stelle sicher, dass PYTHONPATH auf das bots/-Verzeichnis gesetzt ist (start.bat)."
    ) from e

# Bot-Log: Wird lokal im bot-Verzeichnis gespeichert (nicht im bridge/-Verzeichnis)
try:
    from bot_log import BotLog
except ImportError:
    # Fallback: Inline-Log-Klasse wenn bot_log.py noch nicht vorhanden
    import uuid
    import tempfile
    from datetime import datetime, timezone

    class BotLog:  # type: ignore[no-redef]
        def __init__(self, bot_id: str, bot_name: str):
            self._bot_id = bot_id
            self._bot_name = bot_name

        def configure_push(self, url: str, api_key: str) -> None:
            pass

        def add(self, level: str, message: str, details: str = None) -> None:
            ts = datetime.now().strftime("%H:%M:%S")
            print(f"[{ts}] [{level.upper()}] {message}{' | ' + details if details else ''}")


# Guard-Import: BotDisplay aus dem Scaffold (rich evtl. nicht installiert)
try:
    from .bot_display import BotDisplay
except ImportError:
    BotDisplay = None  # type: ignore[assignment,misc]


def _get_local_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


class BaseBot:
    """
    Pflicht-Basisklasse fuer AlphaTrack Trading Bots.

    Parameter:
        bot_id  (str):  Eindeutige ID des Bots (aus config.json 'bot_id')
        name    (str):  Menschenlesbarer Name (aus config.json 'bot_name')
        port    (int):  Lokaler Port des Bots (aus config.json 'bot_port')
    """

    CONFIG_FILE = "config.json"

    def __init__(self, bot_id: str, name: str, port: int):
        self.bot_id = bot_id
        self.name = name
        self.port = port
        self.ip = _get_local_ip()
        self.latency_ms: float | None = None

        self._config: dict = {}
        self._ws_client: BridgeWSClient | None = None
        self._bridge: BridgeClient | None = None
        self._log: BotLog | None = None
        self._display: "BotDisplay | None" = None  # Live-Terminal (nach display_header() aktiv)
        self._running = False
        self._state = "starting"
        self._open_positions: int = 0
        self._restart_requested = False
        self._my_tickets: set[int] = set()  # tickets opened by THIS bot, survived across restarts
        self._ticket_added_at: dict[int, float] = {}  # ticket -> Zeitpunkt der lokalen Aufnahme

    # ── Ticket-Persistenz (restart-safe) ────────────────────────────────

    # Frisch geoeffnete Tickets duerfen so lange nicht gepruned werden:
    # der Positions-Cache der Bridge laeuft bis zu ~2s hinterher — ohne
    # Grace-Period wuerde ein neues Ticket sofort wieder verworfen.
    TICKET_PRUNE_GRACE_SEC = 15.0

    def _prune_tickets(self, open_tickets: set[int]) -> None:
        """Entfernt geschlossene Tickets — aber nie solche, die juenger als die Grace-Period sind."""
        now = time.time()
        for ticket in list(self._my_tickets):
            if ticket in open_tickets:
                continue
            added = self._ticket_added_at.get(ticket, 0.0)
            if now - added >= self.TICKET_PRUNE_GRACE_SEC:
                self._my_tickets.discard(ticket)
                self._ticket_added_at.pop(ticket, None)

    def _tickets_path(self) -> str:
        base = os.path.dirname(sys.argv[0]) or "."
        return os.path.join(base, "data", f"tickets_{self.bot_id}.json")

    def _load_tickets(self) -> None:
        path = self._tickets_path()
        try:
            if os.path.exists(path):
                with open(path, "r", encoding="utf-8") as f:
                    self._my_tickets = set(json.load(f))
                # Geladene Tickets gelten als "alt" (added_at=0): sie sind sofort
                # prunebar und zaehlen fuer Strategien als maximal gealtert
                for t in self._my_tickets:
                    self._ticket_added_at.setdefault(t, 0.0)
        except Exception:
            self._my_tickets = set()

    def ticket_age_sec(self, ticket: int) -> float | None:
        """
        Alter eines eigenen Tickets in Sekunden — gemessen mit der LOKALEN Uhr
        seit send_trade(). Nach einem Neustart gelten geladene Tickets als
        maximal alt. None wenn das Ticket nicht von diesem Bot stammt.

        Hinweis: Absichtlich NICHT der MT5-Zeitstempel der Position — der kommt
        in Broker-Zeit (z.B. UTC+3) und ist als UTC etikettiert, wodurch
        Altersberechnungen um Stunden daneben liegen.
        """
        added = self._ticket_added_at.get(int(ticket))
        if added is None:
            return None
        return time.time() - added

    def _save_tickets(self) -> None:
        path = self._tickets_path()
        os.makedirs(os.path.dirname(path), exist_ok=True)
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(list(self._my_tickets), f)
        except Exception:
            pass

    # ── Konfiguration laden ─────────────────────────────────────────────

    def load_config(self) -> dict:
        """Laedt config.json aus dem Bot-Verzeichnis."""
        config_path = os.path.join(os.path.dirname(sys.argv[0]), self.CONFIG_FILE)
        if not os.path.exists(config_path):
            config_path = self.CONFIG_FILE
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[FEHLER] config.json konnte nicht geladen werden: {e}")
            sys.exit(1)

    # ── Auto-Registration (C7: vollautomatisch) ─────────────────────────

    def _connect_and_register(self) -> bool:
        """
        Verbindet mit der Bridge und registriert den Bot automatisch (C7).
        Sendet alle Pflichtfelder: id, name, type, ip, port, latency.
        """
        cfg = self._config
        self._ws_client = BridgeWSClient(
            bridge_url=cfg["bridge_url"],
            api_key=cfg["api_key"],
            bot_name=self.name,
            bot_version=cfg.get("bot_version", "1.0.0"),
            bot_id=self.bot_id,
            bot_type="bot",
            bot_port=self.port,
        )

        print(f"[...] Verbinde mit Bridge: {cfg['bridge_url']}")
        if not self._ws_client.connect():
            print("[FEHLER] Registrierung fehlgeschlagen — Bridge nicht erreichbar?")
            return False

        # Erhaltene bot_id (kann von Bridge abweichen wenn ID bereits vergeben)
        assigned_id = self._ws_client.get_bot_id()
        if assigned_id:
            self.bot_id = assigned_id
        self.latency_ms = self._ws_client.get_latency_ms()

        print(f"[OK] Registriert: {self.bot_id} (Latenz: {self.latency_ms}ms)")
        return True

    # ── Statisches Terminal-Layout (Spec 3.1 Bot-Terminal) ─────────────

    def display_header(self) -> None:
        """
        Zeigt den Terminal-Header des Bots an.
        Wenn rich verfuegbar: startet das Live-Display (gruen, Bridge-Status, Parameter, Positionen).
        Ohne rich: statischer print-Header (ID, Name, IP:Port, Latenz, Status, Bridge, AlphaTrack).
        """
        if BotDisplay is not None:
            # rich installiert: Live-Terminal starten
            self._display = BotDisplay(self.name)
            self._display.attach(self)
            self._display.start()
            return

        # Fallback: statischer print-Header
        bridge_url = self._config.get("bridge_url", "—")
        at_url = self._config.get("alphatrack_url", "—")
        lat_str = f"{self.latency_ms}ms" if self.latency_ms else "—"

        print("\n" + "=" * 60)
        print(f"  BOT: {self.name}")
        print(f"  ID          : {self.bot_id}")
        print(f"  IP:Port     : {self.ip}:{self.port}")
        print(f"  Latenz      : {lat_str}")
        print(f"  Status      : {self._state}")
        print(f"  AlphaTrack  : {at_url}")
        print(f"  Bridge      : {bridge_url}")
        print(f"  Offene Trades: {self._open_positions}")
        print("=" * 60 + "\n")

    # ── Log-Filter (nur bot-relevante Logs) ────────────────────────────

    def log(self, level: str, message: str, details: str = None) -> None:
        """
        Bot-Log: Schreibt nur bot-relevante Ereignisse.
        WS-Client-Push immer wenn verbunden. Bei aktivem Display: nur ins Terminal
        routen (kein Konsolen-Print). Ohne Display: Fallback auf BotLog.
        Bridge-interne Logs oder Logs anderer Bots werden NICHT geschrieben.
        """
        # WS-Client-Push immer, unabhaengig vom Display-Status
        if self._ws_client:
            self._ws_client.send_log(level, message, details)

        if self._display is not None:
            # Display aktiv: nur ins Terminal routen, kein Konsolen-Print
            msg = message + (f" | {details}" if details else "")
            self._display.log(level, "BOT", msg)
        else:
            # Display noch nicht gestartet oder nicht verfuegbar: BotLog-Fallback
            if self._log:
                self._log.add(level, message, details)

    # ── Trade-Sending mit Bot-ID als Metadatum (C4) ─────────────────────

    def send_trade(self, trade_dict: dict) -> dict:
        """
        Sendet einen Trade an die Bridge. Bot-ID wird automatisch als Metadatum eingefuegt (C4).

        trade_dict muss enthalten:
            symbol (str), direction ('buy'|'sell'), lots (float)
        Optional:
            sl (float), tp (float)
        """
        if not self._bridge:
            return {"success": False, "error": "Bridge nicht verbunden"}

        # C4: bot_id immer als Metadatum vor Bridge-Durchgang setzen
        trade_dict["bot_id"] = self.bot_id
        result = self._bridge.execute_trade(
            symbol=trade_dict["symbol"],
            direction=trade_dict["direction"],
            lots=float(trade_dict.get("lots", 0.01)),
            sl=float(trade_dict.get("sl", 0) or 0),
            tp=float(trade_dict.get("tp", 0) or 0),
        )
        if result.get("success") and result.get("ticket"):
            ticket = int(result["ticket"])
            self._my_tickets.add(ticket)
            self._ticket_added_at[ticket] = time.time()
            self._save_tickets()
        return result

    def close_trade(self, ticket: int) -> dict:
        """Schliesst eine offene Position. Bot-ID wird als Metadatum mitgesendet."""
        if not self._bridge:
            return {"success": False, "error": "Bridge nicht verbunden"}
        result = self._bridge.close_position(ticket=ticket)
        if result.get("success"):
            self._my_tickets.discard(ticket)
            self._save_tickets()
        return result

    # ── MT5-Fehler-Empfang und Anzeige (C3) ────────────────────────────

    def on_mt5_error(self, error: str) -> None:
        """
        Wird aufgerufen wenn die Bridge einen MT5-Fehler an diesen Bot weiterleitet (C3).
        Subklassen koennen diese Methode ueberschreiben fuer spezifisches Error-Handling.
        """
        self.log("error", "MT5-Fehler", error)

    # ── Parameter-Unterstuetzung (Settings-Editor in AlphaTrack) ────────

    def get_parameters(self) -> dict | None:
        """
        Liefert die im AlphaTrack Settings-Editor editierbaren Parameter.
        Subklassen ueberschreiben diese Methode und geben ein dict zurueck,
        z.B. {"hold_minutes": 10, "interval_minutes": 30}.
        Standard: None — keine Parameter, Editor zeigt Hinweistext.
        """
        return None

    def apply_parameters(self, params: dict) -> None:
        """
        Wendet via set_parameters empfangene Parameter an.
        Standard: Werte in config['strategy'] mergen und in config.json
        persistieren (restart-safe). Subklassen koennen ueberschreiben.
        """
        self._config.setdefault("strategy", {}).update(params)
        self._persist_parameters(params)

    def _persist_parameters(self, params: dict) -> None:
        """Schreibt Parameter zurueck in config.json."""
        config_path = os.path.join(os.path.dirname(sys.argv[0]), self.CONFIG_FILE)
        if not os.path.exists(config_path):
            config_path = self.CONFIG_FILE
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                cfg = json.load(f)
            cfg.setdefault("strategy", {}).update(params)
            tmp_path = config_path + ".tmp"
            with open(tmp_path, "w", encoding="utf-8") as f:
                json.dump(cfg, f, indent=2, ensure_ascii=False)
            os.replace(tmp_path, config_path)
        except Exception as e:
            self.log("error", "Parameter-Persistenz fehlgeschlagen", str(e))

    # ── Strategie-Tick (muss von Subklasse implementiert werden) ────────

    def on_tick(self, candles: list, positions: list) -> dict:
        """
        Wird bei jedem Tick aufgerufen. Muss von der Subklasse implementiert werden.

        Returns dict mit:
            action: 'buy' | 'sell' | 'close' | 'hold'
            lots: float (bei buy/sell)
            sl: float (optional)
            tp: float (optional)
            ticket: int (bei close)
        """
        raise NotImplementedError("on_tick() muss von der Bot-Subklasse implementiert werden")

    # ── Haupt-Loop ──────────────────────────────────────────────────────

    def _process_commands(self) -> None:
        """Verarbeitet eingehende Commands von der Bridge."""
        if not self._ws_client:
            return
        while True:
            cmd = self._ws_client.get_command()
            if cmd is None:
                break
            command = cmd.get("command", "")
            cmd_id = cmd.get("cmd_id", "")

            if command == "stop":
                self._state = "stopped"
                self.log("warn", "Bot gestoppt via Command")
            elif command == "pause":
                self._state = "paused"
                self.log("warn", "Bot pausiert via Command")
            elif command in ("start", "resume"):
                self._state = "running"
                self.log("info", "Bot fortgesetzt via Command")
            elif command == "restart":
                self._restart_requested = True
                self._running = False
            elif command == "mt5_error":
                error_msg = cmd.get("payload", {}).get("error", "Unbekannter MT5-Fehler")
                self.on_mt5_error(error_msg)
            elif command == "set_parameters":
                payload = cmd.get("payload") or {}
                params = payload.get("parameters") or {}
                if isinstance(params, dict) and params:
                    self.apply_parameters(params)
                    self.log("info", "Parameter aktualisiert", json.dumps(params))
                else:
                    self.log("warn", "set_parameters ohne parameters-Objekt empfangen")
            elif command == "close_position":
                payload = cmd.get("payload") or {}
                ticket = int(payload.get("ticket", 0))
                result = self.close_trade(ticket) if self._bridge else {"success": False, "error": "Bridge offline"}
                self._ws_client.send_trade_result(cmd_id, result.get("success", False), error=result.get("error"))
                self.log("info" if result.get("success") else "error", f"CLOSE #{ticket}", result.get("error"))
            elif command == "execute_trade":
                payload = cmd.get("payload") or {}
                result = self.send_trade(payload)
                self._ws_client.send_trade_result(
                    cmd_id, result.get("success", False),
                    ticket=result.get("ticket"), price=result.get("price"),
                    error=result.get("error")
                )

    def run(self) -> None:
        """Startet den Bot-Loop. Blockiert bis zum Beenden."""
        try:
            self._config = self.load_config()

            if not self._connect_and_register():
                sys.exit(1)

            # Tickets erst NACH der Registrierung laden — die Bridge kann die
            # bot_id aendern, und der Dateiname haengt von der finalen ID ab
            self._load_tickets()

            cfg = self._config
            self._log = BotLog(bot_id=self.bot_id, bot_name=self.name)
            if cfg.get("alphatrack_url"):
                self._log.configure_push(cfg["alphatrack_url"], cfg.get("api_key", ""))

            self._bridge = BridgeClient(cfg["bridge_url"], cfg["api_key"], bot_id=self.bot_id)

            symbol = cfg.get("strategy", {}).get("symbol", "EURUSDp")
            timeframe = cfg.get("strategy", {}).get("timeframe", "M5")
            candles_count = int(cfg.get("strategy", {}).get("candles_count", 100))
            max_positions = int(cfg.get("strategy", {}).get("max_positions", 1))
            heartbeat_interval_sec = cfg.get("heartbeat_interval_sec", 10)

            self._state = "running"
            self._running = True
            start_time = time.time()
            last_tick = last_heartbeat = 0.0

            self.log("info", f"{self.name} gestartet", f"Symbol: {symbol} | TF: {timeframe}")
            self.display_header()

            def shutdown(sig, frame):
                self._running = False

            signal.signal(signal.SIGINT, shutdown)
            signal.signal(signal.SIGTERM, shutdown)

            while self._running:
                now = time.time()
                bridge_ok = self._bridge.is_connected() if self._bridge else False

                if bridge_ok:
                    positions = self._bridge.get_positions()
                    all_tickets = {int(p["ticket"]) for p in positions if p.get("ticket")}
                    self._prune_tickets(all_tickets)  # prune closed trades (mit Grace-Period)
                    my_positions = [p for p in positions if int(p.get("ticket", 0)) in self._my_tickets]
                    self._open_positions = len(my_positions)

                self._process_commands()

                # Tick-Intervall pro Iteration aus der Config lesen — damit ist es
                # via Settings-Editor (set_parameters) live aenderbar (Standard: 60s)
                try:
                    tick_interval_sec = float(self._config.get("strategy", {}).get("tick_interval_sec", 60))
                except (TypeError, ValueError):
                    tick_interval_sec = 60.0
                if tick_interval_sec < 1:
                    tick_interval_sec = 1.0

                if self._state == "running" and bridge_ok and now - last_tick >= tick_interval_sec:
                    try:
                        candles = self._bridge.get_candles(symbol, timeframe, candles_count)
                        positions = self._bridge.get_positions()
                        all_tickets = {int(p["ticket"]) for p in positions if p.get("ticket")}
                        self._prune_tickets(all_tickets)
                        my_positions = [p for p in positions if int(p.get("ticket", 0)) in self._my_tickets]
                        signal_result = self.on_tick(candles, my_positions)
                        action = signal_result.get("action", "hold")
                        open_count = len([p for p in my_positions if p.get("instrument") == symbol])

                        if action == "buy" and open_count < max_positions:
                            result = self.send_trade({**signal_result, "symbol": symbol, "direction": "buy"})
                            self.log("info" if result.get("success") else "error",
                                     f"BUY {signal_result.get('lots')} {symbol}", result.get("error"))

                        elif action == "sell" and open_count < max_positions:
                            result = self.send_trade({**signal_result, "symbol": symbol, "direction": "sell"})
                            self.log("info" if result.get("success") else "error",
                                     f"SELL {signal_result.get('lots')} {symbol}", result.get("error"))

                        elif action == "close":
                            ticket = signal_result.get("ticket")
                            if ticket:
                                result = self.close_trade(ticket=int(ticket))
                                self.log("info" if result.get("success") else "error",
                                         f"CLOSE #{ticket}", result.get("error"))

                    except Exception as exc:
                        self.log("error", "Strategie-Fehler", str(exc))
                    last_tick = now

                if now - last_heartbeat >= heartbeat_interval_sec and self._ws_client:
                    self._ws_client.send_heartbeat(
                        state=self._state,
                        open_positions=self._open_positions,
                        active_symbols=[symbol] if self._open_positions > 0 else [],
                        trades_sync=0,
                        uptime=int(now - start_time),
                        balance=None,
                        currency=None,
                        parameters=self.get_parameters(),
                    )
                    last_heartbeat = now

                time.sleep(1)

            self.log("info", f"{self.name} beendet")
            if self._ws_client:
                self._ws_client.send_heartbeat(
                    state="stopped", open_positions=self._open_positions,
                    active_symbols=[], trades_sync=0,
                    uptime=int(time.time() - start_time), balance=None, currency=None,
                )
                self._ws_client.disconnect()
        finally:
            if self._display is not None:
                self._display.stop()
