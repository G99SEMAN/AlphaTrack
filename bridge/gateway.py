import asyncio
import json
import os
import queue
import threading
import uuid
from datetime import datetime, timedelta
from functools import wraps

import requests
import uvicorn
from fastapi import Depends, FastAPI, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse

app = FastAPI()

_CONFIG_FILE = os.path.join(os.path.dirname(__file__), "config.json")
_EDITABLE_FIELDS = {
    "alphatrack_url", "api_key", "bridge_id", "bridge_name", "profile_id",
    "heartbeat_interval_sec", "trade_sync_interval_sec", "command_server_port",
    "mt5_login", "mt5_password", "mt5_server", "mt5_exe_path",
    "mt5_restart_wait_sec", "mt5_restart_max_attempts", "mt5_startup_wait_sec",
}

config_lock = threading.Lock()
_trade_lock = threading.Lock()

_command_queue: queue.Queue = queue.Queue()
_trade_results: dict = {}
_trade_events: dict = {}
_positions_cache: list = []
_candles_fetcher = None
_history_fetcher = None
_account_fetcher = None
_calendar_fetcher = None
_log_callback = None

# Bot WebSocket registry (bot_id -> WebSocket)
_bots: dict = {}
_bot_versions: dict = {}
_bot_names_to_id: dict = {}
# Pending WS trade results: cmd_id -> asyncio.Event
_ws_trade_events: dict = {}
_ws_trade_results: dict = {}
_ws_trade_lock = threading.Lock()

# Set by configure()
_alphatrack_url: str = ""
_profile_id: str = ""
_api_key: str = ""
_local_ip: str = ""


def configure(alphatrack_url: str, profile_id: str, api_key: str, local_ip: str):
    global _alphatrack_url, _profile_id, _api_key, _local_ip
    _alphatrack_url = alphatrack_url
    _profile_id = profile_id
    _api_key = api_key
    _local_ip = local_ip


def _load_config() -> dict:
    with config_lock:
        with open(_CONFIG_FILE, "r", encoding="utf-8") as f:
            return json.load(f)


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


def set_trade_result(cmd_id: str, result: dict):
    with _trade_lock:
        _trade_results[cmd_id] = result
        evt = _trade_events.get(cmd_id)
    if evt:
        evt.set()


# --- API key auth ---

def _require_api_key(request: Request):
    try:
        expected = _load_config().get("api_key", "")
    except Exception:
        raise HTTPException(status_code=500, detail="Konfiguration nicht lesbar")
    provided = request.headers.get("X-Bot-Api-Key", "")
    if not provided or provided != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


# --- AlphaTrack proxy helpers ---

async def _post_alphatrack(path: str, body: dict, headers: dict = None):
    url = f"{_alphatrack_url}{path}"
    h = headers or {}
    await asyncio.to_thread(requests.post, url, json=body, headers=h, timeout=5)


async def _patch_alphatrack(path: str, body: dict):
    url = f"{_alphatrack_url}{path}"
    await asyncio.to_thread(requests.patch, url, json=body, timeout=5)


# --- Ping keepalive task ---

async def _ping_loop():
    while True:
        await asyncio.sleep(30)
        dead = []
        for bot_id, ws in list(_bots.items()):
            try:
                await ws.send_text(json.dumps({"type": "ping"}))
            except Exception:
                dead.append(bot_id)
        for bot_id in dead:
            _bots.pop(bot_id, None)


@app.on_event("startup")
async def _startup():
    asyncio.create_task(_ping_loop())


# --- WebSocket endpoint ---

