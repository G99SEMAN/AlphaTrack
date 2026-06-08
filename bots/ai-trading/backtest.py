"""
Backtesting-Engine für AI-Trading.
Unterstützt Bridge-Live-Daten und historische CSV-Dateien (Train/Val-Split).
"""
import csv
import json
import math
import os

import requests

CONFIG_FILE = os.path.join(os.path.dirname(__file__), 'config.json')
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
SPREAD = 0.00010
WINDOW_SIZE = 150
BRIDGE_CANDLE_COUNT = 2000


def load_csv(filepath: str) -> list:
    candles = []
    with open(filepath, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            candles.append({
                'datetime': row['datetime'],
                'open':  float(row['open']),
                'high':  float(row['high']),
                'low':   float(row['low']),
                'close': float(row['close']),
            })
    return candles


def _fetch_bridge(bridge_url: str, api_key: str, symbol: str, tf: str, count: int) -> list:
    try:
        r = requests.get(
            f"{bridge_url.rstrip('/')}/candles",
            params={"symbol": symbol, "interval": tf, "count": count},
            headers={"X-Bot-Api-Key": api_key},
            timeout=30,
        )
        return r.json().get("candles", []) if r.ok else []
    except Exception as e:
        print(f"[BACKTEST] Bridge-Abruf fehlgeschlagen: {e}")
        return []


def _simulate(candles: list, config: dict) -> dict:
    from strategy import on_tick

    cfg = config.get('strategy', {})
    symbol = cfg.get('symbol', 'EURUSDp')
    lots = float(cfg.get('lots', 0.01))
    trades = []
    positions = []

    for i in range(WINDOW_SIZE, len(candles)):
        window = candles[i - WINDOW_SIZE + 1:i + 1]
        signal = on_tick(window, positions, config)
        action = signal.get('action', 'hold')
        close = float(candles[i]['close'])
        hi = float(candles[i]['high'])
        lo = float(candles[i]['low'])

        if action in ('buy', 'sell') and not positions:
            entry = close + SPREAD if action == 'buy' else close - SPREAD
            positions = [{
                'instrument': symbol,
                'type': 'long' if action == 'buy' else 'short',
                'entry': entry,
                'sl': float(signal.get('sl') or 0),
                'tp': float(signal.get('tp') or 0),
                'lots': lots,
            }]
            continue

        if positions:
            pos = positions[0]
            if pos['type'] == 'long':
                if pos['sl'] and lo <= pos['sl']:
                    trades.append(pos['sl'] - pos['entry']); positions = []
                elif pos['tp'] and hi >= pos['tp']:
                    trades.append(pos['tp'] - pos['entry']); positions = []
            else:
                if pos['sl'] and hi >= pos['sl']:
                    trades.append(pos['entry'] - pos['sl']); positions = []
                elif pos['tp'] and lo <= pos['tp']:
                    trades.append(pos['entry'] - pos['tp']); positions = []

    if positions:
        pos = positions[0]
        last = float(candles[-1]['close'])
        trades.append(last - pos['entry'] if pos['type'] == 'long' else pos['entry'] - last)

    return {'trades': trades}


def _sharpe(trades: list) -> float:
    n = len(trades)
    if n < 20:
        return -999.0
    mean = sum(trades) / n
    var = sum((t - mean) ** 2 for t in trades) / n
    std = math.sqrt(var) if var > 0 else 0.0
    if std == 0:
        return 0.0
    return (mean / std) * math.sqrt(288 * 252)


def _evaluate(candles: list, config: dict, label: str) -> dict:
    if len(candles) < WINDOW_SIZE + 50:
        msg = f"Zu wenig Kerzen: {len(candles)}"
        print(f"[{label}] {msg}")
        return {'sharpe': -999.0, 'n_trades': 0, 'error': msg}

    print(f"[{label}] {len(candles)} Kerzen, simuliere...")
    result = _simulate(candles, config)
    trades = result['trades']
    sharpe = _sharpe(trades)
    n = len(trades)
    win_rate = (sum(1 for t in trades if t > 0) / n * 100) if n > 0 else 0.0
    print(f"[{label}] Sharpe={sharpe:.3f} | Trades={n} | Win%={win_rate:.1f}")
    return {'sharpe': sharpe, 'n_trades': n, 'win_rate': win_rate}


def run_backtest(config: dict = None, csv_file: str = None) -> dict:
    """Trainings-Backtest (für autoresearch Loop). csv_file überschreibt Bridge."""
    if config is None:
        with open(CONFIG_FILE, 'r') as f:
            config = json.load(f)

    # CSV hat Vorrang vor Bridge
    if csv_file is None:
        csv_file = config.get('train_csv')

    if csv_file:
        path = csv_file if os.path.isabs(csv_file) else os.path.join(DATA_DIR, csv_file)
        print(f"[TRAIN] Lade CSV: {os.path.basename(path)}")
        candles = load_csv(path)
    else:
        cfg = config.get('strategy', {})
        print(f"[TRAIN] Lade {BRIDGE_CANDLE_COUNT} Kerzen von Bridge...")
        candles = _fetch_bridge(
            config.get('bridge_url', 'http://localhost:8765'),
            config.get('api_key', ''),
            cfg.get('symbol', 'EURUSDp'),
            cfg.get('timeframe', 'M5'),
            BRIDGE_CANDLE_COUNT,
        )

    return _evaluate(candles, config, 'TRAIN')


def run_validation(config: dict = None, csv_file: str = None) -> dict:
    """Validierungs-Backtest (Out-of-Sample). Wird nicht für keep/revert genutzt."""
    if config is None:
        with open(CONFIG_FILE, 'r') as f:
            config = json.load(f)

    if csv_file is None:
        csv_file = config.get('val_csv')

    if not csv_file:
        return {'sharpe': None, 'n_trades': 0, 'error': 'Kein val_csv konfiguriert'}

    path = csv_file if os.path.isabs(csv_file) else os.path.join(DATA_DIR, csv_file)
    if not os.path.exists(path):
        return {'sharpe': None, 'n_trades': 0, 'error': f'Datei nicht gefunden: {path}'}

    print(f"[VAL] Lade CSV: {os.path.basename(path)}")
    candles = load_csv(path)
    return _evaluate(candles, config, 'VAL')


if __name__ == '__main__':
    import sys
    config = json.load(open(CONFIG_FILE))
    mode = sys.argv[1] if len(sys.argv) > 1 else 'train'
    if mode == 'val':
        result = run_validation(config)
    else:
        result = run_backtest(config)
    print(json.dumps({'sharpe': result['sharpe'], 'n_trades': result['n_trades']}, indent=2))
