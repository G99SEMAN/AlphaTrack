import json
import os
import threading
import queue
from functools import wraps
from flask import Flask, request, jsonify


app = Flask(__name__)
_command_queue: queue.Queue = queue.Queue()

_CONFIG_FILE = os.path.join(os.path.dirname(__file__), "config.json")

_EDITABLE_FIELDS = {
    "alphatrack_url", "api_key", "bridge_id", "bridge_name", "profile_id",
    "heartbeat_interval_sec", "trade_sync_interval_sec", "command_server_port",
    "mt5_login", "mt5_password", "mt5_server", "mt5_exe_path",
    "mt5_restart_wait_sec", "mt5_restart_max_attempts", "mt5_startup_wait_sec",
}

# config_lock: shared with main.py to prevent concurrent config.json reads/writes.
# _trade_lock: protects _trade_results/_trade_events from concurrent Flask threads.
config_lock = threading.Lock()
_trade_lock = threading.Lock()


def _load_config() -> dict:
    with config_lock:
        with open(_CONFIG_FILE, "r", encoding="utf-8") as f:
            return json.load(f)


def _require_api_key(f):
    """Decorator: validates X-Bot-Api-Key header against config api_key."""
    @wraps(f)
    def decorated(*args, **kwargs):
        try:
            expected = _load_config().get("api_key", "")
        except Exception:
            return jsonify({"error": "Konfiguration nicht lesbar"}), 500
        provided = request.headers.get("X-Bot-Api-Key", "")
        if not provided or provided != expected:
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated


# Für execute_trade / close_position: synchrone Antwort über Events
_trade_results: dict = {}
_trade_events: dict = {}

# Live-Positions-Cache (wird von main.py befüllt)
_positions_cache: list = []

# Kerzen-Fetcher (wird von main.py nach MT5-Init injiziert)
_candles_fetcher = None
_history_fetcher = None
_account_fetcher = None
_calendar_fetcher = None

# Log-Callback (wird von main.py nach LocalLog-Init injiziert)
_log_callback = None


def update_positions_cache(positions: list):
    global _positions_cache
    _positions_cache = positions


def set_candles_fetcher(func):
    global _candles_fetcher
    _candles_fetcher = func


def set_history_fetcher(func):
    global _history_fetcher
    _history_fetcher = func


def set_account_fetcher(func):
    global _account_fetcher
    _account_fetcher = func


def set_calendar_fetcher(func):
    global _calendar_fetcher
    _calendar_fetcher = func


def set_log_callback(func):
    global _log_callback
    _log_callback = func


def get_command_queue() -> queue.Queue:
    return _command_queue


@app.route("/command", methods=["POST"])
@_require_api_key
def receive_command():
    data = request.get_json(silent=True) or {}
    command = data.get("command", "")
    cmd_id = data.get("id", "")
    payload = data.get("payload")

    valid = {"start", "stop", "pause", "resume", "execute_trade", "close_position", "restart"}
    if command not in valid:
        return jsonify({"error": "Ungültiger Command"}), 400

    if command == "close_position":
        if not payload or not payload.get("ticket"):
            return jsonify({"error": "close_position benötigt ticket"}), 400

        evt = threading.Event()
        with _trade_lock:
            _trade_events[cmd_id] = evt
        _command_queue.put({"command": command, "id": cmd_id, "payload": payload})
        print(f"[CMD] close_position empfangen: Ticket={payload.get('ticket')} (id={cmd_id})")

        if evt.wait(timeout=10):
            with _trade_lock:
                result = _trade_results.pop(cmd_id, {"success": False, "error": "Kein Ergebnis"})
                _trade_events.pop(cmd_id, None)
            return jsonify({"ok": True, **result})
        else:
            with _trade_lock:
                _trade_events.pop(cmd_id, None)
            return jsonify({"success": False, "error": "Timeout"}), 504

    if command == "execute_trade":
        if not payload or not payload.get("symbol") or not payload.get("direction") or not payload.get("lots"):
            return jsonify({"error": "execute_trade benötigt symbol, direction, lots"}), 400

        evt = threading.Event()
        with _trade_lock:
            _trade_events[cmd_id] = evt
        _command_queue.put({"command": command, "id": cmd_id, "payload": payload})
        print(f"[CMD] execute_trade empfangen: {payload.get('direction','?').upper()} {payload.get('lots','?')} {payload.get('symbol','?')} (id={cmd_id})")

        if evt.wait(timeout=10):
            with _trade_lock:
                result = _trade_results.pop(cmd_id, {"success": False, "error": "Kein Ergebnis"})
                _trade_events.pop(cmd_id, None)
            return jsonify({"ok": True, **result})
        else:
            with _trade_lock:
                _trade_events.pop(cmd_id, None)
            return jsonify({"success": False, "error": "Timeout - MT5 hat nicht geantwortet"}), 504

    _command_queue.put({"command": command, "id": cmd_id})
    print(f"[CMD] Empfangen: {command} (id={cmd_id})")
    return jsonify({"ok": True})


