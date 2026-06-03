# AlphaTrack Bot Development Guide

All trading bots in this directory communicate with AlphaTrack through the **AlphaTrack Gateway Protocol v1 (AGP/1)** via the FastAPI Bridge on port 8765. Bots do **not** connect directly to MT5 Terminal or AlphaTrack—all interactions flow through the Bridge.

**Full protocol specification:** `../docs/BRIDGE_PROTOCOL.md`

---

## Quick Protocol Reference

### WebSocket Registration (First Message)
```json
{"type": "register", "name": "Bot Name", "version": "1.0.0"}
```

### Heartbeat (Every 10s)
```json
{"type": "heartbeat", "state": "running", "open_positions": 0, "balance": 1000.0, "currency": "USD", "uptime": 120}
```

### Commands (From Bridge)
```json
{"type": "command", "cmd_id": "uuid", "command": "execute_trade", "payload": {"symbol": "EURUSDp", "direction": "buy", "lots": 0.01, "sl": 1.08, "tp": 1.09}}
{"type": "command", "cmd_id": "uuid", "command": "close_position", "payload": {"ticket": 12345678}}
```

### Trade Result (Response)
```json
{"type": "trade_result", "cmd_id": "uuid", "success": true, "ticket": 12345678, "price": 1.08500, "error": null}
```

### HTTP Endpoints
```
GET  /candles?symbol=EURUSDp&interval=M15&count=50
GET  /positions
GET  /account
POST /command (alternative to WebSocket)
```

Authentication: `X-Bot-Api-Key: {api_key}` header on all HTTP requests.

---

## Bot Directory Structure

Every bot must follow this layout:

```
mybot/
  config.json           # Bot configuration (see template below)
  main.py               # Main loop (see template below)
  strategy.py           # Trading logic (define on_tick function)
  bridge_client.py      # HTTP client (copy from breakoutv1/)
  ws_client.py          # WebSocket client (import from ../bridge/)
  requirements.txt      # Dependencies (see template below)
  start.bat             # Windows launcher (see template below)
```

### Mandatory Imports

**main.py** must import from PYTHONPATH (set in start.bat):
```python
from ws_client import BridgeWSClient          # WebSocket connection
from bridge_client import BridgeClient         # HTTP endpoints for candles, positions, account
```

**start.bat** must set PYTHONPATH to ../bridge/:
```batch
set PYTHONPATH=%~dp0..\bridge
python main.py
```

This allows both bot modules and bridge modules to coexist in the same codebase.

---

## Configuration Template (config.json)

