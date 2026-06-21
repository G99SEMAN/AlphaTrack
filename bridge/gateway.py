import asyncio
import hmac
import json
import os
import tempfile
import queue
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from functools import wraps

import requests
import uvicorn
from fastapi import Depends, FastAPI, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse

from udp_announce import udp_announce_loop, configure as configure_udp

app = FastAPI()

_CONFIG_FILE = os.path.join(os.path.dirname(__file__), "config.json")
_TICKET_REGISTRY_FILE = os.path.join(os.path.dirname(__file__), "ticket_registry.json")
_EDITABLE_FIELDS = {
    "alphatrack_url", "api_key", "bridge_id", "bridge_name", "profile_id",
    "heartbeat_interval_sec", "trade_sync_interval_sec", "command_server_port",
    "mt5_login", "mt5_password", "mt5_server", "mt5_exe_path",
    "mt5_restart_wait_sec", "mt5_restart_max_attempts", "mt5_startup_wait_sec",
}

config_lock = threading.Lock()
_trade_lock = threading.Lock()
_positions_lock = threading.Lock()

_command_queue: queue.Queue = queue.Queue()
_trade_results: dict = {}
_trade_events: dict = {}
_positions_cache: list = []
_candles_fetcher = None
_history_fetcher = None
_historical_candles_fetcher = None
_account_fetcher = None
_calendar_fetcher = None
_log_callback = None
_display_callback = None

# Bot WebSocket registry (bot_id -> WebSocket)
_bots: dict = {}
_bot_versions: dict = {}
_bot_names_to_id: dict = {}
# Full bot identity records: bot_id -> {id, name, type, ip, port, latency}
_bot_identities: dict = {}
# Pending WS trade results: cmd_id -> asyncio.Event
_ws_trade_events: dict = {}
_ws_trade_results: dict = {}
_ws_trade_lock = threading.Lock()
_bots_lock = asyncio.Lock()  # Schützt _bots-Dictionary gegen Race Conditions in _ping_loop

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
    configure_udp(local_ip, profile_id, _load_config)
    _load_ticket_registry()


def _load_config() -> dict:
    with config_lock:
        with open(_CONFIG_FILE, "r", encoding="utf-8") as f:
            return json.load(f)


