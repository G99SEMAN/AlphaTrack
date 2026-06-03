# AlphaTrack Gateway Protocol v1 (AGP/1)

**Version**: 1.0.0  
**Last Updated**: 2026-06-03  
**Status**: Stable

---

## Overview

AGP/1 is the exclusive communication protocol between AlphaTrack bots and the FastAPI Bridge Gateway. All bot interactions with MetaTrader 5, account data, and position management flow through the Bridge on a single WebSocket connection plus HTTP endpoints for bulk data retrieval.

```
┌──────────────┐                    ┌─────────────────────┐                 ┌─────────┐
│  AlphaTrack  │                    │  Bridge Gateway     │                 │   MT5   │
│   UI/API     │◄─── HTTP REST ────►│  (FastAPI:8765)     │◄─ gRPC/HTTP ──►│Terminal │
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
ws://[bridge_host]:[bridge_port]/ws?api_key=[api_key]
```

**Requirements:**
- Port: 8765 (default)
- Query parameter: `api_key` (provided by Bridge operator)
- Must send `register` message immediately after connection

### 2. Registration
Bot sends (within 5 seconds of connection):
```json
{"type": "register", "name": "Breakout v1", "version": "1.0.0"}
```

Bridge responds:
```json
{"type": "registered", "bot_id": "bot_abc123"}
```

### 3. Steady State
- Bot sends **heartbeat** every `heartbeat_interval_sec` (default: 10s)
- Bot processes **command** messages from Bridge immediately
- Bot sends **trade_result** in response to execute_trade/close_position commands
- Bridge sends **ping** every 30 seconds; bot must respond with **pong** within 5 seconds

### 4. Reconnection
If WebSocket closes:
1. Wait exponential backoff: 1s, 2s, 4s, 8s, 16s (max 30s)
2. Reconnect to ws://[bridge_host]:[bridge_port]/ws?api_key=[api_key]
3. Resend `register` message
4. Resume heartbeat cycle

---

## Message Reference

### Bot → Bridge Messages

#### **register** (Mandatory, send first)
Sent immediately after WebSocket connection.

```json
{
  "type": "register",
  "name": "Breakout v1",
  "version": "1.0.0"
}
```

| Field | Type | Description |
|-------|------|-------------|
| type | string | Always: `"register"` |
| name | string | Display name for bot (e.g., "Breakout v1") |
| version | string | Bot semantic version (e.g., "1.0.0") |

---

#### **heartbeat** (Periodic, every heartbeat_interval_sec)
Signals bot health and current state.

```json
{
  "type": "heartbeat",
  "state": "running",
  "open_positions": 2,
  "active_symbols": ["EURUSDp", "GBPUSDp"],
  "trades_sync": 0,
  "balance": 1250.50,
  "currency": "USD",
  "uptime": 7200
}
```

| Field | Type | Description |
|-------|------|-------------|
| type | string | Always: `"heartbeat"` |
| state | string | `"running"` \| `"paused"` \| `"stopped"` \| `"error"` |
| open_positions | int | Count of open positions |
| active_symbols | string[] | List of instruments with open positions |
| trades_sync | int | Queue size of pending trade confirmations (0 = in sync) |
| balance | float | Account balance (from last `/account` call) |
| currency | string | Account currency (e.g., "USD") |
| uptime | int | Seconds since bot started |

---

#### **log** (On demand)
Sends structured log entry to Bridge logs.

```json
{
  "type": "log",
  "level": "info",
  "message": "Trade executed",
  "details": "BUY 0.01 EURUSDp @ 1.08500"
}
```

| Field | Type | Description |
|-------|------|-------------|
| type | string | Always: `"log"` |
| level | string | `"info"` \| `"warn"` \| `"error"` |
| message | string | Short message (max 100 chars) |
| details | string | Extended context (max 500 chars), optional |

---

#### **trade_result** (Response to Bridge command)
Sent in response to `execute_trade` or `close_position` command.

