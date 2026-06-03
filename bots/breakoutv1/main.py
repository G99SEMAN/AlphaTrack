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
        print('[FEHLER] config.json nicht gefunden! Bitte zuerst konfigurieren.')
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
            json={
                'name': config['bot_name'],
                'profileId': config['profile_id'],
                'url': url,
                'type': 'bot',
            },
            timeout=10,
        )
        if resp.status_code == 201:
            config['bot_id'] = resp.json()['bot']['id']
            save_config(config)
            print(f'[OK] Bot registriert: {config["bot_id"]}')
            return True
        print(f'[FEHLER] Registrierung fehlgeschlagen: {resp.status_code}')
        return False
    except requests.RequestException as e:
        print(f'[FEHLER] AlphaTrack nicht erreichbar: {e}')
        return False


_restart_requested = False


def main():
    global _restart_requested
    config = load_config()

    for field, placeholder in [
        ('alphatrack_url', 'http://192.168.1.X:3000'),
        ('profile_id', 'HIER_PROFIL_ID'),
        ('mt5_password', 'HIER_PASSWORT'),
    ]:
        if config.get(field) == placeholder:
            print(f'[FEHLER] {field} in config.json noch nicht gesetzt!')
            sys.exit(1)

    if not register_bot(config):
        sys.exit(1)

    bot_id = config['bot_id']
    local_log = LocalLog(bridge_id=bot_id, bridge_name=config['bot_name'])
    local_log.configure_push(config['alphatrack_url'], config.get('api_key', ''))
    set_log_callback(local_log.add)
    sync_to_alphatrack(config, local_log, None)

    mt5 = MT5Connector(
        login=config['mt5_login'],
        password=config['mt5_password'],
        server=config['mt5_server'],
    )
    if not mt5.connect():
        local_log.add('error', 'MT5-Verbindung fehlgeschlagen')
        sys.exit(1)

    set_candles_fetcher(mt5.copy_rates)
    set_account_fetcher(mt5.get_account_info)
    start_server(config['command_server_port'])

    strat_cfg = config.get('strategy', {})
    symbol = strat_cfg.get('symbol', 'EURUSDp')
    timeframe = strat_cfg.get('timeframe', 'M15')
    candles_count = int(strat_cfg.get('candles_count', 50))
    max_positions = int(strat_cfg.get('max_positions', 1))
    tick_interval_sec = 60  # M15 = alle 60s prüfen reicht

    state = {
        'state': 'running', 'mt5_connected': True,
        'active_symbols': [], 'open_positions': 0,
        'trades_sync': 0, 'start_time': time.time(),
        'balance': None, 'currency': None,
    }

    cmd_queue: queue.Queue = get_command_queue()
    running = True
    last_heartbeat = last_sync = last_tick = 0.0

    def shutdown(sig, frame):
        nonlocal running
        running = False

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)
    local_log.add('info', f'{config["bot_name"]} gestartet',
                  f'Symbol: {symbol} | TF: {timeframe} | N: {strat_cfg.get("n_periods", 20)}')

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
                local_log.add('warn', 'Bot gestoppt via Command')
            elif command == 'pause':
                state['state'] = 'paused'
                local_log.add('warn', 'Bot pausiert via Command')
            elif command in ('start', 'resume'):
                state['state'] = 'running'
                local_log.add('info', 'Bot gestartet/fortgesetzt via Command')
            elif command == 'restart':
                _restart_requested = True
                running = False
            elif command == 'close_position':
                payload = cmd.get('payload', {})
                result = (close_position(ticket=int(payload.get('ticket', 0)))
                          if mt5_ok else {'success': False, 'error': 'MT5 nicht verbunden'})
                set_trade_result(cmd.get('id', ''), result)
            elif command == 'execute_trade':
                payload = cmd.get('payload', {})
                if mt5_ok:
                    result = execute_trade(
                        symbol=payload.get('symbol', ''),
                        direction=payload.get('direction', 'buy'),
                        lots=float(payload.get('lots', 0.01)),
                        sl=float(payload.get('sl', 0) or 0),
                        tp=float(payload.get('tp', 0) or 0),
                    )
                else:
                    result = {'success': False, 'error': 'MT5 nicht verbunden'}
                set_trade_result(cmd.get('id', ''), result)

        # Strategy-Tick
        if state['state'] == 'running' and mt5_ok and now - last_tick >= tick_interval_sec:
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
                    local_log.add(
                        'info' if result.get('success') else 'error',
                        f"BUY {signal_result.get('lots')} {symbol} | SL={signal_result.get('sl')} TP={signal_result.get('tp')}",
                        result.get('error'),
                    )
                elif action == 'sell' and open_count < max_positions:
                    result = execute_trade(
                        symbol=symbol, direction='sell',
                        lots=float(signal_result.get('lots', 0.01)),
                        sl=float(signal_result.get('sl', 0) or 0),
                        tp=float(signal_result.get('tp', 0) or 0),
                    )
                    local_log.add(
                        'info' if result.get('success') else 'error',
                        f"SELL {signal_result.get('lots')} {symbol} | SL={signal_result.get('sl')} TP={signal_result.get('tp')}",
                        result.get('error'),
                    )
                elif action == 'close':
                    ticket = signal_result.get('ticket')
                    if ticket:
                        result = close_position(ticket=int(ticket))
                        local_log.add(
                            'info' if result.get('success') else 'error',
                            f"CLOSE Ticket #{ticket}", result.get('error'),
                        )
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
