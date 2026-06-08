"""
WebSocket Client fuer die AlphaTrack Bridge (AGPv2 Protokoll).
Nutzt websocket-client (sync, threading-basiert).
"""
import json
import logging
import queue
import socket
import threading
import time
from datetime import datetime, timezone
import uuid as _uuid_mod

import websocket

logger = logging.getLogger(__name__)


def _get_local_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def _agp2_wrap(msg_type: str, payload: dict) -> dict:
    return {
        "agp": "2.0",
        "type": msg_type,
        "id": str(_uuid_mod.uuid4()),
        "ts": datetime.now(timezone.utc).isoformat(),
        "payload": payload,
    }


class BridgeWSClient:
    def __init__(self, bridge_url: str, api_key: str, bot_name: str, bot_version: str,
                 bot_id: str = "", bot_type: str = "bot", bot_port: int = 0):
        ws_url = bridge_url.replace("http://", "ws://").replace("https://", "wss://")
        self._url = f"{ws_url.rstrip('/')}/ws?api_key={api_key}"
        self._name = bot_name
        self._version = bot_version
        self._bot_id_static = bot_id
        self._bot_type = bot_type
        self._bot_port = bot_port
        self._ws: websocket.WebSocket | None = None
        self._bot_id: str | None = None
        self._connected = False
        self._latency_ms: float | None = None
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
                logger.info("WS verbunden: %s", self._url)

                local_ip = _get_local_ip()
                t_reg_start = time.time()
                ws.send(json.dumps(_agp2_wrap("register", {
                    "id": self._bot_id_static,
                    "name": self._name,
                    "version": self._version,
                    "component_type": self._bot_type,
                    "ip": local_ip,
                    "port": self._bot_port,
                })))

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

                    _is_agpv2 = msg.get("agp") == "2.0"
                    if _is_agpv2:
                        msg_type = msg.get("type", "")
                        inner = msg.get("payload", {})
                        effective = {**msg, **(inner if isinstance(inner, dict) else {})}
                    else:
                        msg_type = msg.get("type", "")
                        effective = msg

                    if msg_type == "registered":
                        self._bot_id = effective.get("bot_id")
                        self._latency_ms = round((time.time() - t_reg_start) * 1000, 1)
                        self._registered_event.set()
                        logger.info("Bot registriert: %s (Latenz: %sms)", self._bot_id, self._latency_ms)
                    elif msg_type == "command":
                        self._cmd_queue.put({
                            "command": effective.get("command"),
                            "cmd_id": effective.get("cmd_id", ""),
                            "payload": effective.get("payload"),
                        })
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
        registered = self._registered_event.wait(timeout=10)
        if not registered:
            logger.error("WS: Registrierung Timeout (10s)")
        return registered

    def is_connected(self) -> bool:
        return self._connected

    def get_bot_id(self) -> str | None:
        return self._bot_id

    def get_latency_ms(self) -> float | None:
        return self._latency_ms

    def send_heartbeat(self, state: str, open_positions: int, active_symbols: list,
                       trades_sync: int, uptime: int,
                       balance: float | None, currency: str | None) -> None:
        payload: dict = {
            "state": state,
            "open_positions": open_positions,
            "active_symbols": active_symbols,
            "trades_sync": trades_sync,
            "uptime": uptime,
        }
        if balance is not None:
            payload["balance"] = balance
        if currency is not None:
            payload["currency"] = currency
        self._send(_agp2_wrap("heartbeat", payload))

    def send_log(self, level: str, message: str, details: str | None = None) -> None:
        payload: dict = {"level": level, "message": message}
        if details is not None:
            payload["details"] = details
        self._send(_agp2_wrap("log", payload))

    def get_command(self) -> dict | None:
        try:
            return self._cmd_queue.get_nowait()
        except queue.Empty:
            return None

    def send_trade_result(self, cmd_id: str, success: bool,
                          ticket: int | None = None, price: float | None = None,
                          error: str | None = None) -> None:
        payload: dict = {"cmd_id": cmd_id, "success": success, "error": error}
        if ticket is not None:
            payload["ticket"] = ticket
        if price is not None:
            payload["price"] = price
        self._send(_agp2_wrap("trade_result", payload))

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