```json
{
  "type": "trade_result",
  "cmd_id": "550e8400-e29b-41d4-a716-446655440000",
  "success": true,
  "ticket": 12345678,
  "price": 1.08500,
  "error": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| type | string | Always: `"trade_result"` |
| cmd_id | string | UUID from Bridge command (echo back) |
| success | bool | Trade succeeded (`true`) or failed (`false`) |
| ticket | int | MT5 ticket number (if success=true) |
| price | float | Execution price (if success=true) |
| error | string | Error message if success=false |

---

#### **pong** (Response to ping)
Must be sent within 5 seconds of receiving a `ping`.

```json
{"type": "pong"}
```

---

### Bridge → Bot Messages

#### **registered** (Response to register)
Sent once after bot registration succeeds.

```json
{"type": "registered", "bot_id": "bot_abc123"}
```

| Field | Type | Description |
|-------|------|-------------|
| type | string | Always: `"registered"` |
| bot_id | string | Unique bot ID assigned by Bridge |

---

#### **command** (Lifecycle Control)

**Start:**
```json
{"type": "command", "cmd_id": "uuid", "command": "start", "payload": null}
```

**Stop:**
```json
{"type": "command", "cmd_id": "uuid", "command": "stop", "payload": null}
```

**Pause:**
```json
{"type": "command", "cmd_id": "uuid", "command": "pause", "payload": null}
```

**Resume:**
```json
{"type": "command", "cmd_id": "uuid", "command": "resume", "payload": null}
```

**Restart:**
```json
{"type": "command", "cmd_id": "uuid", "command": "restart", "payload": null}
```

| Field | Type | Description |
|-------|------|-------------|
| type | string | Always: `"command"` |
| cmd_id | string | UUID for tracking response |
| command | string | `"start"` \| `"stop"` \| `"pause"` \| `"resume"` \| `"restart"` |
| payload | object | Always `null` for lifecycle commands |

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
| symbol | string | Instrument (e.g., "EURUSDp") |
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
  "payload": {
    "ticket": 12345678
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| ticket | int | MT5 ticket number to close |

Bot must respond with `trade_result` message containing the same `cmd_id`.

---

#### **ping** (Keep-alive)
Sent every 30 seconds by Bridge.

```json
{"type": "ping"}
```

Bot must respond with:
```json
{"type": "pong"}
```

If no `pong` is received within 5 seconds, Bridge may close the connection.

---

## HTTP API Reference

All HTTP requests require header: `X-Bot-Api-Key: [api_key]`

Base URL: `http://[bridge_host]:[bridge_port]`

### GET /candles

Retrieve candlestick data.

