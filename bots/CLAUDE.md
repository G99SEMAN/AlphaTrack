# AlphaTrack Bot Development Guide

All trading bots in this directory communicate with AlphaTrack through the **AlphaTrack Gateway Protocol v2 (AGPv2)** via the FastAPI Bridge on port 8765. Bots do **not** connect directly to MT5 Terminal or AlphaTrack—all interactions flow through the Bridge.

**Full protocol specification:** `../docs/BRIDGE_PROTOCOL.md`

---

## Quick Protocol Reference (AGPv2)

All WebSocket messages use the AGPv2 envelope:
```json
{"agp": "2.0", "type": "...", "id": "uuid", "ts": "2026-01-01T00:00:00+00:00", "payload": {...}}
```

### WebSocket Registration (First Message)
```json
{
  "agp": "2.0", "type": "register", "id": "uuid", "ts": "...",
  "payload": {"id": "mybot-001", "name": "Bot Name", "version": "1.0.0", "component_type": "bot", "ip": "192.168.178.X", "port": 8771}
}
```

### Heartbeat (Every 10s)
```json
{
  "agp": "2.0", "type": "heartbeat", "id": "uuid", "ts": "...",
  "payload": {"state": "running", "open_positions": 0, "balance": 1000.0, "currency": "USD", "uptime": 120, "active_symbols": [], "trades_sync": 0, "parameters": {"hold_minutes": 10}}
}
```

### Commands (From Bridge — ohne AGPv2-Envelope)
```json
{"type": "command", "cmd_id": "uuid", "command": "execute_trade", "payload": {"symbol": "EURUSDp", "direction": "buy", "lots": 0.01, "sl": 1.08, "tp": 1.09}}
{"type": "command", "cmd_id": "uuid", "command": "close_position", "payload": {"ticket": 12345678}}
{"type": "command", "cmd_id": "uuid", "command": "set_parameters", "payload": {"parameters": {"hold_minutes": 15}}}
{"type": "command", "cmd_id": "uuid", "command": "mt5_error", "payload": {"error": "Insufficient margin", "bot_id": "mybot-001"}}
```

### Trade Result (Response)
```json
{
  "agp": "2.0", "type": "trade_result", "id": "uuid", "ts": "...",
  "payload": {"cmd_id": "uuid", "success": true, "ticket": 12345678, "price": 1.08500, "error": null}
}
```

### HTTP Endpoints
```
GET  /health              — AGPv2 health check (unauthenticated)
GET  /info                — AGPv2 discovery info (unauthenticated)
GET  /candles?symbol=EURUSDp&interval=M15&count=50
GET  /positions
GET  /account
GET  /config              — requires X-Bot-Api-Key
POST /command             — alternative to WebSocket
```

Authentication: `X-Bot-Api-Key: {api_key}` header on all authenticated HTTP requests.

---

## UDP Bridge Discovery (Port 8766)

The Bridge broadcasts its presence every 10 seconds on UDP port 8766:
```json
{"type": "bridge_announce", "agp": "2.0", "ip": "192.168.178.X", "port": 8765, "name": "AlphaTrack Bridge", "version": "2.0", "profile_id": "..."}
```

Bots with empty `bridge_url` automatically discover the Bridge via UDP, then fall back to HTTP scan of `192.168.178.1-254:8765`.

---

## Bot Directory Structure

Every bot must follow this layout — **only 5 files per bot**:

```
scaffold/               # Gemeinsame Infrastruktur (NICHT in Bot-Ordner kopieren)
  __init__.py
  base_bot.py           # Pflicht-Basisklasse (BaseBot)
  [ws_client]           # AGPv2 WebSocket Client (interner Scaffold-Import)
  [bridge_client]       # HTTP Client (Candles, Positions, Trades)
  [bot_display]         # Live-Terminal-UI (rich)

mybot/                  # Bot-spezifisch — nur diese 5 Dateien
  config.json           # Bot-Konfiguration (siehe Template)
  main.py               # Einstiegspunkt (siehe Template)
  strategy.py           # Handelsstrategie (on_tick implementieren)
  requirements.txt      # Abhaengigkeiten (requests, websocket-client, rich)
  start.bat             # Windows-Launcher (siehe Template)
```

Die Scaffold-Module (WebSocket-Client, HTTP-Client, Terminal-Display) liegen ausschliesslich in `scaffold/` — nie als einzelne Dateien in Bot-Ordner kopieren. BaseBot importiert sie intern.

### Mandatory Imports

**strategy.py** (und main.py) importieren BaseBot aus dem Scaffold:
```python
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scaffold.base_bot import BaseBot
```

**start.bat** setzt PYTHONPATH auf das Parent-Verzeichnis (bots/), damit `scaffold` als Package importierbar ist:
```batch
set PYTHONPATH=%~dp0..
```

