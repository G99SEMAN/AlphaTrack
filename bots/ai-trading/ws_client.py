"""
WebSocket Client für die AlphaTrack Bridge (AGP/1 Protokoll).
"""
import json
import logging
import queue
import threading
import time

import websocket

logger = logging.getLogger(__name__)


class BridgeWSClient:
    def __init__(self, bridge_url: str, api_key: str, bot_name: str, bot_version: str):
        ws_url = bridge_url.replace("http://", "ws://").replace("https://", "wss://")
        self._url = f"{ws_url.rstrip('/')}/ws?api_key={api_key}"
        self._name = bot_name
        self._version = bot_version
        self._ws: websocket.WebSocket | None = None
        self._bot_id: str | None = None
        self._connected = False
        self._cmd_queue: queue.Queue = queue.Queue()
        self._registered_event = threading.Event()
        self._lock = threading.Lock()
        self._receiver_thread: threading.Thread | None = None
        self._stop_event = threading.Event()

    def _send(self, msg: dict) -> None:
        with self._lock:
            if self._ws and self._connected:
                try:
                    self._ws.send(json.dumps(msg))
                except Exception as exc:
                    logger.warning("WS send error: %s", exc)
                    self._connected = False

    def _run(self) -> None:
        attempts = 0
        while not self._stop_event.is_set():
            try:
                ws = websocket.WebSocket()
                ws.connect(self._url, timeout=10)
                with self._lock:
                    self._ws = ws
                    self._connected = True
                attempts = 0

                ws.send(json.dumps({"type": "register", "name": self._name, "version": self._version}))

                while not self._stop_event.is_set():
                    try:
                        raw = ws.recv()
                    except websocket.WebSocketTimeoutException:
                        continue
                    except Exception as exc:
                        logger.warning("WS recv error: %s", exc)
                        break

                    if not raw:
                        continue
                    try:
                        msg = json.loads(raw)
                    except json.JSONDecodeError:
                        continue

                    msg_type = msg.get("type")
                    if msg_type == "registered":
                        self._bot_id = msg.get("bot_id")
                        self._registered_event.set()
                    elif msg_type == "command":
                        self._cmd_queue.put({"command": msg.get("command"),
                                             "cmd_id": msg.get("cmd_id", ""),
                                             "payload": msg.get("payload")})
                    elif msg_type == "ping":
                        self._send({"type": "pong"})

            except Exception as exc:
                logger.warning("WS Verbindungsfehler: %s", exc)

            with self._lock:
                self._connected = False
                self._ws = None

            if self._stop_event.is_set():
                break
            attempts += 1
            if attempts >= 3:
                logger.error("WS: Mehr als 3 Verbindungsversuche fehlgeschlagen")
                attempts = 0
            time.sleep(5)

    def connect(self) -> bool:
        self._stop_event.clear()
        self._registered_event.clear()
        self._receiver_thread = threading.Thread(target=self._run, daemon=True, name="WSReceiver")
        self._receiver_thread.start()
        return self._registered_event.wait(timeout=10)

    def is_connected(self) -> bool:
        return self._connected

    def get_bot_id(self) -> str | None:
        return self._bot_id

    def send_heartbeat(self, state: str, open_positions: int, active_symbols: list,
                       trades_sync: int, uptime: int,
                       balance: float | None, currency: str | None) -> None:
        msg: dict = {"type": "heartbeat", "state": state, "open_positions": open_positions,
                     "active_symbols": active_symbols, "trades_sync": trades_sync, "uptime": uptime}
        if balance is not None:
            msg["balance"] = balance
        if currency is not None:
            msg["currency"] = currency
        self._send(msg)

    def send_log(self, level: str, message: str, details: str | None = None) -> None:
        msg: dict = {"type": "log", "level": level, "message": message}
        if details is not None:
            msg["details"] = details
        self._send(msg)

    def get_command(self) -> dict | None:
        try:
            return self._cmd_queue.get_nowait()
        except queue.Empty:
            return None

    def send_trade_result(self, cmd_id: str, success: bool,
                          ticket: int | None = None, price: float | None = None,
                          error: str | None = None) -> None:
        msg: dict = {"type": "trade_result", "cmd_id": cmd_id, "success": success, "error": error}
        if ticket is not None:
            msg["ticket"] = ticket
        if price is not None:
            msg["price"] = price
        self._send(msg)

    def disconnect(self) -> None:
        self._stop_event.set()
        with self._lock:
            self._connected = False
            if self._ws:
                try:
                    self._ws.close()
                except Exception:
                    pass
                self._ws = None
