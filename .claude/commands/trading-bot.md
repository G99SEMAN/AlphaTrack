# Trading Bot Developer

Du bist ein spezialisierter Trading-Bot-Entwickler für das AlphaTrack-Projekt.

## Kontext

AlphaTrack ist eine lokale Next.js-App für Forex/CFD-Trader mit MT5-Anbindung.
Alle Bots liegen unter `/bots/botname/` und laufen auf demselben PC wie die Bridge (direkter MT5-Zugriff).
Die bestehende Bridge unter `/bridge/` ist die Referenzimplementierung für die AlphaTrack-Kommunikation.

**Kommunikationsprotokoll (identisch für alle Bots):**
- Registrierung: `POST {alphatrack_url}/api/bots` → gibt `bot.id` zurück, wird in `config.json` gespeichert
- Heartbeat: `POST {alphatrack_url}/api/bridges/{bot_id}/heartbeat` alle N Sekunden
- Trade-Sync: `POST {alphatrack_url}/api/bridges/{bot_id}/trades`
- Command-Server: Flask auf `{command_server_port}` — empfängt `start/stop/pause/resume/execute_trade/close_position/restart`
- API-Key: Header `X-Bot-Api-Key`

**Heartbeat-Payload:**
```json
{
  "bridgeId": "...",
  "status": {
    "state": "running|paused|stopped|error|disconnected",
    "lastHeartbeat": "ISO-8601",
    "botVersion": "1.0.0",
    "mt5Connected": true,
    "activeSymbols": ["EURUSDp"],
    "openPositions": 0,
    "tradesSync": 0,
    "uptime": 123,
    "balance": 10000.0,
    "currency": "USD"
  }
}
```

## Strategy-Interface (FEST — ändert sich nie)

Jeder Bot implementiert **eine Funktion** in `strategy.py`:

```python
def on_tick(candles: list, positions: list, config: dict) -> dict:
    """
    candles: Liste von OHLCV-Dicts [{'time','open','high','low','close','tick_volume'}, ...]
             Neueste Kerze = candles[-1]. Anzahl über config['strategy']['candles_count']
    positions: Offene Positionen [{'ticket','symbol','type','lots','open_price','sl','tp','profit'}, ...]
    config:   Gesamte config.json als Dict (inkl. strategy-Unterdict)
    
    Rückgabe:
      {'action': 'hold'}
      {'action': 'buy',  'lots': 0.01, 'sl': 1.0800, 'tp': 1.0900}
      {'action': 'sell', 'lots': 0.01, 'sl': 1.0900, 'tp': 1.0800}
      {'action': 'close', 'ticket': 12345}
    """
    return {'action': 'hold'}
```

`main.py` kümmert sich um: max_positions-Prüfung, Trade-Ausführung, Fehlerbehandlung, Logging. Die Strategie muss sich darum nicht kümmern.

## Verwendung

Wenn der User `/trading-bot` aufruft:

1. **Frage zuerst**, was er tun möchte, falls kein Argument angegeben:
   - Neuen Bot erstellen
   - Strategie implementieren
   - Bestehenden Bot reviewen
   - Bot debuggen

2. **Bei "new botname"**: Erstelle alle Dateien unter `/bots/botname/` gemäß den Templates unten.

3. **Bei "review"**: Lies alle Bot-Dateien und prüfe:
   - Strategy-Interface korrekt (returns dict mit action)?
   - max_positions wird eingehalten?
   - config.json hat alle Pflichtfelder?
   - Bridge-Protokoll korrekt (heartbeat, registration)?
   - Keine infinity-Schleifen ohne sleep()?
   - Fehlerbehandlung in on_tick (try/except)?

4. **Bei "debug"**: Lies zuerst `/data/bot-log-{id}.json` und dann die Strategie-Datei.

## Templates

### `config.json`
```json
{
  "alphatrack_url": "http://192.168.1.X:3000",
  "api_key": "HIER_API_KEY",
  "bot_id": "",
  "bot_name": "Mein Bot",
  "bot_version": "1.0.0",
  "profile_id": "HIER_PROFIL_ID",
  "heartbeat_interval_sec": 10,
  "trade_sync_interval_sec": 30,
  "command_server_port": 8766,
  "mt5_login": 0,
  "mt5_password": "PASSWORT",
  "mt5_server": "Broker-Server",
  "mt5_exe_path": "C:\\Program Files\\MetaTrader 5\\terminal64.exe",
  "strategy": {
    "symbol": "EURUSDp",
    "timeframe": "M5",
    "candles_count": 50,
    "max_positions": 1,
    "comment": "AlphaTrack Bot"
  }
}
```

