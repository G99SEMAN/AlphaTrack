"""
AlphaTrack Trading Bot — Hauptprogramm
Kommuniziert mit der Bridge ausschließlich über WebSocket (AGP/1).
"""
import json
import os
import signal
import sys
import time

from bridge_client import BridgeClient
from local_log import LocalLog
from strategy import on_tick
from ws_client import BridgeWSClient

CONFIG_FILE = os.path.join(os.path.dirname(__file__), 'config.json')


def load_config() -> dict:
    if not os.path.exists(CONFIG_FILE):
        print('[FEHLER] config.json nicht gefunden! Bitte zuerst konfigurieren.')
        sys.exit(1)
    with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


_restart_requested = False


def main():
    global _restart_requested
    config = load_config()

    if config.get('api_key') in ('HIER_API_KEY', '', None):
        print('[FEHLER] api_key in config.json noch nicht gesetzt!')
        sys.exit(1)

    ws_client = BridgeWSClient(
        bridge_url=config['bridge_url'],
        api_key=config['api_key'],
        bot_name=config['bot_name'],
        bot_version=config.get('bot_version', '1.0.0'),
    )

    print(f'[...] Verbinde mit Bridge via WebSocket: {config["bridge_url"]}')
    if not ws_client.connect():
        print('[FEHLER] WebSocket-Registrierung fehlgeschlagen.')
        sys.exit(1)

    bot_id = ws_client.get_bot_id() or 'unknown'
    print(f'[OK] Bot registriert: {bot_id}')

    local_log = LocalLog(bridge_id=bot_id, bridge_name=config['bot_name'])

    bridge = BridgeClient(config['bridge_url'], config['api_key'])

    strat_cfg = config.get('strategy', {})
    symbol = strat_cfg.get('symbol', 'EURUSDp')
    timeframe = strat_cfg.get('timeframe', 'M15')
    candles_count = int(strat_cfg.get('candles_count', 50))
    max_positions = int(strat_cfg.get('max_positions', 1))
    tick_interval_sec = 60

    state = {
        'state': 'running',
        'active_symbols': [],
        'open_positions': 0,
        'trades_sync': 0,
        'start_time': time.time(),
        'balance': None,
        'currency': None,
    }

    running = True
    last_heartbeat = last_tick = 0.0

    def shutdown(sig, frame):
        nonlocal running
        running = False

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    ws_client.send_log('info', f'{config["bot_name"]} gestartet',
                       f'Symbol: {symbol} | TF: {timeframe} | Bridge: {config["bridge_url"]}')
    local_log.add('info', f'{config["bot_name"]} gestartet',
                  f'Symbol: {symbol} | TF: {timeframe} | Bridge: {config["bridge_url"]}')

    while running:
        now = time.time()

        if not ws_client.is_connected():
            ws_client.send_log('warn', 'WS-Verbindung verloren, warte auf Reconnect...')

        bridge_ok = bridge.is_connected()

        if bridge_ok:
            positions = bridge.get_positions()
            state['open_positions'] = len(positions)
            state['active_symbols'] = list({p.get('instrument') for p in positions if p.get('instrument')})
            account = bridge.get_account_info()
            if account:
                state['balance'] = account.get('balance')
                state['currency'] = account.get('currency')

        # Commands verarbeiten
        while True:
            cmd = ws_client.get_command()
            if cmd is None:
                break
            command = cmd['command']
            cmd_id = cmd.get('cmd_id', '')

            if command == 'stop':
                state['state'] = 'stopped'
                ws_client.send_log('warn', 'Bot gestoppt via Command')
                local_log.add('warn', 'Bot gestoppt via Command')

            elif command == 'pause':
                state['state'] = 'paused'
                ws_client.send_log('warn', 'Bot pausiert via Command')
                local_log.add('warn', 'Bot pausiert via Command')

            elif command in ('start', 'resume'):
                state['state'] = 'running'
                ws_client.send_log('info', 'Bot gestartet/fortgesetzt via Command')
                local_log.add('info', 'Bot gestartet/fortgesetzt via Command')

            elif command == 'restart':
                _restart_requested = True
                running = False

            elif command == 'close_position':
                payload = cmd.get('payload') or {}
                if bridge_ok:
                    result = bridge.close_position(ticket=int(payload.get('ticket', 0)))
                else:
                    result = {'success': False, 'error': 'Bridge nicht verbunden'}
                ws_client.send_trade_result(cmd_id, result.get('success', False),
                                            error=result.get('error'))

            elif command == 'execute_trade':
                payload = cmd.get('payload') or {}
                if bridge_ok:
                    result = bridge.execute_trade(
                        symbol=payload.get('symbol', ''),
                        direction=payload.get('direction', 'buy'),
                        lots=float(payload.get('lots', 0.01)),
                        sl=float(payload.get('sl', 0) or 0),
                        tp=float(payload.get('tp', 0) or 0),
                    )
                else:
                    result = {'success': False, 'error': 'Bridge nicht verbunden'}
                ws_client.send_trade_result(
                    cmd_id, result.get('success', False),
                    ticket=result.get('ticket'),
                    price=result.get('price'),
                    error=result.get('error'),
                )

        # Strategy-Tick
        if state['state'] == 'running' and bridge_ok and now - last_tick >= tick_interval_sec:
            try:
                candles = bridge.get_candles(symbol, timeframe, candles_count)
                positions = bridge.get_positions()
                signal_result = on_tick(candles, positions, config)
                action = signal_result.get('action', 'hold')
                open_count = len([p for p in positions if p.get('instrument') == symbol])

                if action == 'buy' and open_count < max_positions:
                    result = bridge.execute_trade(
                        symbol=symbol, direction='buy',
                        lots=float(signal_result.get('lots', 0.01)),
                        sl=float(signal_result.get('sl', 0) or 0),
                        tp=float(signal_result.get('tp', 0) or 0),
                    )
                    msg = f"BUY {signal_result.get('lots')} {symbol} | SL={signal_result.get('sl')} TP={signal_result.get('tp')}"
                    level = 'info' if result.get('success') else 'error'
                    ws_client.send_log(level, msg, result.get('error'))
                    local_log.add(level, msg, result.get('error'))

                elif action == 'sell' and open_count < max_positions:
                    result = bridge.execute_trade(
                        symbol=symbol, direction='sell',
                        lots=float(signal_result.get('lots', 0.01)),
                        sl=float(signal_result.get('sl', 0) or 0),
                        tp=float(signal_result.get('tp', 0) or 0),
                    )
                    msg = f"SELL {signal_result.get('lots')} {symbol} | SL={signal_result.get('sl')} TP={signal_result.get('tp')}"
                    level = 'info' if result.get('success') else 'error'
                    ws_client.send_log(level, msg, result.get('error'))
                    local_log.add(level, msg, result.get('error'))

                elif action == 'close':
                    ticket = signal_result.get('ticket')
                    if ticket:
                        result = bridge.close_position(ticket=int(ticket))
                        level = 'info' if result.get('success') else 'error'
                        ws_client.send_log(level, f"CLOSE Ticket #{ticket}", result.get('error'))
                        local_log.add(level, f"CLOSE Ticket #{ticket}", result.get('error'))

            except Exception as exc:
                ws_client.send_log('error', 'Strategie-Fehler', str(exc))
                local_log.add('error', 'Strategie-Fehler', str(exc))
            last_tick = now

        # Heartbeat via WS
        if now - last_heartbeat >= config['heartbeat_interval_sec']:
            ws_client.send_heartbeat(
                state=state['state'],
                open_positions=state['open_positions'],
                active_symbols=state['active_symbols'],
                trades_sync=state['trades_sync'],
                uptime=int(now - state['start_time']),
                balance=state['balance'],
                currency=state['currency'],
            )
            last_heartbeat = now

        time.sleep(1)

    ws_client.send_log('info', f'{config["bot_name"]} beendet')
    local_log.add('info', f'{config["bot_name"]} beendet')
    ws_client.send_heartbeat(
        state='stopped',
        open_positions=state['open_positions'],
        active_symbols=state['active_symbols'],
        trades_sync=state['trades_sync'],
        uptime=int(time.time() - state['start_time']),
        balance=state['balance'],
        currency=state['currency'],
    )
    ws_client.disconnect()


if __name__ == '__main__':
    main()
    sys.exit(75 if _restart_requested else 0)
