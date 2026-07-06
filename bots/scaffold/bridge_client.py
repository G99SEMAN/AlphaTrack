"""
HTTP-Client fuer die AlphaTrack Bridge.
Jeder Trade wird mit bot_id als Metadatum annotiert (C4: Pflicht).
Unterstuetzt AGPv2 UDP-Discovery wenn bridge_url nicht konfiguriert ist.
"""
import json
import os
import socket
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

UDP_BRIDGE_PORT = 8766


def _probe_bridge(url: str, timeout: float = 2.0) -> str | None:
    try:
        r = requests.get(f"{url}/health", timeout=timeout)
        if r.ok:
            return url
    except Exception:
        pass
    return None


def _cache_bridge_url(url: str, config_path: str | None) -> None:
    if not config_path:
        config_path = os.path.join(os.path.dirname(__file__), "config.json")
    try:
        if os.path.exists(config_path):
            with open(config_path, "r", encoding="utf-8") as f:
                cfg = json.load(f)
            cfg["bridge_url"] = url
            with open(config_path, "w", encoding="utf-8") as f:
                json.dump(cfg, f, indent=2, ensure_ascii=False)
    except Exception:
        pass


def discover_bridge(timeout: float = 10.0, config_path: str | None = None) -> str | None:
    """Findet Bridge via UDP-Broadcast oder HTTP-Scan 192.168.178.1-254."""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind(("", UDP_BRIDGE_PORT))
        sock.settimeout(min(3.0, timeout))
        deadline = time.time() + 3.0
        while time.time() < deadline:
            try:
                data, _ = sock.recvfrom(1024)
                msg = json.loads(data.decode("utf-8"))
                if msg.get("type") == "bridge_announce" and msg.get("agp") == "2.0":
                    ip = msg.get("ip", "")
                    port = msg.get("port", 8765)
                    if ip:
                        url = f"http://{ip}:{port}"
                        _cache_bridge_url(url, config_path)
                        return url
            except socket.timeout:
                break
            except Exception:
                continue
    except Exception:
        pass
    finally:
        try:
            sock.close()
        except Exception:
            pass

    candidates = [f"http://192.168.178.{i}:8765" for i in range(1, 255)]
    with ThreadPoolExecutor(max_workers=30) as ex:
        futures = {ex.submit(_probe_bridge, url, 2.0): url for url in candidates}
        for future in as_completed(futures):
            result = future.result()
            if result:
                for f in futures:
                    f.cancel()
                _cache_bridge_url(result, config_path)
                return result
    return None


class BridgeClient:
    def __init__(self, bridge_url: str, api_key: str, bot_id: str = "",
                 config_path: str | None = None):
        if not bridge_url or not bridge_url.strip():
            print("[DISC] bridge_url nicht konfiguriert — suche Bridge im Netz ...")
            found = discover_bridge(timeout=10.0, config_path=config_path)
            if found:
                print(f"[OK] Bridge gefunden: {found}")
                bridge_url = found
            else:
                print("[WARN] Bridge nicht gefunden")
                bridge_url = "http://localhost:8765"
        self._url = bridge_url.rstrip('/')
        self._headers = {"X-Bot-Api-Key": api_key}
        self._bot_id = bot_id
        self._config_path = config_path

    def set_bot_id(self, bot_id: str) -> None:
        self._bot_id = bot_id

    def is_connected(self) -> bool:
        try:
            r = requests.get(f"{self._url}/health", timeout=3)
            return r.ok
        except Exception:
            return False

    def get_candles(self, symbol: str, interval: str, count: int) -> list:
        try:
            r = requests.get(
                f"{self._url}/candles",
                params={"symbol": symbol, "interval": interval, "count": count},
                timeout=10,
            )
            return r.json().get("candles", []) if r.ok else []
        except Exception:
            return []

    def get_positions(self) -> list:
        try:
            r = requests.get(f"{self._url}/positions", timeout=5)
            return r.json().get("positions", []) if r.ok else []
        except Exception:
            return []

    def get_account_info(self) -> dict | None:
        try:
            r = requests.get(f"{self._url}/account", timeout=5)
            return r.json() if r.ok else None
        except Exception:
            return None

    def get_tick(self, symbol: str) -> dict | None:
        """Aktueller Bid/Ask/Spread — fuer Spread-Filter vor Order-Eroeffnung."""
        try:
            r = requests.get(f"{self._url}/tick", params={"symbol": symbol}, timeout=5)
            return r.json() if r.ok else None
        except Exception:
            return None

    def get_calendar(self, days_back: int = 1, days_ahead: int = 1) -> list:
        """Forex-Wirtschaftskalender — fuer News-Blackout-Filter."""
        try:
            r = requests.get(
                f"{self._url}/calendar",
                params={"days_back": days_back, "days_ahead": days_ahead},
                timeout=8,
            )
            return r.json().get("events", []) if r.ok else []
        except Exception:
            return []

    def get_history(self) -> list:
        """Abgeschlossene Trades (alle Bots) — fuer Verlustserien-Erkennung."""
        try:
            r = requests.get(f"{self._url}/history", timeout=8)
            return r.json().get("deals", []) if r.ok else []
        except Exception:
            return []

    def execute_trade(self, symbol: str, direction: str, lots: float,
                      sl: float = 0, tp: float = 0,
                      sl_pips: float = 0, tp_pips: float = 0) -> dict:
        """Sendet Trade-Order mit bot_id als Metadatum (C4 konform)."""
        try:
            payload = {
                "symbol": symbol,
                "direction": direction,
                "lots": lots,
                "sl": sl,
                "tp": tp,
                "bot_id": self._bot_id,
            }
            if sl_pips > 0:
                payload["slPips"] = sl_pips
            if tp_pips > 0:
                payload["tpPips"] = tp_pips
            r = requests.post(
                f"{self._url}/command",
                json={
                    "command": "execute_trade",
                    "id": str(uuid.uuid4()),
                    "bot_id": self._bot_id,
                    "payload": payload,
                },
                headers=self._headers,
                timeout=15,
            )
            return r.json() if r.ok else {"success": False, "error": f"HTTP {r.status_code}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def close_position(self, ticket: int) -> dict:
        """Schliesst Position — bot_id als Metadatum mitschicken (C4 konform)."""
        try:
            r = requests.post(
                f"{self._url}/command",
                json={
                    "command": "close_position",
                    "id": str(uuid.uuid4()),
                    "bot_id": self._bot_id,
                    "payload": {
                        "ticket": ticket,
                        "bot_id": self._bot_id,
                    },
                },
                headers=self._headers,
                timeout=15,
            )
            return r.json() if r.ok else {"success": False, "error": f"HTTP {r.status_code}"}
        except Exception as e:
            return {"success": False, "error": str(e)}