```json
{
  "alphatrack_url": "http://192.168.1.28:3000",
  "api_key": "REDACTED-API-KEY",
  "bot_id": "",
  "bot_name": "My Trading Bot",
  "bot_version": "1.0.0",
  "profile_id": "YOUR_PROFILE_ID",
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
    "comment": "My Strategy Name"
  }
}
```

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| alphatrack_url | string | Yes | AlphaTrack UI URL (e.g., http://192.168.1.28:3000) |
| api_key | string | Yes | Bridge API key (get from Bridge operator) |
| bot_id | string | No | Leave empty; filled by AlphaTrack after registration |
| bot_name | string | Yes | Display name for UI |
| bot_version | string | Yes | Semantic version (e.g., 1.0.0) |
| profile_id | string | Yes | AlphaTrack profile ID |
| bridge_url | string | Yes | Bridge gateway URL (http://localhost:8765 for local) |
| heartbeat_interval_sec | int | No | Heartbeat frequency (default: 10) |
| command_server_port | int | Yes | Local port for AlphaTrack→Bot commands (unique per bot) |
| strategy | object | Yes | Trading parameters (custom per strategy) |

---

## Main.py Template

```python
"""
AlphaTrack Trading Bot — Main Loop
Communicates with Bridge for all MT5 operations.
"""
import json, os, sys, time
from bridge_client import BridgeClient
from strategy import on_tick

CONFIG_FILE = os.path.join(os.path.dirname(__file__), 'config.json')


def load_config() -> dict:
    if not os.path.exists(CONFIG_FILE):
        print('[ERROR] config.json not found!')
        sys.exit(1)
    with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def main():
    config = load_config()
    
    # Validate required fields
    for field in ['bot_name', 'bridge_url', 'api_key']:
        if not config.get(field):
            print(f'[ERROR] {field} not configured in config.json')
            sys.exit(1)
    
    # Connect to Bridge
    bridge = BridgeClient(config['bridge_url'], config['api_key'])
    if not bridge.is_connected():
        print(f'[ERROR] Cannot reach Bridge at {config["bridge_url"]}')
        sys.exit(1)
    
    print(f'[OK] Connected to Bridge at {config["bridge_url"]}')
    
    # Strategy configuration
    strat = config['strategy']
    symbol = strat['symbol']
    timeframe = strat['timeframe']
    candles_count = int(strat['candles_count'])
    max_positions = int(strat['max_positions'])
    
    # Main loop
    running = True
    tick_interval = 60  # seconds
    last_tick = 0.0
    
    while running:
        try:
            now = time.time()
            
            # Fetch data every tick_interval seconds
            if now - last_tick >= tick_interval:
                candles = bridge.get_candles(symbol, timeframe, candles_count)
                positions = bridge.get_positions()
                
                if not candles:
                    print('[WARN] No candles received from Bridge')
                    last_tick = now
                    continue
                
                # Call strategy
                signal = on_tick(candles, positions, config)
                action = signal.get('action', 'hold')
                
                # Count open positions for this symbol
                open_count = len([p for p in positions if p['instrument'] == symbol])
                
                # Execute trades
                if action == 'buy' and open_count < max_positions:
                    result = bridge.execute_trade(
                        symbol=symbol,
                        direction='buy',
                        lots=float(signal.get('lots', strat['lots'])),
                        sl=float(signal.get('sl', 0) or 0),
                        tp=float(signal.get('tp', 0) or 0)
                    )
                    status = 'OK' if result.get('success') else 'FAIL'
                    print(f'[{status}] BUY {signal.get("lots")} {symbol} @ {result.get("price")}')
                
                elif action == 'sell' and open_count < max_positions:
                    result = bridge.execute_trade(
                        symbol=symbol,
                        direction='sell',
                        lots=float(signal.get('lots', strat['lots'])),
                        sl=float(signal.get('sl', 0) or 0),
                        tp=float(signal.get('tp', 0) or 0)
                    )
                    status = 'OK' if result.get('success') else 'FAIL'
                    print(f'[{status}] SELL {signal.get("lots")} {symbol} @ {result.get("price")}')
                
                elif action == 'close':
                    ticket = signal.get('ticket')
                    if ticket:
                        result = bridge.close_position(ticket=int(ticket))
                        status = 'OK' if result.get('success') else 'FAIL'
                        print(f'[{status}] CLOSE ticket #{ticket}')
                
                last_tick = now
            
            time.sleep(1)
        
        except KeyboardInterrupt:
            running = False
        except Exception as e:
            print(f'[ERROR] {e}')
            time.sleep(5)
    
    print('[INFO] Bot stopped')


if __name__ == '__main__':
    main()
```

---

## Strategy.py Template

The `on_tick` function is called every tick with candles and positions.

```python
"""
Trading Strategy Logic
Called once per tick_interval_sec with latest candles and positions.
"""


def on_tick(candles, positions, config):
    """
    Trading decision function.
    
    Args:
        candles: List of OHLC candles (newest at end)
                 Each candle: {"datetime": "...", "open": X, "high": X, "low": X, "close": X}
        positions: List of open positions
                   Each: {"ticket": N, "instrument": "...", "type": "long"|"short", 
                          "entry": X, "size": X, "pnl": X, ...}
        config: Dict from config.json
    
    Returns:
        {
            "action": "buy" | "sell" | "close" | "hold",
            "lots": float (if action != "hold"),
            "sl": float (if action != "hold"),
            "tp": float (if action != "hold"),
            "ticket": int (if action == "close")
        }
    """
    
    if len(candles) < 2:
        return {"action": "hold"}
    
    # Example: Simple Donchian Breakout Strategy
    # Buy on breakout above 20-period high, sell on breakout below 20-period low
    
    config_strat = config.get('strategy', {})
    n_periods = int(config_strat.get('n_periods', 20))
    
    if len(candles) < n_periods:
        return {"action": "hold"}
    
    recent = candles[-n_periods:]
    high_20 = max([c['high'] for c in recent])
    low_20 = min([c['low'] for c in recent])
    close = candles[-1]['close']
    
    # Breakout buy signal
    if close > high_20:
        return {
            "action": "buy",
            "lots": float(config_strat.get('lots', 0.01)),
            "sl": low_20 - 0.005,  # Place SL 5 pips below 20-period low
            "tp": close + 0.010    # Place TP 10 pips above entry
        }
    
    # Breakout sell signal
    if close < low_20:
        return {
            "action": "sell",
            "lots": float(config_strat.get('lots', 0.01)),
            "sl": high_20 + 0.005,
            "tp": close - 0.010
        }
    
    # Check for close signal (e.g., close if position at -1% loss)
    symbol = config_strat.get('symbol')
    pos = [p for p in positions if p['instrument'] == symbol]
    if pos and pos[0].get('pnl_pct', 0) < -0.01:
        return {
            "action": "close",
            "ticket": pos[0]['ticket']
        }
    
    return {"action": "hold"}
```

---

## Requirements.txt Template

```
requests==2.31.0
websocket-client==1.6.2
```

Minimal dependencies for HTTP and WebSocket communication.

---

## Start.bat Template

```batch
@echo off
title My Trading Bot
set PYTHONPATH=%~dp0..\bridge
:loop
python main.py
if %errorlevel% == 75 goto loop
pause
```

**Key points:**
- `%~dp0` = current directory (bot directory)
- `..\..\bridge` = parent directory + `/bridge` (where bridge_client.py and ws_client.py live)
- Exit code 75 is for restart (optional; omit if no restart needed)

---

## BridgeClient Class (HTTP Client)

Copy `bridge_client.py` from `breakoutv1/` or import from PYTHONPATH.

### Methods

```python
class BridgeClient:
    def __init__(self, bridge_url: str, api_key: str):
        """Connect to Bridge HTTP API."""
    
    def is_connected(self) -> bool:
        """Check if Bridge is reachable."""
    
    def get_candles(symbol: str, interval: str, count: int) -> list:
        """
        Fetch candlestick data.
        interval: M1 | M5 | M15 | H1 | H4 | D1
        Returns: [{"datetime": "...", "open": X, "high": X, "low": X, "close": X}, ...]
        """
    
    def get_positions() -> list:
        """
        Get all open positions.
        Returns: [{"ticket": N, "instrument": "...", "type": "long", "entry": X, "size": X, "sl": X, "tp": X, "pnl": X, ...}, ...]
        """
    
    def get_account_info() -> dict:
        """
        Get account details.
        Returns: {"balance": X, "equity": X, "currency": "USD", "free_margin": X, "margin_used": X}
        """
    
    def execute_trade(symbol: str, direction: str, lots: float, sl: float = 0, tp: float = 0) -> dict:
        """
        Execute a trade order.
        direction: "buy" or "sell"
        Returns: {"success": bool, "ticket": int, "price": float, "error": str or None}
        """
    
    def close_position(ticket: int) -> dict:
        """
        Close an open position by ticket.
        Returns: {"success": bool, "error": str or None}
        """
```

---

## BridgeWSClient Class (WebSocket, optional)

For advanced bots that need WebSocket streaming (heartbeat, commands, logs).

```python
from ws_client import BridgeWSClient

ws = BridgeWSClient(
    bridge_url="ws://localhost:8765",
    api_key="my-api-key",
    bot_name="My Bot",
    bot_version="1.0.0"
)

# Register and enter event loop
ws.connect()  # Blocks; handles heartbeat + commands automatically

# To send a trade log:
ws.send_log("info", "Executed BUY order", "BUY 0.01 EURUSDp @ 1.085")

# To handle inbound commands (override):
ws.on_command = lambda cmd: print(f"Received: {cmd}")
```

See `../bridge/ws_client.py` for full API.

---

## Error Handling Checklist

- [ ] Check `api_key` is correct in config.json
- [ ] Check `bridge_url` is reachable (Bridge running on port 8765)
- [ ] Handle HTTP connection timeouts (retry with backoff)
- [ ] Handle malformed JSON from Bridge (log and skip tick)
- [ ] Check `success` flag in trade responses
- [ ] Validate `cmd_id` in trade_result matches sent command
- [ ] Set unique `command_server_port` per bot (no collisions)
- [ ] Log all trade executions and errors to config.json alphatrack_url

---

## Testing & Deployment

### Local Test
```batch
cd mybot\
python main.py
```

### With Bridge
1. Start Bridge: `python ..\bridge\main.py`
2. Start Bot: `start.bat`
3. Check Bridge logs for WebSocket connection
4. Check AlphaTrack UI for bot registration

### Exit Codes
- 0 = Clean shutdown
- 1 = Configuration error
- 75 = Restart requested (if implemented)

---

## Next Steps

1. **Copy an existing bot** (e.g., `breakoutv1/`) as a template
2. **Edit config.json** with your parameters
3. **Implement strategy.py** with your trading logic
4. **Test locally** with `python main.py`
5. **Deploy** via `start.bat`

For full protocol details and advanced use cases, see `../docs/BRIDGE_PROTOCOL.md`.
