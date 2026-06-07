"""
Backtesting-Engine fuer den FVG-Scalper.
Leitet M5/M15/H1/H4 aus M1-Rohdaten ab (Aggregation).
Verwendet MockBridge damit on_tick() ohne echte Bridge laufen kann.
"""
import csv
import json
import math
import os
import sys

CONFIG_FILE = os.path.join(os.path.dirname(__file__), 'config.json')
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')

SPREAD = 1.0        # NDAQ.OQ Spread in Punkten
WINDOW_SIZE = 100   # M1-Kerzen pro on_tick Aufruf (entspricht config.candles_count)

# Annualisierung: M1, Session ~540min/Tag, 252 Handelstage
_SHARPE_SCALE = math.sqrt(540 * 252)

TF_FACTORS = {'M1': 1, 'M5': 5, 'M15': 15, 'H1': 60, 'H4': 240}


# ── CSV laden ────────────────────────────────────────────────────────────

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


# ── TF-Aggregation aus M1 ────────────────────────────────────────────────

def _aggregate(m1: list, factor: int) -> list:
    """Jede `factor` aufeinanderfolgende M1-Kerzen → 1 höhere TF-Kerze (OHLC)."""
    result = []
    for i in range(0, len(m1) - factor + 1, factor):
        group = m1[i:i + factor]
        result.append({
            'datetime': group[0]['datetime'],
            'open':  group[0]['open'],
            'high':  max(c['high'] for c in group),
            'low':   min(c['low'] for c in group),
            'close': group[-1]['close'],
        })
    return result


def _build_tf_sets(m1: list) -> dict:
    return {
        'M1':  m1,
        'M5':  _aggregate(m1, 5),
        'M15': _aggregate(m1, 15),
        'H1':  _aggregate(m1, 60),
        'H4':  _aggregate(m1, 240),
    }


# ── Mock Bridge ──────────────────────────────────────────────────────────

class _MockBridge:
    """Liefert historische TF-Kerzen wie die echte Bridge, aber aus CSV-Daten."""

    def __init__(self, tf_sets: dict):
        self._sets = tf_sets
        self._m1_idx = 0  # aktueller M1-Index (simulierte Gegenwart)

    def set_idx(self, m1_idx: int) -> None:
        self._m1_idx = m1_idx

    def get_candles(self, symbol: str, interval: str, count: int) -> list:
        factor = TF_FACTORS.get(interval, 1)
        tf_list = self._sets.get(interval, [])
        # Nur Kerzen die bis zum aktuellen M1-Index vollständig sind
        available_count = (self._m1_idx + 1) // factor
        available = tf_list[:available_count]
        return available[-count:] if len(available) >= count else available

    def is_connected(self) -> bool:
        return True


# ── Simulation ───────────────────────────────────────────────────────────