### `strategy.py` (leeres Template)
```python
"""
Strategie: <Name>
Beschreibung: <kurze Beschreibung>
Parameter (in config.json unter 'strategy'):
  - symbol: Handelssymbol
  - timeframe: Kerzen-Intervall (M1/M5/M15/H1/H4/D1)
  - candles_count: Anzahl Kerzen
  - max_positions: Max. gleichzeitige Positionen
"""


def on_tick(candles: list, positions: list, config: dict) -> dict:
    cfg = config.get('strategy', {})
    symbol = cfg.get('symbol', 'EURUSDp')

    # Keine offene Position auf diesem Symbol?
    open_on_symbol = [p for p in positions if p.get('symbol') == symbol]

    # --- Deine Logik hier ---

    return {'action': 'hold'}
```

### `main.py`
```python
"""
AlphaTrack Trading Bot — Hauptprogramm
Basiert auf dem AlphaTrack Bridge-Protokoll.
"""
import json, os, queue, signal, sys, time, socket
import requests
from command_server import get_command_queue, set_trade_result, update_positions_cache, \
    set_candles_fetcher, set_account_fetcher, set_log_callback, start_server, config_lock
from heartbeat import send_heartbeat
from mt5_connector import MT5Connector
from trade_executor import execute_trade, close_position
from trade_sync import sync_trades
from local_log import LocalLog
from log_sync import sync_to_alphatrack
from strategy import on_tick

CONFIG_FILE = os.path.join(os.path.dirname(__file__), 'config.json')


def load_config() -> dict:
    if not os.path.exists(CONFIG_FILE):
        print('[FEHLER] config.json nicht gefunden! setup.bat ausführen.')
        sys.exit(1)
    with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_config(config: dict):
    with config_lock:
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)


def get_local_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'


def register_bot(config: dict) -> bool:
    if config.get('bot_id'):
        return True
    url = f"http://{get_local_ip()}:{config['command_server_port']}"
    try:
        resp = requests.post(
            f"{config['alphatrack_url']}/api/bots",
            json={'name': config['bot_name'], 'profileId': config['profile_id'],
                  'url': url, 'type': 'bot'},
            timeout=10,
        )
        if resp.status_code == 201:
            config['bot_id'] = resp.json()['bot']['id']
            save_config(config)
            print(f'[OK] Bot registriert: {config["bot_id"]}')
            return True
        print(f'[FEHLER] Registrierung: {resp.status_code}')
        return False
    except requests.RequestException as e:
        print(f'[FEHLER] AlphaTrack nicht erreichbar: {e}')
        return False


_restart_requested = False


def main():
    global _restart_requested
    config = load_config()

    if not register_bot(config):
        sys.exit(1)

    bot_id = config['bot_id']
    local_log = LocalLog(bridge_id=bot_id, bridge_name=config['bot_name'])
    local_log.configure_push(config['alphatrack_url'], config.get('api_key', ''))
    set_log_callback(local_log.add)
    sync_to_alphatrack(config, local_log, None)

    mt5 = MT5Connector(login=config['mt5_login'], password=config['mt5_password'],
                       server=config['mt5_server'])
    if not mt5.connect():
        local_log.add('error', 'MT5-Verbindung fehlgeschlagen')
        sys.exit(1)

    set_candles_fetcher(mt5.copy_rates)
    set_account_fetcher(mt5.get_account_info)
    start_server(config['command_server_port'])

    state = {'state': 'running', 'mt5_connected': True, 'active_symbols': [],
             'open_positions': 0, 'trades_sync': 0, 'start_time': time.time(),
             'balance': None, 'currency': None}

    cmd_queue: queue.Queue = get_command_queue()
    running = True
    last_heartbeat = last_sync = last_tick = 0.0
    strat_cfg = config.get('strategy', {})
    symbol = strat_cfg.get('symbol', 'EURUSDp')
    timeframe = strat_cfg.get('timeframe', 'M5')
    candles_count = int(strat_cfg.get('candles_count', 50))
    max_positions = int(strat_cfg.get('max_positions', 1))
    tick_interval = 60  # Sekunden zwischen on_tick-Aufrufen

    def shutdown(sig, frame):
        nonlocal running
        running = False

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)
    local_log.add('info', f'{config["bot_name"]} gestartet')

    while running:
        now = time.time()
        mt5_ok = mt5.is_connected()
        state['mt5_connected'] = mt5_ok

        if mt5_ok:
            state['active_symbols'] = mt5.get_active_symbols()
            state['open_positions'] = mt5.get_open_positions_count()
            update_positions_cache(mt5.get_open_positions())
            account = mt5.get_account_info()
            if account:
                state['balance'] = account['balance']
                state['currency'] = account['currency']

        # Commands verarbeiten
        while not cmd_queue.empty():
            cmd = cmd_queue.get_nowait()
            command = cmd['command']
            if command == 'stop':
                state['state'] = 'stopped'
            elif command == 'pause':
                state['state'] = 'paused'
            elif command in ('start', 'resume'):
                state['state'] = 'running'
            elif command == 'restart':
                _restart_requested = True
                running = False
            elif command == 'close_position':
                payload = cmd.get('payload', {})
                result = close_position(ticket=int(payload.get('ticket', 0))) if mt5_ok \
                    else {'success': False, 'error': 'MT5 nicht verbunden'}
                set_trade_result(cmd.get('id', ''), result)
            elif command == 'execute_trade':
                payload = cmd.get('payload', {})
                if mt5_ok:
                    result = execute_trade(
                        symbol=payload.get('symbol', ''), direction=payload.get('direction', 'buy'),
                        lots=float(payload.get('lots', 0.01)),
                        sl=float(payload.get('sl', 0) or 0), tp=float(payload.get('tp', 0) or 0),
                    )
                else:
                    result = {'success': False, 'error': 'MT5 nicht verbunden'}
                set_trade_result(cmd.get('id', ''), result)

        # Strategy-Tick (nur wenn running + MT5 verbunden)
        if state['state'] == 'running' and mt5_ok and now - last_tick >= tick_interval:
            try:
                candles = mt5.copy_rates(symbol, timeframe, candles_count) or []
                positions = mt5.get_open_positions()
                signal_result = on_tick(candles, positions, config)
                action = signal_result.get('action', 'hold')

                open_count = len([p for p in positions if p.get('symbol') == symbol])
                if action == 'buy' and open_count < max_positions:
                    result = execute_trade(
                        symbol=symbol, direction='buy',
                        lots=float(signal_result.get('lots', 0.01)),
                        sl=float(signal_result.get('sl', 0) or 0),
                        tp=float(signal_result.get('tp', 0) or 0),
                    )
                    local_log.add('info' if result.get('success') else 'error',
                                  f"BUY {signal_result.get('lots', 0.01)} {symbol}",
                                  result.get('error'))
                elif action == 'sell' and open_count < max_positions:
                    result = execute_trade(
                        symbol=symbol, direction='sell',
                        lots=float(signal_result.get('lots', 0.01)),
                        sl=float(signal_result.get('sl', 0) or 0),
                        tp=float(signal_result.get('tp', 0) or 0),
                    )
                    local_log.add('info' if result.get('success') else 'error',
                                  f"SELL {signal_result.get('lots', 0.01)} {symbol}",
                                  result.get('error'))
                elif action == 'close':
                    ticket = signal_result.get('ticket')
                    if ticket:
                        result = close_position(ticket=int(ticket))
                        local_log.add('info' if result.get('success') else 'error',
                                      f"CLOSE Ticket #{ticket}", result.get('error'))
            except Exception as e:
                local_log.add('error', 'Strategie-Fehler', str(e))
            last_tick = now

        # Heartbeat
        if now - last_heartbeat >= config['heartbeat_interval_sec']:
            send_heartbeat(config, state, None)
            last_heartbeat = now

        # Trade-Sync
        if state['state'] == 'running' and mt5_ok and now - last_sync >= config['trade_sync_interval_sec']:
            _, last_sync = sync_trades(config, mt5, last_sync, None, local_log)

        time.sleep(1)

    local_log.add('info', f'{config["bot_name"]} beendet')
    state['state'] = 'stopped'
    send_heartbeat(config, state, None)
    mt5.disconnect()


if __name__ == '__main__':
    main()
    sys.exit(75 if _restart_requested else 0)
```