**Request:**
```
GET /candles?symbol=EURUSDp&interval=M15&count=50
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| symbol | string | required | Instrument (e.g., "EURUSDp") |
| interval | string | M15 | M1 \| M5 \| M15 \| H1 \| H4 \| D1 |
| count | int | 50 | Number of candles (1–500) |

**Response:**
```json
{
  "candles": [
    {
      "datetime": "2026-06-03T10:15:00Z",
      "open": 1.08500,
      "high": 1.08550,
      "low": 1.08450,
      "close": 1.08520
    },
    {
      "datetime": "2026-06-03T10:30:00Z",
      "open": 1.08520,
      "high": 1.08600,
      "low": 1.08500,
      "close": 1.08580
    }
  ]
}
```

---

### GET /positions

Retrieve all open positions.

**Request:**
```
GET /positions
```

**Response:**
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

| Field | Type | Description |
|-------|------|-------------|
| ticket | int | MT5 ticket number |
| instrument | string | Trading pair |
| type | string | `"long"` or `"short"` |
| entry | float | Entry price |
| size | float | Position size in lots |
| sl | float | Stop-loss price |
| tp | float | Take-profit price |
| pnl | float | Profit/loss in account currency |
| pnl_pct | float | Profit/loss percentage |
| commission | float | Trading commission charged |

---

### GET /account

Retrieve account information.

**Request:**
```
GET /account
```

**Response:**
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

| Field | Type | Description |
|-------|------|-------------|
| balance | float | Account balance |
| equity | float | Balance + open P&L |
| currency | string | Account currency |
| free_margin | float | Available margin for new positions |
| margin_used | float | Margin locked by open positions |
| margin_level | float | Margin level (equity / margin_used) |

---

### POST /command

Execute a trade command (alternative to WebSocket).

**Request (Execute Trade):**
```json
{
  "command": "execute_trade",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "payload": {
    "symbol": "EURUSDp",
    "direction": "buy",
    "lots": 0.01,
    "sl": 0,
    "tp": 0
  }
}
```

**Request (Close Position):**
```json
{
  "command": "close_position",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "payload": {
    "ticket": 12345678
  }
}
```

**Response:**
```json
{
  "ok": true,
  "success": true,
  "ticket": 12345678,
  "price": 1.08500,
  "error": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| ok | bool | Request processed (true) or rejected (false) |
| success | bool | Trade executed (true) or failed (false) |
| ticket | int | MT5 ticket (if success=true) |
| price | float | Execution price (if success=true) |
| error | string | Error message if success=false |

---

## Bot Configuration Template

**File:** `config.json` (in bot directory)

```json
{
  "alphatrack_url": "http://192.168.1.28:3000",
  "api_key": "REDACTED-API-KEY",
  "bot_id": "",
  "bot_name": "My Trading Bot",
  "bot_version": "1.0.0",
  "profile_id": "FiFT3HmJf-",
  "bridge_url": "http://localhost:8765",
  "heartbeat_interval_sec": 10,
  "command_server_port": 8766,
  "strategy": {
    "symbol": "EURUSDp",
    "timeframe": "M15",
    "candles_count": 50,
    "n_periods": 20,
    "lots": 0.01,
    "max_positions": 1,
    "comment": "Bot Strategy"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| alphatrack_url | string | AlphaTrack UI URL (for registration) |
| api_key | string | Bridge API key (for auth) |
| bot_id | string | Assigned by AlphaTrack (leave empty initially) |
| bot_name | string | Display name |
| bot_version | string | Semantic version |
| profile_id | string | AlphaTrack profile ID |
| bridge_url | string | Bridge gateway URL |
| heartbeat_interval_sec | int | Heartbeat frequency (seconds) |
| command_server_port | int | Local HTTP port for AlphaTrack→Bot commands |
| strategy | object | Strategy-specific parameters |

---

## Error Handling & Reconnection

### WebSocket Errors
- **Connection refused**: Bridge is offline. Retry with exponential backoff.
- **Invalid API key**: Check `api_key` in config.json against Bridge config.
- **Connection timeout**: Network issue or Bridge overloaded. Increase timeout and retry.
- **Unexpected close**: May indicate Bridge restart. Reconnect after 5s delay.

### Trade Errors
| Error | Cause | Recovery |
|-------|-------|----------|
| Insufficient margin | Position size too large | Reduce `lots` in strategy config |
| Invalid symbol | Symbol not available in MT5 | Check Bridge symbol list |
| Order expired | Pending order not filled | Increase `tp`/`sl` spread |
| Bridge offline | No connection to Bridge | Ensure Bridge is running |
| MT5 disconnected | Terminal offline | Check MT5 terminal status |

### Heartbeat Failure
If heartbeat cannot be sent for >30 seconds:
1. Log error to local log and AlphaTrack
2. Attempt immediate reconnection
3. Set state to `"error"` in next heartbeat
4. AlphaTrack dashboard will show bot as unhealthy

### Automatic Recovery
Bots should implement:
```python
import time

def reconnect_with_backoff(max_retries=5, base_delay=1):
    for attempt in range(max_retries):
        try:
            ws = connect_websocket()
            return ws
        except Exception:
            delay = min(base_delay * (2 ** attempt), 30)
            time.sleep(delay)
    raise Exception("Failed to reconnect after max retries")
```

---

## Security Considerations

### API Key Management
- **Never** commit `api_key` to version control
- **Never** log API key in bot output
- Rotate keys monthly in Bridge configuration
- Use environment variables or secure config files

### HTTPS/WSS
- Use `wss://` (WebSocket Secure) for Bridge connections over public networks
- Use HTTPS for HTTP endpoints in production
- Bridge should enforce SSL/TLS certificate validation

### Input Validation
Bot must validate all Bridge responses:
- Check `success` flag in trade_result
- Verify `cmd_id` matches sent command
- Handle malformed JSON gracefully
- Set maximum message size (e.g., 64KB)

### Rate Limiting
- Default: 100 requests/minute to HTTP endpoints
- Default: 1 command/second via WebSocket
- Contact Bridge operator for increased limits

---

## Python Implementation Example

### Structure
```
mybot/
  config.json
  main.py
  strategy.py
  bridge_client.py     (HTTP client for candles/positions)
  ws_client.py         (WebSocket client, import from bridge/)
  requirements.txt
  start.bat
```

### requirements.txt
```
requests==2.31.0
websocket-client==1.6.2
```

### main.py (Skeleton)
```python
import json, sys, time
from bridge_client import BridgeClient
from strategy import on_tick

def main():
    with open('config.json') as f:
        config = json.load(f)
    
    bridge = BridgeClient(config['bridge_url'], config['api_key'])
    
    # Verify connection
    if not bridge.is_connected():
        print("ERROR: Cannot reach Bridge")
        sys.exit(1)
    
    print(f"Connected to Bridge at {config['bridge_url']}")
    
    symbol = config['strategy']['symbol']
    timeframe = config['strategy']['timeframe']
    
    # Main loop
    while True:
        candles = bridge.get_candles(symbol, timeframe, 50)
        positions = bridge.get_positions()
        
        signal = on_tick(candles, positions, config)
        
        if signal['action'] == 'buy':
            result = bridge.execute_trade(
                symbol=symbol,
                direction='buy',
                lots=config['strategy']['lots'],
                sl=signal.get('sl', 0),
                tp=signal.get('tp', 0)
            )
            print(f"BUY: {result}")
        
        time.sleep(60)

if __name__ == '__main__':
    main()
```

### strategy.py (Skeleton)
```python
def on_tick(candles, positions, config):
    """
    Called every tick_interval_sec.
    
    Args:
        candles: List of OHLC dicts with 'open', 'high', 'low', 'close'
        positions: List of position dicts from bridge.get_positions()
        config: Dict from config.json
    
    Returns:
        {
            'action': 'buy' | 'sell' | 'close' | 'hold',
            'lots': float,
            'sl': float,
            'tp': float,
            'ticket': int (if action='close')
        }
    """
    if len(candles) < 2:
        return {'action': 'hold'}
    
    # Example: simple breakout
    high_20 = max([c['high'] for c in candles[-20:]])
    low_20 = min([c['low'] for c in candles[-20:]])
    close = candles[-1]['close']
    
    if close > high_20:
        return {
            'action': 'buy',
            'lots': 0.01,
            'sl': low_20 - 0.005,
            'tp': close + 0.01
        }
    
    return {'action': 'hold'}
```

---

## Version History

### v1.0.0 (2026-06-03)
- Initial protocol specification
- WebSocket handshake and registration
- Heartbeat and keep-alive mechanism
- Trade command execution via WebSocket and HTTP
- Account and position queries via HTTP
- Error handling and reconnection guidance
- Python implementation examples

---

## Support & Changelog

For protocol questions or issues, contact the Bridge operator.

**Known Limitations (v1.0.0):**
- Maximum message size: 64KB
- Maximum positions per bot: 100 (hardcoded in Bridge)
- Candles endpoint limited to 500 candles per request
- WebSocket keep-alive: 30 seconds (pings)

**Future (v1.1.0, planned):**
- Streaming position updates via WebSocket
- Historical trade export endpoint
- Webhook notifications for external systems
