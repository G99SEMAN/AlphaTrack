# AlphaTrack Gateway Protocol v2 (AGPv2)

**Version**: 2.0.0  
**Last Updated**: 2026-06-20  
**Status**: Stable

---

## Overview

AGPv2 is the exclusive communication protocol between AlphaTrack bots and the FastAPI Bridge Gateway. All bot interactions with MetaTrader 5, account data, and position management flow through the Bridge on a single WebSocket connection plus HTTP endpoints for bulk data retrieval.

Every WebSocket message is wrapped in an AGPv2 envelope:
```json
{"agp": "2.0", "type": "...", "id": "uuid", "ts": "2026-01-01T00:00:00+00:00", "payload": {...}}
```

```
┌──────────────┐                    ┌─────────────────────┐                 ┌─────────┐
│  AlphaTrack  │                    │  Bridge Gateway     │                 │   MT5   │
│   UI/API     │◄─── HTTP REST ────►│  (FastAPI:8765)     │◄── MT5 API ───►│Terminal │
└──────────────┘                    └─────────────────────┘                 └─────────┘
                                              ▲
                                              │
                                          WebSocket
                                       (bidirectional)
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │                         │                         │
                 ┌──┴──┐                   ┌──┴──┐                   ┌──┴──┐
                 │Bot 1 │                   │Bot 2 │                   │Bot N │
                 └──────┘                   └──────┘                   └──────┘
                 (register → heartbeat → trade commands → close)
```

---

## Connection Flow

### 1. WebSocket Handshake
```
ws://[bridge_host]:8765/ws?api_key=[api_key]
```

**Requirements:**
- Port: 8765 (default, konfigurierbar via `command_server_port`)
- Query parameter: `api_key` (muss mit Bridge-Config uebereinstimmen)
- Must send `register` message immediately after connection

### 2. Registration (AGPv2 Envelope)
Bot sends (within 10 seconds of connection):
```json
{
  "agp": "2.0",
  "type": "register",
  "id": "uuid",
  "ts": "2026-01-01T00:00:00+00:00",
  "payload": {
    "id": "mybot-001",
    "name": "Breakout v1",
    "version": "1.0.0",
    "component_type": "bot",
    "ip": "<TRADING-RECHNER-IP>",
    "port": 8771
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| id | string | Statische Bot-ID aus config.json |
| name | string | Anzeigename (z.B. "Breakout v1") |
| version | string | Bot semantic version (z.B. "1.0.0") |
| component_type | string | `"bot"` (nie `"bridge"`) |
| ip | string | Lokale IP des Bots (automatisch ermittelt) |
| port | int | Bot-Port (z.B. 8771) |

Bridge responds:
```json
{
  "agp": "2.0",
  "type": "registered",
  "id": "uuid",
  "ts": "...",
  "payload": {"bot_id": "mybot-001"}
}
```

### 3. Steady State
- Bot sends **heartbeat** every `heartbeat_interval_sec` (default: 10s)
- Bot processes **command** messages from Bridge immediately
- Bot sends **trade_result** in response to execute_trade/close_position commands
- Bridge sends **ping** periodically; bot must respond with **pong**

### 4. Reconnection
If WebSocket closes:
1. Wait 5 seconds
2. Reconnect to `ws://[bridge_host]:8765/ws?api_key=[api_key]`
3. Resend `register` message
4. Resume heartbeat cycle
5. Nach 3 fehlgeschlagenen Versuchen: Error-Log, dann weiter versuchen

---

## Message Reference

### Bot → Bridge Messages

Alle Nachrichten werden in ein AGPv2-Envelope gewrappt (`_agp2_wrap()` in `ws_client.py`):
```json
{"agp": "2.0", "type": "<msg_type>", "id": "uuid", "ts": "ISO-8601", "payload": {...}}
```

#### **register** (Mandatory, send first)
Siehe oben unter "Registration".

---

#### **heartbeat** (Periodic, every heartbeat_interval_sec)
Signals bot health and current state.