def _atomic_write_config(data: dict) -> None:
    """Schreibt config.json atomar via tempfile+rename (kein Datenverlust bei Absturz)."""
    tmp_fd, tmp_path = tempfile.mkstemp(
        dir=os.path.dirname(_CONFIG_FILE), suffix=".tmp"
    )
    try:
        with os.fdopen(tmp_fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        os.replace(tmp_path, _CONFIG_FILE)   # atomar auf POSIX und Windows
    except Exception:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise


def update_positions_cache(positions: list):
    global _positions_cache
    with _positions_lock:
        _positions_cache = positions


def get_positions_cache() -> list:
    with _positions_lock:
        return list(_positions_cache)


def set_candles_fetcher(func):
    global _candles_fetcher
    _candles_fetcher = func


def set_history_fetcher(func):
    global _history_fetcher
    _history_fetcher = func


def set_historical_candles_fetcher(func):
    global _historical_candles_fetcher
    _historical_candles_fetcher = func


def set_account_fetcher(func):
    global _account_fetcher
    _account_fetcher = func


def set_calendar_fetcher(func):
    global _calendar_fetcher
    _calendar_fetcher = func


def set_display_callback(func):
    global _display_callback
    _display_callback = func


def set_log_callback(func):
    global _log_callback
    _log_callback = func


def get_command_queue() -> queue.Queue:
    return _command_queue


def get_connected_bot_names() -> list[str]:
    """Returns the names of all currently connected bots (for bridge terminal display)."""
    names = []
    for bot_id in list(_bots.keys()):
        identity = _bot_identities.get(bot_id)
        if identity:
            names.append(identity["name"])
        else:
            # Fallback: Reverse-Lookup ueber _bot_names_to_id
            for name, bid in _bot_names_to_id.items():
                if bid == bot_id:
                    names.append(name)
                    break
    return names


def get_alphatrack_bot_ids() -> dict:
    """Gibt {internal_bot_id: at_bot_id} für alle registrierten Bots zurück."""
    return dict(_alphatrack_bot_ids)


def get_connected_bots_info() -> list[dict]:
    """Liefert pro verbundenem Bot ein dict mit name, at_id und connected_at.

    Nur Bots aus _bots (tatsaechlich per WebSocket verbunden) werden beruecksichtigt.
    at_id ist None solange die AlphaTrack-Registrierung noch aussteht.
    connected_at ist None wenn kein Identity-Record vorhanden (sollte nicht vorkommen).
    """
    result = []
    for bot_id in list(_bots.keys()):
        identity = _bot_identities.get(bot_id)
        if identity:
            name = identity["name"]
            connected_at = identity.get("connected_at")
        else:
            # Fallback: Reverse-Lookup ueber _bot_names_to_id
            name = bot_id
            for n, bid in _bot_names_to_id.items():
                if bid == bot_id:
                    name = n
                    break
            connected_at = None
        result.append({
            "name": name,
            "at_id": _alphatrack_bot_ids.get(bot_id),
            "connected_at": connected_at,
            "state": identity.get("state", "running") if identity else "running",
        })
    return result


def set_trade_result(cmd_id: str, result: dict):
    with _trade_lock:
        _trade_results[cmd_id] = result
        evt = _trade_events.get(cmd_id)
    if evt:
        evt.set()


# Maps cmd_id -> bot_id for MT5 error forwarding (C3)
_cmd_to_bot_id: dict = {}
_cmd_to_bot_lock = threading.Lock()


async def _forward_mt5_error_to_bot(bot_id: str, error_msg: str) -> None:
    """
    Leitet einen MT5-Fehler sofort (near-realtime) an den verursachenden Bot weiter (C3).
    Bridge identifiziert den Bot via bot_id und sendet die Fehlermeldung per WebSocket.
    """
    ws = _bots.get(bot_id)
    if ws is None:
        if _log_callback:
            _log_callback("warn", f"MT5-Fehler-Weiterleitung: Bot {bot_id} nicht verbunden", error_msg)
        return
    try:
        await ws.send_text(json.dumps({
            "type": "command",
            "cmd_id": f"mt5_err_{bot_id}",
            "command": "mt5_error",
            "payload": {"error": error_msg, "bot_id": bot_id},
        }))
        if _log_callback:
            _log_callback("warn", f"MT5-Fehler weitergeleitet an Bot {bot_id}", error_msg)
        if _display_callback:
            _display_callback("warn", "MT5", f"Fehler an Bot {bot_id} weitergeleitet: {error_msg}")
    except Exception as exc:
        if _log_callback:
            _log_callback("error", f"MT5-Fehler-Weiterleitung fehlgeschlagen: {bot_id}", str(exc))


# --- API key auth ---

def _require_api_key(request: Request):
    try:
        expected = _load_config().get("api_key", "")
    except Exception:
        raise HTTPException(status_code=500, detail="Konfiguration nicht lesbar")
    provided = request.headers.get("X-Bot-Api-Key", "")
    if not provided or not hmac.compare_digest(
        provided.encode("utf-8"), expected.encode("utf-8")
    ):
        raise HTTPException(status_code=401, detail="Unauthorized")


# --- AlphaTrack proxy helpers ---

# Maps bridge-internal bot_id → AlphaTrack nanoid, set after successful registration
_alphatrack_bot_ids: dict = {}

# Maps MT5 ticket → AlphaTrack bot ID for trade attribution in trade_sync (C4)
_ticket_to_at_bot_id: dict = {}
_ticket_lock = threading.Lock()


def _load_ticket_registry() -> None:
    global _ticket_to_at_bot_id
    try:
        with open(_TICKET_REGISTRY_FILE, "r", encoding="utf-8") as f:
            raw = json.load(f)
        with _ticket_lock:
            _ticket_to_at_bot_id = {int(k): v for k, v in raw.items()}
    except FileNotFoundError:
        pass
    except Exception as e:
        print(f"[gateway] Ticket-Registry laden fehlgeschlagen: {e}")


def _save_ticket_registry() -> None:
    try:
        with _ticket_lock:
            snapshot = dict(_ticket_to_at_bot_id)
        with open(_TICKET_REGISTRY_FILE, "w", encoding="utf-8") as f:
            json.dump({str(k): v for k, v in snapshot.items()}, f)
    except Exception as e:
        print(f"[gateway] Ticket-Registry speichern fehlgeschlagen: {e}")


def get_at_bot_id_for_ticket(ticket: int) -> str | None:
    """Returns the AlphaTrack bot ID that opened this MT5 ticket, or None."""
    with _ticket_lock:
        return _ticket_to_at_bot_id.get(int(ticket))


async def _post_alphatrack(path: str, body: dict, headers: dict = None) -> dict | None:
    url = f"{_alphatrack_url}{path}"
    h = headers or {}
    try:
        resp = await asyncio.to_thread(requests.post, url, json=body, headers=h, timeout=5)
        if resp.ok:
            return resp.json()
    except Exception:
        pass
    return None


# --- Ping keepalive task ---

async def _ping_loop():
    while True:
        await asyncio.sleep(30)
        async with _bots_lock:
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
    asyncio.create_task(udp_announce_loop())


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

            _is_agpv2 = msg.get("agp") == "2.0"
            if _is_agpv2:
                inner = msg.get("payload", {})
                if isinstance(inner, dict):
                    for k, v in inner.items():
                        if k not in msg:
                            msg[k] = v
            mtype = msg.get("type", "")

            if mtype == "register":
                bot_name = msg.get("name", "")
                bot_version = msg.get("version", "1.0.0")
                bot_ip = msg.get("ip", "unknown")
                bot_port = msg.get("port", 0)
                bot_component_type = msg.get("component_type", "bot")
                # Statische Bot-ID MUSS aus dem payload kommen: der AGPv2-Umschlag
                # hat selbst ein 'id'-Feld (Message-UUID), das beim Merge gewinnt
                _reg_payload = msg.get("payload") if _is_agpv2 else None
                bot_static_id = (_reg_payload.get("id", "") if isinstance(_reg_payload, dict) else msg.get("id", ""))
                bot_latency = msg.get("latency", 0.0)

                # Validate: only "bot" components may register via this endpoint
                if bot_component_type not in ("bot", ""):
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "message": f"Registration rejected: component_type '{bot_component_type}' must be 'bot'",
                    }))
                    await websocket.close(code=1008)
                    return

                # Reconnect: reuse existing bot_id if name is known,
                # but honour a provided static ID (allows config-based reassignment)
                is_reconnect = bot_name in _bot_names_to_id
                if is_reconnect and not bot_static_id:
                    bot_id = _bot_names_to_id[bot_name]
                else:
                    # Use static bot_id from config if provided, otherwise generate one
                    bot_id = bot_static_id if bot_static_id else str(uuid.uuid4())[:8]
                    _bot_names_to_id[bot_name] = bot_id

                _bots[bot_id] = websocket
                _bot_versions[bot_id] = bot_version
                # Store full identity record (id, name, type, ip, port, latency, connected_at)
                # Bei Reconnect wird connected_at bewusst neu gesetzt
                _bot_identities[bot_id] = {
                    "id": bot_id,
                    "name": bot_name,
                    "type": bot_component_type,
                    "ip": bot_ip,
                    "port": bot_port,
                    "latency": bot_latency,
                    "connected_at": time.time(),
                }

                if _is_agpv2:
                    resp = {
                        "agp": "2.0", "type": "registered",
                        "id": str(uuid.uuid4()),
                        "ts": datetime.now(timezone.utc).isoformat(),
                        "payload": {"bot_id": bot_id},
                    }
                else:
                    resp = {"type": "registered", "bot_id": bot_id}
                await websocket.send_text(json.dumps(resp))

                # Bridge-Log und Display: Verbindung oder Reconnect
                event_msg = f"Bot {'reconnect' if is_reconnect else 'verbunden'}: {bot_name}"
                event_detail = f"Version {bot_version}"
                if _log_callback:
                    _log_callback("info", event_msg, event_detail)
                if _display_callback:
                    _display_callback("ok", "BOT", f"{event_msg} | {event_detail}")

                port = _load_config().get("command_server_port", 8765)
                bot_url = f"http://{_local_ip}:{port}/bot/{bot_id}"
                try:
                    resp = await _post_alphatrack(
                        "/api/bots",
                        {"name": bot_name, "profileId": _profile_id, "url": bot_url, "type": "bot"},
                        {"x-bot-api-key": _api_key},
                    )
                    if resp:
                        at_id = resp.get("bot", {}).get("id")
                        if at_id:
                            _alphatrack_bot_ids[bot_id] = at_id
                            if _display_callback:
                                _display_callback("ok", "BOT", f"Registriert bei AlphaTrack: {bot_name} ({at_id})")
                    else:
                        msg = f"Bot-Registrierung bei AlphaTrack fehlgeschlagen: {bot_name}"
                        if _log_callback:
                            _log_callback("warn", msg)
                        if _display_callback:
                            _display_callback("warn", "BOT", msg)
                except Exception as exc:
                    msg = f"Bot-Registrierung Fehler: {bot_name}: {exc}"
                    if _log_callback:
                        _log_callback("error", msg)
                    if _display_callback:
                        _display_callback("error", "BOT", msg)

            elif mtype == "heartbeat":
                if not bot_id:
                    continue
                # Bot-State live im Identity-Record aktualisieren (fuer Bridge-Display)
                if bot_id in _bot_identities:
                    _bot_identities[bot_id]["state"] = msg.get("state", "running")
                body = {
                    "bridgeId": _alphatrack_bot_ids.get(bot_id, bot_id),
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
                if msg.get("parameters"):
                    body["status"]["parameters"] = msg["parameters"]
                hb_resp = await _post_alphatrack("/api/bridge/heartbeat", body, {"x-bot-api-key": _api_key})
                if hb_resp is None and _display_callback:
                    _display_callback("warn", "BOT", f"Heartbeat-Weiterleitung fehlgeschlagen: {bot_name}")

            elif mtype == "log":
                if not bot_id:
                    continue
                # C2: Bot-Logs duerfen nicht in den Bridge-Log — separater Bot-Log-Endpunkt
                at_bot_id = _alphatrack_bot_ids.get(bot_id, bot_id)
                try:
                    await _post_alphatrack(f"/api/bots/{at_bot_id}/log", {
                        "botId": at_bot_id,
                        "level": msg.get("level", "info"),
                        "message": msg.get("message", ""),
                        "details": msg.get("details", ""),
                    }, {"x-bot-api-key": _api_key})
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
            _bot_identities.pop(bot_id, None)
            _bot_versions.pop(bot_id, None)
            name = next((n for n, i in _bot_names_to_id.items() if i == bot_id), bot_id)
            if _log_callback:
                _log_callback("warn", f"Bot getrennt: {name}")
            if _display_callback:
                _display_callback("warn", "BOT", f"Bot getrennt: {name}")


# --- HTTP endpoints ---

@app.get("/health")
async def health():
    return {"ok": True, "agp": "2.0", "bots_connected": len(_bots)}


@app.get("/info")
async def get_info():
    """AGPv2 Discovery-Endpunkt — keine Credentials."""
    try:
        cfg = _load_config()
    except Exception:
        cfg = {}
    return {
        "agp": "2.0",
        "name": cfg.get("bridge_name", "AlphaTrack Bridge"),
        "version": "2.0",
        "ip": _local_ip,
        "port": cfg.get("command_server_port", 8765),
        "profile_id": _profile_id,
        "bridge_id": cfg.get("bridge_id", ""),
        "bots_connected": len(_bots),
    }


@app.get("/bots/identities")
async def get_bot_identities():
    """Returns the full identity record (id, name, type, ip, port, latency) for all connected bots."""
    return {"bots": list(_bot_identities.values()), "count": len(_bot_identities)}


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
    count = min(count, 5000)
    candles = await asyncio.to_thread(_candles_fetcher, symbol, interval, count)
    if not candles:
        raise HTTPException(status_code=503, detail=f"Keine Kerzen für {symbol} - Symbol im MT5 aktiviert?")
    return {"candles": candles, "symbol": symbol}


@app.get("/historical_candles")
async def get_historical_candles(
    symbol: str = Query(default="EURUSDp"),
    interval: str = Query(default="M5"),
    from_date: str = Query(..., description="Start-Datum lokal YYYY-MM-DD"),
    to_date: str = Query(..., description="End-Datum lokal YYYY-MM-DD"),
    _: None = Depends(_require_api_key),
):
    if _historical_candles_fetcher is None:
        raise HTTPException(status_code=503, detail="MT5 nicht initialisiert")
    if interval not in ("M1", "M5", "M15", "H1", "H4", "D1"):
        raise HTTPException(status_code=400, detail=f"Ungültiger Intervall: {interval}")
    try:
        from_dt = datetime.strptime(from_date, "%Y-%m-%d")
        to_dt = datetime.strptime(to_date, "%Y-%m-%d") + timedelta(days=1)
    except ValueError:
        raise HTTPException(status_code=400, detail="Datum-Format: YYYY-MM-DD")
    candles = await asyncio.to_thread(_historical_candles_fetcher, symbol, interval, from_dt, to_dt)
    if not candles:
        raise HTTPException(status_code=503, detail=f"Keine historischen Daten für {symbol} {interval}")
    return {"candles": candles, "symbol": symbol, "count": len(candles)}


@app.get("/positions")
async def get_positions():
    with _positions_lock:
        positions = list(_positions_cache)
    return {"positions": positions}


@app.get("/history")
async def get_history():
    if _history_fetcher is None:
        raise HTTPException(status_code=503, detail="MT5 nicht initialisiert")
    deals = await asyncio.to_thread(_history_fetcher)
    return {"deals": deals}


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
    # Extract bot_id from request for MT5 error forwarding (C3/C4)
    requesting_bot_id = data.get("bot_id", "") or (payload or {}).get("bot_id", "")

    valid = {"start", "stop", "pause", "resume", "execute_trade", "close_position", "restart"}
    if command not in valid:
        raise HTTPException(status_code=400, detail="Ungültiger Command")

    if command == "close_position":
        if not payload or not payload.get("ticket"):
            raise HTTPException(status_code=400, detail="close_position benötigt ticket")
        # Track cmd_id -> bot_id for error forwarding (C3)
        if requesting_bot_id:
            with _cmd_to_bot_lock:
                _cmd_to_bot_id[cmd_id] = requesting_bot_id
        # Sync-Pfad (MT5 Worker -> HTTP /command): threading.Event — KEIN asyncio.
        # Wird via asyncio.to_thread(evt.wait) gewartet, niemals mit asyncio.wait_for.
        evt = threading.Event()
        with _trade_lock:
            _trade_events[cmd_id] = evt
        _command_queue.put({"command": command, "id": cmd_id, "payload": payload, "bot_id": requesting_bot_id})
        ok = await asyncio.to_thread(evt.wait, 10)
        with _trade_lock:
            result = _trade_results.pop(cmd_id, {"success": False, "error": "Kein Ergebnis"})
            _trade_events.pop(cmd_id, None)
        with _cmd_to_bot_lock:
            _cmd_to_bot_id.pop(cmd_id, None)
        if not ok:
            return JSONResponse({"success": False, "error": "Timeout"}, status_code=504)
        # C3: Forward MT5 error immediately to the originating bot
        if not result.get("success") and result.get("error") and requesting_bot_id:
            asyncio.create_task(_forward_mt5_error_to_bot(requesting_bot_id, result["error"]))
        # C4: Keep ticket attribution in registry after close so the 30s trade-sync
        # can still resolve bot_id for the closed deal. Tickets accumulate but stay
        # small in practice (MT5 IDs are monotonically increasing, no reuse risk).
        return {"ok": True, **result}

    if command == "execute_trade":
        if not payload or not payload.get("symbol") or not payload.get("direction") or not payload.get("lots"):
            raise HTTPException(status_code=400, detail="execute_trade benötigt symbol, direction, lots")
        # Track cmd_id -> bot_id for error forwarding (C3)
        if requesting_bot_id:
            with _cmd_to_bot_lock:
                _cmd_to_bot_id[cmd_id] = requesting_bot_id
        # Sync-Pfad (MT5 Worker -> HTTP /command): threading.Event — KEIN asyncio.
        # Wird via asyncio.to_thread(evt.wait) gewartet, niemals mit asyncio.wait_for.
        evt = threading.Event()
        with _trade_lock:
            _trade_events[cmd_id] = evt
        _command_queue.put({"command": command, "id": cmd_id, "payload": payload, "bot_id": requesting_bot_id})
        ok = await asyncio.to_thread(evt.wait, 10)
        with _trade_lock:
            result = _trade_results.pop(cmd_id, {"success": False, "error": "Kein Ergebnis"})
            _trade_events.pop(cmd_id, None)
        with _cmd_to_bot_lock:
            _cmd_to_bot_id.pop(cmd_id, None)
        if not ok:
            return JSONResponse({"success": False, "error": "Timeout - MT5 hat nicht geantwortet"}, status_code=504)
        # C3: Forward MT5 error immediately to the originating bot
        if not result.get("success") and result.get("error") and requesting_bot_id:
            asyncio.create_task(_forward_mt5_error_to_bot(requesting_bot_id, result["error"]))
        # C4: Record ticket → AlphaTrack bot ID for trade attribution
        if result.get("success") and result.get("ticket") and requesting_bot_id:
            at_id = _alphatrack_bot_ids.get(requesting_bot_id, requesting_bot_id)
            with _ticket_lock:
                _ticket_to_at_bot_id[int(result["ticket"])] = at_id
            _save_ticket_registry()
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
        # Async-Pfad (Bot WS -> /bot/{id}/command): asyncio.Event — NUR vom Event-Loop setzen.
        # evt.set() erfolgt ausschließlich in ws_endpoint (gleichem Event-Loop-Thread).
        # Niemals asyncio.Event aus einem threading.Thread setzen.
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
async def get_config(_: None = Depends(_require_api_key)):
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
            _atomic_write_config(cfg)
        if changed and _log_callback:
            for entry in changed:
                _log_callback("info", f"Einstellung geaendert: {entry}")
        return {"ok": True, "changed": len(changed)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def _has_body(request: Request) -> bool:
    cl = request.headers.get("content-length")
    te = request.headers.get("transfer-encoding", "")
    return (cl is not None and int(cl) > 0) or "chunked" in te.lower()


def start_server(port: int) -> threading.Thread:
    thread = threading.Thread(
        target=lambda: uvicorn.run(app, host="0.0.0.0", port=port, log_level="warning"),
        daemon=True,
        name="GatewayServer",
    )
    thread.start()
    return thread