def _simulate(m1_candles: list, config: dict) -> dict:
    tf_sets = _build_tf_sets(m1_candles)
    mock = _MockBridge(tf_sets)

    # Strategie importieren und Instanz erstellen
    sys.modules.pop('strategy', None)
    try:
        from strategy import FVGScalper
    except Exception as e:
        return {'trades': [], 'error': f'Import-Fehler: {e}'}

    bot = FVGScalper(bot_id='backtest', name='backtest', port=0)
    bot._config = config
    bot._bridge = mock
    bot._in_session = lambda: True  # Immer in Session im Backtest

    cfg = config.get('strategy', {})
    symbol = cfg.get('symbol', 'NDAQ.OQ')
    positions = []
    trades = []
    pos_direction = None

    for i in range(WINDOW_SIZE, len(m1_candles)):
        mock.set_idx(i)
        window = m1_candles[i - WINDOW_SIZE + 1:i + 1]

        try:
            signal = bot.on_tick(window, positions)
        except Exception:
            signal = {'action': 'hold'}

        action = signal.get('action', 'hold')
        close = m1_candles[i]['close']
        hi    = m1_candles[i]['high']
        lo    = m1_candles[i]['low']

        # Offene Position: SL/TP prüfen oder manuell schliessen
        if positions:
            pos = positions[0]
            closed = False

            if action == 'close':
                pnl = (close - pos['entry']) if pos_direction == 'long' else (pos['entry'] - close)
                trades.append(pnl)
                closed = True
            elif pos_direction == 'long':
                if pos['sl'] and lo <= pos['sl']:
                    trades.append(pos['sl'] - pos['entry']); closed = True
                elif pos['tp'] and hi >= pos['tp']:
                    trades.append(pos['tp'] - pos['entry']); closed = True
            elif pos_direction == 'short':
                if pos['sl'] and hi >= pos['sl']:
                    trades.append(pos['entry'] - pos['sl']); closed = True
                elif pos['tp'] and lo <= pos['tp']:
                    trades.append(pos['entry'] - pos['tp']); closed = True

            if closed:
                positions = []
                pos_direction = None
            continue  # kein neuer Entry wenn Position offen war

        # Neuer Entry
        if action in ('buy', 'sell'):
            entry = close + SPREAD if action == 'buy' else close - SPREAD
            pos_direction = 'long' if action == 'buy' else 'short'
            positions = [{
                'instrument': symbol,
                'type': pos_direction,
                'entry': entry,
                'sl': float(signal.get('sl') or 0),
                'tp': float(signal.get('tp') or 0),
                'ticket': i,
            }]

    # Offene Position am Ende schliessen
    if positions:
        pos = positions[0]
        last = m1_candles[-1]['close']
        pnl = (last - pos['entry']) if pos_direction == 'long' else (pos['entry'] - last)
        trades.append(pnl)

    return {'trades': trades}


def _sharpe(trades: list) -> float:
    n = len(trades)
    if n < 20:
        return -999.0
    mean = sum(trades) / n
    var  = sum((t - mean) ** 2 for t in trades) / n
    std  = math.sqrt(var) if var > 0 else 0.0
    return 0.0 if std == 0 else (mean / std) * _SHARPE_SCALE


def _evaluate(candles: list, config: dict, label: str) -> dict:
    if len(candles) < WINDOW_SIZE + 50:
        msg = f"Zu wenig Kerzen: {len(candles)}"
        print(f"[{label}] {msg}")
        return {'sharpe': -999.0, 'n_trades': 0, 'error': msg}

    print(f"[{label}] {len(candles)} M1-Kerzen, simuliere...")
    result = _simulate(candles, config)

    if result.get('error'):
        print(f"[{label}] Fehler: {result['error']}")
        return {'sharpe': -999.0, 'n_trades': 0, 'error': result['error']}

    trades = result['trades']
    sharpe = _sharpe(trades)
    n = len(trades)
    win_rate = (sum(1 for t in trades if t > 0) / n * 100) if n > 0 else 0.0
    print(f"[{label}] Sharpe={sharpe:.3f} | Trades={n} | Win%={win_rate:.1f}")
    return {'sharpe': sharpe, 'n_trades': n, 'win_rate': win_rate}


# ── Öffentliche API ──────────────────────────────────────────────────────

def run_backtest(config: dict = None, csv_file: str = None) -> dict:
    if config is None:
        with open(CONFIG_FILE, 'r') as f:
            config = json.load(f)

    if csv_file is None:
        csv_file = config.get('train_csv')

    if csv_file:
        path = csv_file if os.path.isabs(csv_file) else os.path.join(DATA_DIR, csv_file)
        print(f"[TRAIN] Lade CSV: {os.path.basename(path)}")
        candles = load_csv(path)
    else:
        print("[FEHLER] Kein train_csv in config.json konfiguriert.")
        print("  Zuerst: python data/fetch_history.py")
        return {'sharpe': -999.0, 'n_trades': 0, 'error': 'Kein CSV'}

    return _evaluate(candles, config, 'TRAIN')


def run_validation(config: dict = None, csv_file: str = None) -> dict:
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
    config = json.load(open(CONFIG_FILE))
    mode = sys.argv[1] if len(sys.argv) > 1 else 'train'
    result = run_validation(config) if mode == 'val' else run_backtest(config)
    print(json.dumps({'sharpe': result.get('sharpe'), 'n_trades': result.get('n_trades')}, indent=2))