@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket, api_key: str = Query(default="")):
    cfg_key = ""
    try:
        cfg_key = _load_config().get("api_key", "")
    except Exception:
        await websocket.close(code=1008)
        return

    if api_key != cfg_key:
        await websocket.close(code=1008)
        return

    await websocket.accept()
    bot_id: str = ""
    bot_name: str = ""
    bot_version: str = ""

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except Exception:
                continue

            mtype = msg.get("type", "")

            if mtype == "register":
                bot_name = msg.get("name", "")
                bot_version = msg.get("version", "1.0.0")

                # Reconnect: reuse existing bot_id if name is known
                if bot_name in _bot_names_to_id:
                    bot_id = _bot_names_to_id[bot_name]
                else:
                    bot_id = str(uuid.uuid4())[:8]
                    _bot_names_to_id[bot_name] = bot_id

                _bots[bot_id] = websocket
                _bot_versions[bot_id] = bot_version

                await websocket.send_text(json.dumps({"type": "registered", "bot_id": bot_id}))

                port = _load_config().get("command_server_port", 8765)
                bot_url = f"http://{_local_ip}:{port}/bot/{bot_id}"
                try:
                    await _post_alphatrack(
                        "/api/bots",
                        {"name": bot_name, "profileId": _profile_id, "url": bot_url, "type": "bot"},
                        {"x-bot-api-key": _api_key},
                    )
                    await _patch_alphatrack(f"/api/bots/{bot_id}", {"url": bot_url})
                except Exception:
                    pass

            elif mtype == "heartbeat":
                if not bot_id:
                    continue
                body = {
                    "bridgeId": bot_id,
                    "status": {
                        "state": msg.get("state", "running"),
                        "lastHeartbeat": "",
                        "botVersion": bot_version,
                        "mt5Connected": True,
                        "openPositions": msg.get("open_positions", 0),
                        "activeSymbols": msg.get("active_symbols", []),
                        "tradesSync": msg.get("trades_sync", 0),
                        "uptime": msg.get("uptime", 0),
                        "balance": msg.get("balance"),
                        "currency": msg.get("currency"),
                    },
                }
                try:
                    await _post_alphatrack("/api/bridge/heartbeat", body)
                except Exception:
                    pass

            elif mtype == "log":
                if not bot_id:
                    continue
                try:
                    await _post_alphatrack("/api/bridge/log", {
                        "botId": bot_id,
                        "level": msg.get("level", "info"),
                        "message": msg.get("message", ""),
                        "details": msg.get("details", ""),
                    })
                except Exception:
                    pass

            elif mtype == "trade_result":
                cmd_id = msg.get("cmd_id", "")
                with _ws_trade_lock:
                    _ws_trade_results[cmd_id] = msg
                    evt = _ws_trade_events.get(cmd_id)
                if evt:
                    evt.set()

            elif mtype == "pong":
                pass

    except WebSocketDisconnect:
        pass
    finally:
        if bot_id:
            _bots.pop(bot_id, None)


# --- HTTP endpoints ---

@app.get("/health")
async def health():
    return {"ok": True, "bots_connected": len(_bots)}


@app.get("/candles")
async def get_candles(
    symbol: str = Query(default="EURUSDp"),
    interval: str = Query(default="M5"),
    count: int = Query(default=50),
):
    if _candles_fetcher is None:
        raise HTTPException(status_code=503, detail="MT5 nicht initialisiert")
    if interval not in ("M1", "M5", "M15", "H1", "H4", "D1"):
        raise HTTPException(status_code=400, detail=f"Ungültiger Intervall: {interval}")
    count = min(count, 200)
    candles = await asyncio.to_thread(_candles_fetcher, symbol, interval, count)
    if not candles:
        raise HTTPException(status_code=503, detail=f"Keine Kerzen für {symbol} - Symbol im MT5 aktiviert?")
    return {"candles": candles, "symbol": symbol}


@app.get("/positions")
async def get_positions():
    return {"positions": _positions_cache}


@app.get("/account")
async def get_account():
    if _account_fetcher is None:
        raise HTTPException(status_code=503, detail="MT5 nicht initialisiert")
    info = await asyncio.to_thread(_account_fetcher)
    if info is None:
        raise HTTPException(status_code=503, detail="Kontodaten nicht verfügbar")
    return info