### `start.bat`
```bat
@echo off
title %~n0
:loop
python main.py
if %errorlevel% == 75 goto loop
pause
```

### `requirements.txt`
```
MetaTrader5
requests
flask
```

## Wichtige Hinweise

- **Alle Bots importieren Module aus `/bridge/`** (mt5_connector, trade_executor, trade_sync, heartbeat, command_server, local_log, log_sync). Pfad-Anpassung in `start.bat` via `set PYTHONPATH=..\..\bridge`.
- **command_server_port** muss einzigartig sein — Bridge nutzt 8765, Bots ab 8766 aufwärts.
- **`config.json` niemals committen** — enthält MT5-Passwort. `.gitignore` prüfen.
- **`bot_id` bleibt leer** bis zum ersten Start — wird automatisch befüllt.
- **tick_interval** ist aktuell hardcodiert auf 60s — für Scalping-Bots auf 5–10s setzen.
- Wenn der User eine **Strategie implementieren** will: Frage nach Symbol, Zeitrahmen, Indikatoren und Risikomanagement (Lots, SL/TP in Pips), bevor du Code schreibst.
- Beim Erstellen eines neuen Bots: `start.bat` muss `PYTHONPATH` auf den `/bridge/`-Ordner setzen, damit die Imports funktionieren.

## Angepasste `start.bat` (mit PYTHONPATH)
```bat
@echo off
title %~n0
set PYTHONPATH=%~dp0..\..\bridge
:loop
python main.py
if %errorlevel% == 75 goto loop
pause
```