```json
{
  "agp": "2.0",
  "type": "heartbeat",
  "id": "uuid",
  "ts": "...",
  "payload": {
    "state": "running",
    "open_positions": 2,
    "active_symbols": ["EURUSDp", "GBPUSDp"],
    "trades_sync": 0,
    "uptime": 7200,
    "balance": 1250.50,
    "currency": "USD",
    "parameters": {"hold_minutes": 10, "interval_minutes": 30}
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| state | string | `"running"` \| `"paused"` \| `"stopped"` \| `"error"` |
| open_positions | int | Count of open positions |
| active_symbols | string[] | List of instruments with open positions |
| trades_sync | int | Queue size of pending trade confirmations (0 = in sync) |
| uptime | int | Seconds since bot started |
| balance | float? | Account balance (optional, from last `/account` call) |
| currency | string? | Account currency (optional, z.B. "USD") |
| parameters | object? | Aktuelle Strategie-Parameter via `get_parameters()` (optional) |

---

#### **log** (On demand)
Sends structured log entry to Bridge logs.

```json
{
  "agp": "2.0",
  "type": "log",
  "id": "uuid",
  "ts": "...",
  "payload": {
    "level": "info",
    "message": "Trade executed",
    "details": "BUY 0.01 EURUSDp @ 1.08500"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| level | string | `"info"` \| `"warn"` \| `"error"` |
| message | string | Short message |
| details | string? | Extended context (optional) |

---

#### **trade_result** (Response to Bridge command)
Sent in response to `execute_trade` or `close_position` command.

```json
{
  "agp": "2.0",
  "type": "trade_result",
  "id": "uuid",
  "ts": "...",
  "payload": {
    "cmd_id": "550e8400-e29b-41d4-a716-446655440000",
    "success": true,
    "ticket": 12345678,
    "price": 1.08500,
    "error": null
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| cmd_id | string | UUID from Bridge command (echo back) |
| success | bool | Trade succeeded (`true`) or failed (`false`) |
| ticket | int? | MT5 ticket number (if success=true) |
| price | float? | Execution price (if success=true) |
| error | string? | Error message if success=false |

---

#### **pong** (Response to ping)

```json
{"type": "pong"}
```

---

### Bridge → Bot Messages

#### **registered** (Response to register)
Sent once after bot registration succeeds (AGPv2 envelope).

```json
{
  "agp": "2.0",
  "type": "registered",
  "id": "uuid",
  "ts": "...",
  "payload": {"bot_id": "mybot-001"}
}
```

---

#### **command** (Lifecycle Control)

Commands werden **ohne** AGPv2-Envelope gesendet (direkt als JSON-Frame):

```json
{"type": "command", "cmd_id": "uuid", "command": "<cmd>", "payload": null}
```

**Unterstuetzte Lifecycle-Commands:**

| Command | Payload | Beschreibung |
|---------|---------|--------------|
| `start` | null | Bot starten / fortsetzen |
| `stop` | null | Bot stoppen |
| `pause` | null | Bot pausieren |
| `resume` | null | Bot fortsetzen |
| `restart` | null | Bot neustarten (Exit-Code 75) |

---

#### **command** (Trade Execution)

**Execute Trade:**
```json
{
  "type": "command",
  "cmd_id": "550e8400-e29b-41d4-a716-446655440000",
  "command": "execute_trade",
  "payload": {
    "symbol": "EURUSDp",
    "direction": "buy",
    "lots": 0.01,
    "sl": 1.0800,
    "tp": 1.0900
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| symbol | string | Instrument (z.B. "EURUSDp") |
| direction | string | `"buy"` or `"sell"` |
| lots | float | Position size in lots |
| sl | float | Stop-loss price (0 = no SL) |
| tp | float | Take-profit price (0 = no TP) |

**Close Position:**
```json
{
  "type": "command",
  "cmd_id": "550e8400-e29b-41d4-a716-446655440000",
  "command": "close_position",
  "payload": {"ticket": 12345678}
}
```

Bot must respond with `trade_result` message containing the same `cmd_id`.

---

#### **command** (Parameter-Editor)

**set_parameters** — Setzt Strategie-Parameter live (von AlphaTrack UI):
```json
{
  "type": "command",
  "cmd_id": "uuid",
  "command": "set_parameters",
  "payload": {
    "parameters": {"hold_minutes": 15, "interval_minutes": 45}
  }
}
```

BaseBot verarbeitet dies automatisch via `apply_parameters()` — Parameter werden in `config.json` persistiert (restart-safe).

---

#### **command** (MT5-Error Forwarding)

**mt5_error** — Bridge leitet MT5-Fehler an den verursachenden Bot weiter (C3):
```json
{
  "type": "command",
  "cmd_id": "mt5_err_mybot-001",
  "command": "mt5_error",
  "payload": {"error": "Insufficient margin", "bot_id": "mybot-001"}
}
```

BaseBot verarbeitet dies via `on_mt5_error()` — kann in der Strategie ueberschrieben werden.

---

#### **ping** (Keep-alive)
Sent periodically by Bridge.

```json
{"type": "ping"}
```

Bot must respond with `{"type": "pong"}`.

---

## HTTP API Reference

Alle HTTP-Requests benoetigen den Header `X-Bot-Api-Key: [api_key]`, sofern nicht anders angegeben.

Base URL: `http://[bridge_host]:8765`

### GET /health (unauthenticated)

AGPv2 Health-Check.

```json
{"ok": true, "agp": "2.0", "bots_connected": 2}
```

---

### GET /info (unauthenticated)

AGPv2 Discovery-Endpunkt.

```json
{
  "agp": "2.0",
  "name": "AlphaTrack Bridge",
  "version": "2.0",
  "ip": "<TRADING-RECHNER-IP>",
  "port": 8765,
  "profile_id": "FiFT3HmJf-",
  "bridge_id": "bridge-001",
  "bots_connected": 2
}
```

---

### GET /candles

Retrieve candlestick data.

```
GET /candles?symbol=EURUSDp&interval=M15&count=50
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| symbol | string | EURUSDp | Instrument |
| interval | string | M5 | M1 \| M5 \| M15 \| H1 \| H4 \| D1 |
| count | int | 50 | Number of candles (max 5000) |

**Response:**
```json
{
  "candles": [
    {"datetime": "2026-06-03T10:15:00Z", "open": 1.085, "high": 1.0855, "low": 1.0845, "close": 1.0852}
  ],
  "symbol": "EURUSDp"
}
```

---

### GET /historical_candles (authenticated)

Historische Kerzendaten fuer Backtesting.

```
GET /historical_candles?symbol=EURUSDp&interval=M15&from_date=2026-01-01&to_date=2026-06-14
```

| Parameter | Type | Description |
|-----------|------|-------------|
| symbol | string | Instrument |
| interval | string | M1 \| M5 \| M15 \| H1 \| H4 \| D1 |
| from_date | string | Start-Datum (YYYY-MM-DD) |
| to_date | string | End-Datum (YYYY-MM-DD) |

**Response:**
```json
{"candles": [...], "symbol": "EURUSDp", "count": 1500}
```

---

### GET /positions

Retrieve all open positions.

```json
{
  "positions": [
    {
      "ticket": 12345678,
      "instrument": "EURUSDp",
      "type": "long",
      "entry": 1.08500,
      "size": 0.01,
      "sl": 1.08000,
      "tp": 1.09000,
      "pnl": 5.20,
      "pnl_pct": 0.52,
      "commission": -2.50
    }
  ]
}
```

---

### GET /history

Retrieve closed deal history from MT5.

```json
{"deals": [...]}
```

---

### GET /account

Retrieve account information.

```json
{
  "balance": 1000.0,
  "equity": 1005.0,
  "currency": "USD",
  "free_margin": 4990.0,
  "margin_used": 10.0,
  "margin_level": 99950.0
}
```

---

### GET /calendar

Wirtschaftskalender-Events von MT5.

```
GET /calendar?days_back=2&days_ahead=7
```

```json
{"events": [...], "fetchedAt": "2026-06-20T12:00:00"}
```

---

### GET /bots/identities

Identity-Records aller verbundenen Bots.

```json
{
  "bots": [
    {"id": "mybot-001", "name": "Breakout v1", "type": "bot", "ip": "<TRADING-RECHNER-IP>", "port": 8771}
  ],
  "count": 1
}
```

---

### POST /command (authenticated)

Execute a trade command (alternative to WebSocket).

**Execute Trade:**
```json
{
  "command": "execute_trade",
  "id": "uuid",
  "bot_id": "mybot-001",
  "payload": {
    "symbol": "EURUSDp",
    "direction": "buy",
    "lots": 0.01,
    "sl": 0,
    "tp": 0,
    "bot_id": "mybot-001"
  }
}
```

`slPips` und `tpPips` werden ebenfalls unterstuetzt (float, optional, camelCase).

**Close Position:**
```json
{
  "command": "close_position",
  "id": "uuid",
  "bot_id": "mybot-001",
  "payload": {"ticket": 12345678, "bot_id": "mybot-001"}
}
```

**Lifecycle Commands** (start, stop, pause, resume, restart):
```json
{"command": "start", "id": "uuid"}
```

Gueltige Commands: `start`, `stop`, `pause`, `resume`, `execute_trade`, `close_position`, `restart`

**Response (Trade):**
```json
{"ok": true, "success": true, "ticket": 12345678, "price": 1.08500, "error": null}
```

---

### POST /bot/{bot_id}/command (authenticated)

Sendet Command direkt an einen bestimmten Bot via WebSocket.
Wird von AlphaTrack UI fuer `set_parameters`, `execute_trade`, `close_position` etc. genutzt.

```json
{
  "command": "set_parameters",
  "id": "uuid",
  "payload": {"parameters": {"hold_minutes": 15}}
}
```

Bei `execute_trade` und `close_position`: synchrone Antwort mit Timeout (12s).

---

### GET /config (authenticated)

Gibt die aktuelle Bridge-Konfiguration zurueck.

---

### POST /config (authenticated)

Aktualisiert Bridge-Konfigurationsfelder.

---

## UDP Bridge Discovery (Port 8766)

Die Bridge sendet alle 10 Sekunden einen UDP-Broadcast auf Port 8766:

```json
{
  "type": "bridge_announce",
  "agp": "2.0",
  "ip": "<TRADING-RECHNER-IP>",
  "port": 8765,
  "name": "AlphaTrack Bridge",
  "version": "2.0",
  "profile_id": "FiFT3HmJf-"
}
```

Bots mit leerer `bridge_url` entdecken die Bridge automatisch via UDP, dann Fallback auf HTTP-Scan des eigenen /24-Subnetzes (`:8765/health`).

---

## Bot Configuration Template

**File:** `config.json` (in bot directory)

```json
{
  "alphatrack_url": "http://<NAS-IP>:3002",
  "api_key": "<dein-api-key>",
  "bot_id": "mybot-001",
  "bot_name": "My Trading Bot",
  "bot_version": "1.0.0",
  "bot_type": "bot",
  "bot_ip": "",
  "bot_port": 8771,
  "profile_id": "PROFIL_ID",
  "bridge_url": "http://<TRADING-RECHNER-IP>:8765",
  "heartbeat_interval_sec": 10,
  "strategy": {
    "symbol": "EURUSDp",
    "timeframe": "M15",
    "candles_count": 50,
    "lots": 0.01,
    "max_positions": 1,
    "comment": "Bot Strategy",
    "tick_interval_sec": 60
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| alphatrack_url | string | Yes | AlphaTrack UI URL (NAS Docker, z.B. `http://<NAS-IP>:3002`) |
| api_key | string | Yes | Bridge API key (muss mit `.env.local` `BOT_API_KEY` uebereinstimmen) |
| bot_id | string | Yes | Statischer Identifier (z.B. `"mybot-001"`) |
| bot_name | string | Yes | Anzeigename |
| bot_version | string | Yes | Semantic version |
| bot_type | string | Yes | Immer `"bot"` (nie `"bridge"`) |
| bot_ip | string | No | Leer lassen — wird automatisch ermittelt |
| bot_port | int | Yes | Eindeutiger Port — Bridge: 8765, TestBot 2: 8770, neue Bots ab 8771+ |
| profile_id | string | Yes | AlphaTrack-Profil-ID |
| bridge_url | string | No | Bridge-URL — leer lassen fuer Auto-Discovery via UDP/LAN-Scan |
| heartbeat_interval_sec | int | No | Heartbeat-Frequenz (Standard: 10) |
| strategy | object | Yes | Strategie-Parameter (bot-spezifisch) |

**Hinweis:** `command_server_port` ist ein Bridge-Config-Feld (nicht Bot-Config). Bots verwenden `bot_port`.

---

## Error Handling & Reconnection

### WebSocket Errors
- **Connection refused**: Bridge ist offline. Retry nach 5s Wartezeit.
- **Invalid API key**: `api_key` in config.json gegen Bridge-Config pruefen.
- **Connection timeout**: Netzwerkproblem. Automatischer Reconnect.
- **Unexpected close**: Bridge-Restart. Reconnect nach 5s.

### Trade Errors (C3: MT5-Error Forwarding)
Bei fehlgeschlagenen Trades leitet die Bridge den MT5-Fehler automatisch via `mt5_error`-Command an den verursachenden Bot weiter. BaseBot verarbeitet dies via `on_mt5_error()`.

| Error | Cause | Recovery |
|-------|-------|----------|
| Insufficient margin | Position size too large | `lots` reduzieren |
| Invalid symbol | Symbol nicht in MT5 verfuegbar | Symbol im MT5 aktivieren |
| MT5 disconnected | Terminal offline | MT5-Terminal-Status pruefen |

### Heartbeat Failure
Wenn der Heartbeat nicht gesendet werden kann:
1. Error-Log lokal und an AlphaTrack
2. Sofortiger Reconnect-Versuch
3. State auf `"error"` im naechsten Heartbeat
4. AlphaTrack Dashboard zeigt Bot als unhealthy

---

## BaseBot Implementation (bots/scaffold/)

Bots erben von `BaseBot` (`bots/scaffold/base_bot.py`). Das gesamte AGPv2-Protokoll wird automatisch gehandhabt:

- **Registrierung**: `BaseBot._connect_and_register()` — verbindet WS, sendet register, wartet auf registered
- **Heartbeat**: automatisch im Loop mit state, positions, parameters
- **Commands**: automatisch via `_process_commands()` verarbeitet
- **Reconnect**: automatisch bei Verbindungsverlust
- **AGPv2-Wrapping**: `_agp2_wrap()` in `ws_client.py` — Bots muessen sich nicht um das Envelope kuemmern

### Scaffold-Module (nicht kopieren!)

| Modul | Beschreibung |
|-------|-------------|
| `base_bot.py` | Pflicht-Basisklasse |
| `ws_client.py` | AGPv2 WebSocket Client |
| `bridge_client.py` | HTTP Client (Candles, Positions, Trades, Account) |
| `bot_display.py` | Live-Terminal-UI (rich) |

### bridge_client.py — Verfuegbare Methoden

| Methode | Beschreibung |
|---------|-------------|
| `is_connected()` | Prueft Bridge-Erreichbarkeit via `/health` |
| `get_candles(symbol, interval, count)` | Kerzendaten abrufen |
| `get_positions()` | Offene Positionen abrufen |
| `get_account_info()` | Kontodaten abrufen |
| `execute_trade(symbol, direction, lots, sl, tp, sl_pips, tp_pips)` | Trade ausfuehren (C4: bot_id automatisch) |
| `close_position(ticket)` | Position schliessen (C4: bot_id automatisch) |
| `set_bot_id(bot_id)` | Bot-ID setzen (intern von BaseBot) |
| `discover_bridge()` | Bridge via UDP/LAN-Scan finden |

---

## Version History

### v2.0.0 (2026-06-20)
- AGPv2-Envelope fuer alle WebSocket-Nachrichten
- Registration mit `component_type`, `ip`, `port`
- `set_parameters`-Command fuer Live-Parameter-Editor
- `mt5_error`-Command fuer MT5-Fehler-Weiterleitung (C3)
- UDP-Bridge-Discovery (Port 8766)
- Neue HTTP-Endpoints: `/info`, `/historical_candles`, `/history`, `/calendar`, `/bots/identities`, `/config`, `/bot/{bot_id}/command`
- `parameters`-Feld im Heartbeat
- `slPips`/`tpPips` in execute_trade (camelCase)

### v1.0.0 (2026-06-03)
- Initiale Protokoll-Spezifikation
- WebSocket Handshake und Registration
- Heartbeat und Keep-alive
- Trade-Ausfuehrung via WebSocket und HTTP
- Account- und Position-Abfragen via HTTP
