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

# Importpfad beachten: PYTHONPATH muss auf bridge/ gesetzt sein (via start.bat)
# und bot-Verzeichnis muss im sys.path sein.

try:
    from ws_client import BridgeWSClient
    from bridge_client import BridgeClient
except ImportError as e:
    raise ImportError(
        f"BaseBot konnte ws_client/bridge_client nicht importieren: {e}\n"
        "Stelle sicher, dass PYTHONPATH auf bridge/ gesetzt ist (start.bat)."
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
        self._running = False
        self._state = "starting"
        self._open_positions: int = 0
        self._restart_requested = False

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
        Zeigt den statischen Terminal-Header des Bots an.
        Felder: ID, Name, IP:Port, Latenz, AlphaTrack-Status, Bridge-Status, Offene Trades.
        """
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
        Bridge-interne Logs oder Logs anderer Bots werden NICHT geschrieben.
        """
        if self._log:
            self._log.add(level, message, details)
        if self._ws_client:
            self._ws_client.send_log(level, message, details)

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
        return self._bridge.execute_trade(
            symbol=trade_dict["symbol"],
            direction=trade_dict["direction"],
            lots=float(trade_dict.get("lots", 0.01)),
            sl=float(trade_dict.get("sl", 0) or 0),
            tp=float(trade_dict.get("tp", 0) or 0),
        )

    def close_trade(self, ticket: int) -> dict:
        """Schliesst eine offene Position. Bot-ID wird als Metadatum mitgesendet."""
        if not self._bridge:
            return {"success": False, "error": "Bridge nicht verbunden"}
        return self._bridge.close_position(ticket=ticket)

    # ── MT5-Fehler-Empfang und Anzeige (C3) ────────────────────────────

    def on_mt5_error(self, error: str) -> None:
        """
        Wird aufgerufen wenn die Bridge einen MT5-Fehler an diesen Bot weiterleitet (C3).
        Subklassen koennen diese Methode ueberschreiben fuer spezifisches Error-Handling.
        """
        print(f"[MT5-FEHLER] {error}")
        self.log("error", f"MT5-Fehler", error)

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
        self._config = self.load_config()

        if not self._connect_and_register():
            sys.exit(1)

        cfg = self._config
        self._log = BotLog(bot_id=self.bot_id, bot_name=self.name)
        if cfg.get("alphatrack_url"):
            self._log.configure_push(cfg["alphatrack_url"], cfg.get("api_key", ""))

        self._bridge = BridgeClient(cfg["bridge_url"], cfg["api_key"], bot_id=self.bot_id)

        symbol = cfg.get("strategy", {}).get("symbol", "EURUSDp")
        timeframe = cfg.get("strategy", {}).get("timeframe", "M5")
        candles_count = int(cfg.get("strategy", {}).get("candles_count", 100))
        max_positions = int(cfg.get("strategy", {}).get("max_positions", 1))
        tick_interval_sec = 60
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
                self._open_positions = len(positions)

            self._process_commands()

            if self._state == "running" and bridge_ok and now - last_tick >= tick_interval_sec:
                try:
                    candles = self._bridge.get_candles(symbol, timeframe, candles_count)
                    positions = self._bridge.get_positions()
                    signal_result = self.on_tick(candles, positions)
                    action = signal_result.get("action", "hold")
                    open_count = len([p for p in positions if p.get("instrument") == symbol])

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
