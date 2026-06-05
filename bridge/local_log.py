"""
Lokales Log für die AlphaTrack Bridge.
Speichert Einträge in bridge_log.json und pusht sie asynchron an AlphaTrack.
"""

import json
import os
import queue
import tempfile
import threading
import time
import uuid
from datetime import datetime, timezone

try:
    import requests as _requests
except ImportError:
    _requests = None

MAX_ENTRIES = 5000
_LOG_FILE = os.path.join(os.path.dirname(__file__), "bridge_log.json")

_LEVEL_MAP = {"ok": "info", "info": "info", "warn": "warn", "error": "error"}


def _nanoid() -> str:
    return uuid.uuid4().hex[:10]


class LocalLog:
    def __init__(self, bridge_id: str, bridge_name: str):
        self._bridge_id = bridge_id
        self._bridge_name = bridge_name
        self._lock = threading.Lock()
        self._push_url: str | None = None
        self._push_api_key: str = ""
        # Single persistent worker thread instead of one thread per log entry.
        self._push_queue: queue.Queue = queue.Queue()
        self._worker = threading.Thread(target=self._push_worker, daemon=True, name="LogPush")
        self._worker.start()

    def configure_push(self, alphatrack_url: str, api_key: str) -> None:
        """Konfiguriert den Live-Push neuer Einträge zu AlphaTrack."""
        self._push_url = alphatrack_url
        self._push_api_key = api_key

    def add(self, level: str, message: str, details: str = None) -> None:
        entry = {
            "id": _nanoid(),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": _LEVEL_MAP.get(level, "info"),
            "message": message,
            "details": details,
            "bridgeId": self._bridge_id,
            "bridgeName": self._bridge_name,
        }
        with self._lock:
            entries = self._read()
            entries.insert(0, entry)
            entries = entries[:MAX_ENTRIES]
            self._write(entries)

        if self._push_url and _requests:
            self._push_queue.put_nowait(entry)

    def get_all(self) -> list:
        with self._lock:
            return self._read()

    def _push_worker(self) -> None:
        while True:
            try:
                entry = self._push_queue.get(timeout=1)
            except queue.Empty:
                continue
            if self._push_url and _requests:
                self._push_entry(entry)
            self._push_queue.task_done()

    def _push_entry(self, entry: dict) -> None:
        try:
            _requests.post(
                f"{self._push_url}/api/bridge/logs/bulk",
                json={"bridgeId": self._bridge_id, "entries": [entry]},
                headers={
                    "Content-Type": "application/json",
                    "x-bot-api-key": self._push_api_key,
                },
                timeout=5,
            )
        except Exception:
            pass  # Offline - Eintrag bleibt lokal erhalten

    def _read(self) -> list:
        try:
            with open(_LOG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return []

    def _write(self, entries: list) -> None:
        dir_ = os.path.dirname(_LOG_FILE) or "."
        fd, tmp = tempfile.mkstemp(dir=dir_, suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(entries, f, ensure_ascii=False, indent=2)
            for attempt in range(5):
                try:
                    os.replace(tmp, _LOG_FILE)
                    return
                except PermissionError:
                    if attempt < 4:
                        time.sleep(0.05 * (attempt + 1))
            os.replace(tmp, _LOG_FILE)
        except Exception:
            try:
                os.unlink(tmp)
            except OSError:
                pass
            raise
