"""
AI-Trading Bot — Live Trading Loop
Kommuniziert mit der Bridge ueber WebSocket (AGP/1).
Strategie: strategy.py (wird durch autoresearch.py optimiert)
"""
import json
import os
import signal
import socket
import sys
import time

from bridge_client import BridgeClient
from bot_display import BotDisplay
from bot_log import BotLog
from strategy import on_tick
from ws_client import BridgeWSClient

CONFIG_FILE = os.path.join(os.path.dirname(__file__), 'config.json')


def load_config() -> dict:
    if not os.path.exists(CONFIG_FILE):
        print('[FEHLER] config.json nicht gefunden!')
        sys.exit(1)
    with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def _get_local_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


_restart_requested = False


def main():
    global _restart_requested
    config = load_config()

    if config.get('api_key') in ('', None):
        print('[FEHLER] api_key in config.json nicht gesetzt!')
        sys.exit(1)

    # Bot-Terminal-Display starten (statischer Header: ID, Name, IP:Port, Latenz, Status, Trades)
    display = BotDisplay(bot_name=config['bot_name'])
    display.log('info', 'BOT', f"Starte {config['bot_name']} ...")

    ws_client = BridgeWSClient(
        bridge_url=config['bridge_url'],
        api_key=config['api_key'],
        bot_name=config['bot_name'],
        bot_version=config.get('bot_version', '1.0.0'),
        bot_id=config.get('bot_id', ''),
        bot_type=config.get('bot_type', 'bot'),
        bot_port=config.get('bot_port', 0),
    )

    display.log('info', 'BOT', f"Verbinde mit Bridge: {config['bridge_url']}")
    if not ws_client.connect():
        display.log('error', 'BOT', 'WebSocket-Registrierung fehlgeschlagen.')
        sys.exit(1)

    bot_id = ws_client.get_bot_id() or config.get('bot_id', 'unknown')
    latency_ms = ws_client.get_latency_ms()
    local_ip = _get_local_ip()
    bot_port = config.get('bot_port', 0)

    display.log('ok', 'BOT', f'Registriert: {bot_id}')

    # Identitaets-Felder im Header setzen (nach Registrierung, wenn bot_id bekannt)
    display.set_identity(
        bot_id=bot_id,
        bot_ip=local_ip,
        bot_port=bot_port,
        latency_ms=latency_ms,
    )

    local_log = BotLog(bot_id=bot_id, bot_name=config['bot_name'])
    local_log.configure_push(
        config.get('alphatrack_url', ''),
        config.get('api_key', ''),
    )
    # Erstelle BridgeClient mit bot_id fuer C4-konformes Trade-Routing (bot_id als Metadatum)
    bridge = BridgeClient(config['bridge_url'], config['api_key'], bot_id=bot_id)

    cfg = config.get('strategy', {})
    symbol = cfg.get('symbol', 'EURUSDp')
    timeframe = cfg.get('timeframe', 'M5')
    candles_count = int(cfg.get('candles_count', 200))
    max_positions = int(cfg.get('max_positions', 1))
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

    start_msg = f'{config["bot_name"]} gestartet'
    start_detail = f'Symbol: {symbol} | TF: {timeframe}'
    ws_client.send_log('info', start_msg, start_detail)
    local_log.add('info', start_msg, start_detail)
    display.log('ok', 'BOT', f'{start_msg} | {start_detail}')

    display.start()

    while running:
        now = time.time()
        bridge_ok = bridge.is_connected()
        bridge_ok_ws = ws_client.is_connected()

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
                display.log('warn', 'CMD', 'Bot gestoppt via Command')
            elif command == 'pause':
                state['state'] = 'paused'
                ws_client.send_log('warn', 'Bot pausiert via Command')
                local_log.add('warn', 'Bot pausiert via Command')
                display.log('warn', 'CMD', 'Bot pausiert via Command')
            elif command in ('start', 'resume'):
                state['state'] = 'running'
                ws_client.send_log('info', 'Bot fortgesetzt via Command')
                local_log.add('info', 'Bot fortgesetzt via Command')
                display.log('info', 'CMD', 'Bot fortgesetzt via Command')
            elif command == 'restart':
                _restart_requested = True
                running = False
            elif command == 'mt5_error':
                # MT5-Fehlermeldung von Bridge an Bot weitergeleitet (C3)
                error_msg = cmd.get('payload', {}).get('error', 'MT5-Fehler')
                ws_client.send_log('error', f'MT5-Fehler: {error_msg}')
                local_log.add('error', f'MT5-Fehler', error_msg)
                display.log('error', 'MT5', f'Fehler: {error_msg}')
            elif command == 'close_position':
                payload = cmd.get('payload') or {}
                result = bridge.close_position(ticket=int(payload.get('ticket', 0))) if bridge_ok else {'success': False, 'error': 'Bridge offline'}
                ws_client.send_trade_result(cmd_id, result.get('success', False), error=result.get('error'))
                level = 'ok' if result.get('success') else 'error'
                ticket = payload.get('ticket', '?')
                local_log.add(level, f'CLOSE #{ticket}', result.get('error'))
                display.log(level, 'TRADE', f'CLOSE #{ticket}')
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
                    result = {'success': False, 'error': 'Bridge offline'}
                ws_client.send_trade_result(cmd_id, result.get('success', False),
                                            ticket=result.get('ticket'), price=result.get('price'),
                                            error=result.get('error'))
                level = 'ok' if result.get('success') else 'error'
                direction = payload.get('direction', '?').upper()
                lots = payload.get('lots', '?')
                sym = payload.get('symbol', '?')
                msg = f'{direction} {lots} {sym}'
                local_log.add(level, f'Trade: {msg}', result.get('error'))
                display.log(level, 'TRADE', msg)

        # Strategie-Tick
        if state['state'] == 'running' and bridge_ok and now - last_tick >= tick_interval_sec:
            try:
                candles = bridge.get_candles(symbol, timeframe, candles_count)
                positions = bridge.get_positions()
                sig = on_tick(candles, positions, config)
                action = sig.get('action', 'hold')
                open_count = len([p for p in positions if p.get('instrument') == symbol])

                if action == 'buy' and open_count < max_positions:
                    result = bridge.execute_trade(symbol=symbol, direction='buy',
                                                  lots=float(sig.get('lots', 0.01)),
                                                  sl=float(sig.get('sl', 0) or 0),
                                                  tp=float(sig.get('tp', 0) or 0))
                    msg = f"BUY {sig.get('lots')} {symbol} | SL={sig.get('sl')} TP={sig.get('tp')}"
                    level = 'info' if result.get('success') else 'error'
                    ws_client.send_log(level, msg, result.get('error'))
                    local_log.add(level, msg, result.get('error'))
                    display.log(level, 'TRADE', msg)

                elif action == 'sell' and open_count < max_positions:
                    result = bridge.execute_trade(symbol=symbol, direction='sell',
                                                  lots=float(sig.get('lots', 0.01)),
                                                  sl=float(sig.get('sl', 0) or 0),
                                                  tp=float(sig.get('tp', 0) or 0))
                    msg = f"SELL {sig.get('lots')} {symbol} | SL={sig.get('sl')} TP={sig.get('tp')}"
                    level = 'info' if result.get('success') else 'error'
                    ws_client.send_log(level, msg, result.get('error'))
                    local_log.add(level, msg, result.get('error'))
                    display.log(level, 'TRADE', msg)

                elif action == 'close':
                    ticket = sig.get('ticket')
                    if ticket:
                        result = bridge.close_position(ticket=int(ticket))
                        level = 'info' if result.get('success') else 'error'
                        ws_client.send_log(level, f"CLOSE #{ticket}", result.get('error'))
                        local_log.add(level, f"CLOSE #{ticket}", result.get('error'))
                        display.log(level, 'TRADE', f"CLOSE #{ticket}")

            except Exception as exc:
                ws_client.send_log('error', 'Strategie-Fehler', str(exc))
                local_log.add('error', 'Strategie-Fehler', str(exc))
                display.log('error', 'STRAT', str(exc))
            last_tick = now

        # Heartbeat
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

        # Display aktualisieren
        display.update_status(
            at_ok=True,  # AlphaTrack-Status: Verbindung wird indirekt ueber Bridge getrackt
            bridge_ok=bridge_ok and bridge_ok_ws,
            bot_state=state['state'],
            open_trades=state['open_positions'],
        )

        time.sleep(1)

    end_msg = f'{config["bot_name"]} beendet'
    ws_client.send_log('info', end_msg)
    local_log.add('info', end_msg)
    display.log('info', 'BOT', end_msg)
    ws_client.send_heartbeat(state='stopped', open_positions=state['open_positions'],
                             active_symbols=state['active_symbols'], trades_sync=state['trades_sync'],
                             uptime=int(time.time() - state['start_time']),
                             balance=state['balance'], currency=state['currency'])
    ws_client.disconnect()
    display.stop()


if __name__ == '__main__':
    main()
    sys.exit(75 if _restart_requested else 0)
