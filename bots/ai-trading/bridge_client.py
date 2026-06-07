"""
HTTP-Client fuer die AlphaTrack Bridge.
Jeder Trade wird mit bot_id als Metadatum annotiert (C4: Pflicht).
"""
import uuid
import requests


class BridgeClient:
    def __init__(self, bridge_url: str, api_key: str, bot_id: str = ""):
        self._url = bridge_url.rstrip('/')
        self._headers = {"X-Bot-Api-Key": api_key}
        self._bot_id = bot_id  # Wird als Metadatum in jeden Trade-Request eingefuegt (C4)

    def set_bot_id(self, bot_id: str) -> None:
        """Setzt die Bot-ID fuer Trade-Metadaten (nach Registrierung aufrufen)."""
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

    def execute_trade(self, symbol: str, direction: str, lots: float,
                      sl: float = 0, tp: float = 0) -> dict:
        """Sendet Trade-Order mit bot_id als Metadatum (C4 konform)."""
        try:
            r = requests.post(
                f"{self._url}/command",
                json={
                    "command": "execute_trade",
                    "id": str(uuid.uuid4()),
                    "bot_id": self._bot_id,  # C4: bot_id als Metadatum vor Bridge-Durchgang
                    "payload": {
                        "symbol": symbol,
                        "direction": direction,
                        "lots": lots,
                        "sl": sl,
                        "tp": tp,
                        "bot_id": self._bot_id,  # Auch im Payload fuer Trade-Executor
                    },
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
                    "bot_id": self._bot_id,  # C4: bot_id als Metadatum
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