def set_trade_result(cmd_id: str, result: dict):
    """Wird von main.py aufgerufen nachdem execute_trade verarbeitet wurde."""
    with _trade_lock:
        _trade_results[cmd_id] = result
        evt = _trade_events.get(cmd_id)
    if evt:
        evt.set()


@app.route("/candles", methods=["GET"])
def get_candles():
    if _candles_fetcher is None:
        return jsonify({"error": "MT5 nicht initialisiert"}), 503

    symbol = request.args.get("symbol", "EURUSDp")
    interval = request.args.get("interval", "M5")
    try:
        count = min(int(request.args.get("count", "50")), 200)
    except ValueError:
        count = 50

    if interval not in ("M1", "M5", "M15", "H1", "H4", "D1"):
        return jsonify({"error": f"Ungültiger Intervall: {interval}"}), 400

    candles = _candles_fetcher(symbol, interval, count)
    if not candles:
        return jsonify({"error": f"Keine Kerzen für {symbol} - Symbol im MT5 aktiviert?"}), 503

    return jsonify({"candles": candles, "symbol": symbol})


@app.route("/positions", methods=["GET"])
def get_positions():
    return jsonify({"positions": _positions_cache})


@app.route("/history", methods=["GET"])
def get_history():
    if _history_fetcher is None:
        return jsonify({"error": "MT5 nicht initialisiert"}), 503
    try:
        deals = _history_fetcher(from_timestamp=0.0)
        return jsonify({"deals": deals, "count": len(deals)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/account", methods=["GET"])
def get_account():
    if _account_fetcher is None:
        return jsonify({"error": "MT5 nicht initialisiert"}), 503
    info = _account_fetcher()
    if info is None:
        return jsonify({"error": "Kontodaten nicht verfügbar"}), 503
    return jsonify(info)


@app.route("/calendar", methods=["GET"])
def get_calendar():
    from datetime import datetime, timedelta
    if _calendar_fetcher is None:
        return jsonify({"error": "MT5 nicht initialisiert"}), 503
    try:
        days_back = int(request.args.get("days_back", "2"))
        days_ahead = int(request.args.get("days_ahead", "7"))
        from_dt = datetime.now() - timedelta(days=days_back)
        to_dt = datetime.now() + timedelta(days=days_ahead)
        events = _calendar_fetcher(from_dt, to_dt)
        return jsonify({"events": events, "fetchedAt": datetime.utcnow().isoformat()})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/config", methods=["GET"])
def get_config():
    try:
        return jsonify(_load_config())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/config", methods=["POST"])
@_require_api_key
def update_config():
    updates = request.get_json(silent=True) or {}
    try:
        changed = []
        # Atomic read-modify-write inside a single lock acquisition (fixes H6).
        with config_lock:
            with open(_CONFIG_FILE, "r", encoding="utf-8") as f:
                config = json.load(f)
            for key, value in updates.items():
                if key not in _EDITABLE_FIELDS:
                    continue
                if config.get(key) != value:
                    config[key] = value
                    changed.append(f"{key} = ****" if "password" in key.lower() else f"{key} = {value}")
            with open(_CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
        if changed and _log_callback:
            for entry in changed:
                _log_callback("info", f"Einstellung geaendert: {entry}")
        return jsonify({"ok": True, "changed": len(changed)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"ok": True})


def start_server(port: int):
    thread = threading.Thread(
        target=lambda: app.run(host="0.0.0.0", port=port, use_reloader=False),
        daemon=True,
        name="CommandServer",
    )
    thread.start()
    print(f"[CMD] Flask Command-Server gestartet auf Port {port}")
    return thread
