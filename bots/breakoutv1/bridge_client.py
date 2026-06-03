"""
HTTP-Client für die AlphaTrack Bridge.
Ersetzt die direkte MT5-Verbindung im Bot.
"""
import uuid
import requests


class BridgeClient:
    def __init__(self, bridge_url: str, api_key: str):
        self._url = bridge_url.rstrip('/')
        self._headers = {"X-Bot-Api-Key": api_key}

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
                timeout=5,
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

    def execute_trade(self, symbol: str, direction: str, lots: float,
                      sl: float = 0, tp: float = 0) -> dict:
        try:
            r = requests.post(
                f"{self._url}/command",
                json={
                    "command": "execute_trade",
                    "id": str(uuid.uuid4()),
                    "payload": {"symbol": symbol, "direction": direction,
                                "lots": lots, "sl": sl, "tp": tp},
                },
                headers=self._headers,
                timeout=15,
            )
            return r.json() if r.ok else {"success": False, "error": f"HTTP {r.status_code}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def close_position(self, ticket: int) -> dict:
        try:
            r = requests.post(
                f"{self._url}/command",
                json={
                    "command": "close_position",
                    "id": str(uuid.uuid4()),
                    "payload": {"ticket": ticket},
                },
                headers=self._headers,
                timeout=15,
            )
            return r.json() if r.ok else {"success": False, "error": f"HTTP {r.status_code}"}
        except Exception as e:
            return {"success": False, "error": str(e)}