---

## Configuration Template (config.json)

```json
{
  "alphatrack_url": "http://192.168.178.3:3002",
  "api_key": "REDACTED-API-KEY",
  "bot_id": "mybot-001",
  "bot_name": "My Trading Bot",
  "bot_version": "1.0.0",
  "bot_type": "bot",
  "bot_ip": "",
  "bot_port": 8771,
  "profile_id": "YOUR_PROFILE_ID",
  "bridge_url": "http://192.168.178.37:8765",
  "heartbeat_interval_sec": 10,
  "strategy": {
    "symbol": "EURUSDp",
    "timeframe": "M15",
    "candles_count": 50,
    "lots": 0.01,
    "max_positions": 1,
    "comment": "My Strategy Name"
  }
}
```

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| alphatrack_url | string | Yes | AlphaTrack UI URL (z.B. http://192.168.178.30:3002) |
| api_key | string | Yes | Bridge API key |
| bot_id | string | Yes | Statischer Identifier (z.B. "mybot-001") |
| bot_name | string | Yes | Anzeigename im UI |
| bot_version | string | Yes | Semantic version (z.B. 1.0.0) |
| bot_type | string | Yes | Immer "bot" |
| bot_port | int | Yes | Eindeutiger Port — Bridge: 8765, TestBot 2: 8770, neue Bots ab 8771+ |
| profile_id | string | Yes | AlphaTrack-Profil-ID |
| bridge_url | string | No | Bridge-URL — leer lassen fuer Auto-Discovery via UDP/LAN-Scan |
| heartbeat_interval_sec | int | No | Heartbeat-Frequenz (Standard: 10) |
| strategy | object | Yes | Strategie-Parameter (bot-spezifisch) |

---

## Start.bat Template

```batch
@echo off
title %~n0
set PYTHONPATH=%~dp0..
python -m pip install -r "%~dp0requirements.txt" --quiet --disable-pip-version-check
if %errorlevel% neq 0 (
    echo [FEHLER] pip install fehlgeschlagen
    pause
    exit /b 1
)
:loop
python main.py
if %errorlevel% == 75 goto loop
pause
```

**Wichtig:**
- `%~dp0..` = Parent-Verzeichnis des Bot-Ordners (bots/), damit `from scaffold.base_bot import BaseBot` funktioniert
- pip-install-Schritt stellt sicher, dass `rich>=13.0.0` und andere Deps installiert sind
- Exit-Code 75 = Neustart angefordert (automatischer Restart-Loop)

---

## Requirements.txt Template

```
requests>=2.31.0
websocket-client>=1.6.0
rich>=13.0.0
```

`rich` wird vom Scaffold-Terminal-Display benoetigt.

---

## Copy an Existing Bot

1. **Kopiere `testbot2/`** als Ausgangspunkt (enthaelt strategy.py mit get_parameters-Beispiel)
2. **Passe config.json an** — neuen `bot_id` und eindeutigen `bot_port` (ab 8771+) vergeben
3. **Implementiere strategy.py** — ersetze TestBot2-Logik durch eigene `on_tick`-Methode
4. **Starte per start.bat** — installiert Abhaengigkeiten und startet mit Restart-Loop

---

## Error Handling Checklist

- [ ] Check `api_key` is correct in config.json
- [ ] Check `bridge_url` is reachable (Bridge running on port 8765)
- [ ] Handle HTTP connection timeouts (retry with backoff)
- [ ] Handle malformed JSON from Bridge (log and skip tick)
- [ ] Check `success` flag in trade responses
- [ ] Validate `cmd_id` in trade_result matches sent command
- [ ] Set unique `bot_port` per bot (no collisions)
- [ ] Log all trade executions and errors via `self.log()`

---

## Testing & Deployment

### Local Test
```batch
cd mybot\
python main.py
```

### With Bridge
1. Start Bridge: `cd bridge && python main.py`
2. Start Bot: `start.bat`
3. Check Bridge logs for WebSocket connection
4. Check AlphaTrack UI for bot registration

### Backtesting
```batch
python backtest/runner.py --bot <botname> --from 2026-01-01 --to 2026-06-14
```
Daten kommen über die Bridge aus MetaTrader (`/historical_candles`). Bridge muss laufen.

**Pflicht für alle Bots:** Zeit-Checks in `on_tick()` immer `self._now()` statt `datetime.now()` nutzen:
```python
now_utc = self._now()   # korrekt — im Backtest wird dies auf Kerzenzeit gesetzt
```

### Exit Codes
- 0 = Clean shutdown
- 1 = Configuration error
- 75 = Restart requested (automatic restart via start.bat loop)