@app.get("/calendar")
async def get_calendar(
    days_back: int = Query(default=2),
    days_ahead: int = Query(default=7),
):
    if _calendar_fetcher is None:
        raise HTTPException(status_code=503, detail="MT5 nicht initialisiert")
    from_dt = datetime.now() - timedelta(days=days_back)
    to_dt = datetime.now() + timedelta(days=days_ahead)
    try:
        events = await asyncio.to_thread(_calendar_fetcher, from_dt, to_dt)
        return {"events": events, "fetchedAt": datetime.utcnow().isoformat()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/command")
async def receive_command(request: Request, _: None = Depends(_require_api_key)):
    data = await request.json() if await _has_body(request) else {}
    command = data.get("command", "")
    cmd_id = data.get("id", "")
    payload = data.get("payload")

    valid = {"start", "stop", "pause", "resume", "execute_trade", "close_position", "restart"}
    if command not in valid:
        raise HTTPException(status_code=400, detail="Ungültiger Command")

    if command == "close_position":
        if not payload or not payload.get("ticket"):
            raise HTTPException(status_code=400, detail="close_position benötigt ticket")
        evt = threading.Event()
        with _trade_lock:
            _trade_events[cmd_id] = evt
        _command_queue.put({"command": command, "id": cmd_id, "payload": payload})
        ok = await asyncio.to_thread(evt.wait, 10)
        with _trade_lock:
            result = _trade_results.pop(cmd_id, {"success": False, "error": "Kein Ergebnis"})
            _trade_events.pop(cmd_id, None)
        if not ok:
            return JSONResponse({"success": False, "error": "Timeout"}, status_code=504)
        return {"ok": True, **result}

    if command == "execute_trade":
        if not payload or not payload.get("symbol") or not payload.get("direction") or not payload.get("lots"):
            raise HTTPException(status_code=400, detail="execute_trade benötigt symbol, direction, lots")
        evt = threading.Event()
        with _trade_lock:
            _trade_events[cmd_id] = evt
        _command_queue.put({"command": command, "id": cmd_id, "payload": payload})
        ok = await asyncio.to_thread(evt.wait, 10)
        with _trade_lock:
            result = _trade_results.pop(cmd_id, {"success": False, "error": "Kein Ergebnis"})
            _trade_events.pop(cmd_id, None)
        if not ok:
            return JSONResponse({"success": False, "error": "Timeout - MT5 hat nicht geantwortet"}, status_code=504)
        return {"ok": True, **result}

    _command_queue.put({"command": command, "id": cmd_id})
    return {"ok": True}


@app.post("/bot/{bot_id}/command")
async def bot_command(bot_id: str, request: Request, _: None = Depends(_require_api_key)):
    ws = _bots.get(bot_id)
    if ws is None:
        raise HTTPException(status_code=404, detail=f"Bot {bot_id} nicht verbunden")

    data = await request.json() if await _has_body(request) else {}
    command = data.get("command", "")
    cmd_id = data.get("id", str(uuid.uuid4()))
    payload = data.get("payload")

    frame = json.dumps({"type": "command", "cmd_id": cmd_id, "command": command, "payload": payload})

    if command in ("execute_trade", "close_position"):
        loop = asyncio.get_event_loop()
        evt = asyncio.Event()
        with _ws_trade_lock:
            _ws_trade_events[cmd_id] = evt
        try:
            await ws.send_text(frame)
        except Exception:
            with _ws_trade_lock:
                _ws_trade_events.pop(cmd_id, None)
            raise HTTPException(status_code=502, detail="Konnte Command nicht senden")

        try:
            await asyncio.wait_for(evt.wait(), timeout=12)
        except asyncio.TimeoutError:
            with _ws_trade_lock:
                _ws_trade_events.pop(cmd_id, None)
            return JSONResponse({"success": False, "error": "Timeout"}, status_code=504)

        with _ws_trade_lock:
            result = _ws_trade_results.pop(cmd_id, {"success": False, "error": "Kein Ergebnis"})
            _ws_trade_events.pop(cmd_id, None)
        return {"ok": True, **result}

    try:
        await ws.send_text(frame)
    except Exception:
        raise HTTPException(status_code=502, detail="Konnte Command nicht senden")
    return {"ok": True}


@app.get("/config")
async def get_config():
    try:
        return _load_config()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/config")
async def update_config(request: Request, _: None = Depends(_require_api_key)):
    updates = await request.json() if await _has_body(request) else {}
    try:
        changed = []
        with config_lock:
            with open(_CONFIG_FILE, "r", encoding="utf-8") as f:
                cfg = json.load(f)
            for key, value in updates.items():
                if key not in _EDITABLE_FIELDS:
                    continue
                if cfg.get(key) != value:
                    cfg[key] = value
                    changed.append(f"{key} = ****" if "password" in key.lower() else f"{key} = {value}")
            with open(_CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump(cfg, f, indent=2, ensure_ascii=False)
        if changed and _log_callback:
            for entry in changed:
                _log_callback("info", f"Einstellung geaendert: {entry}")
        return {"ok": True, "changed": len(changed)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def _has_body(request: Request) -> bool:
    return int(request.headers.get("content-length", 0)) > 0


def start_server(port: int) -> threading.Thread:
    thread = threading.Thread(
        target=lambda: uvicorn.run(app, host="0.0.0.0", port=port, log_level="warning"),
        daemon=True,
        name="GatewayServer",
    )
    thread.start()
    return thread
