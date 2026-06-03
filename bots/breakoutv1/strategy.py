"""
Strategie: Donchian-Breakout v1
Beschreibung:
  Kauft wenn der aktuelle Schlusskurs das Hoch der letzten N Kerzen überschreitet.
  Verkauft wenn der aktuelle Schlusskurs das Tief der letzten N Kerzen unterschreitet.
  SL wird direkt am Breakout-Niveau platziert, TP = 2x Risiko (1:2 RR).

Parameter (in config.json unter 'strategy'):
  - symbol:        Handelssymbol (z.B. "EURUSDp")
  - timeframe:     Kerzen-Intervall ("M15")
  - candles_count: Mindestens N+5 (Standard: 50)
  - n_periods:     Donchian-Periode (Standard: 20)
  - lots:          Handelsgröße (Standard: 0.01)
  - max_positions: Max. gleichzeitige Positionen (Standard: 1)
"""


def on_tick(candles: list, positions: list, config: dict) -> dict:
    cfg = config.get('strategy', {})
    symbol = cfg.get('symbol', 'EURUSDp')
    n = int(cfg.get('n_periods', 20))
    lots = float(cfg.get('lots', 0.01))

    # Mindestanzahl Kerzen prüfen
    if len(candles) < n + 2:
        return {'action': 'hold'}

    # Aktuelle Kerze + Lookback-Fenster (ohne aktuelle Kerze)
    current = candles[-1]
    lookback = candles[-(n + 1):-1]

    high_n = max(c['high'] for c in lookback)
    low_n = min(c['low'] for c in lookback)
    close = current['close']

    # Bereits offene Position auf diesem Symbol?
    open_on_symbol = [p for p in positions if p.get('symbol') == symbol]
    if open_on_symbol:
        return {'action': 'hold'}

    # Breakout nach oben: Schlusskurs über Donchian-Hoch
    if close > high_n:
        risk = close - high_n
        if risk <= 0:
            return {'action': 'hold'}
        sl = round(high_n, 5)
        tp = round(close + 2 * risk, 5)
        return {'action': 'buy', 'lots': lots, 'sl': sl, 'tp': tp}

    # Breakout nach unten: Schlusskurs unter Donchian-Tief
    if close < low_n:
        risk = low_n - close
        if risk <= 0:
            return {'action': 'hold'}
        sl = round(low_n, 5)
        tp = round(close - 2 * risk, 5)
        return {'action': 'sell', 'lots': lots, 'sl': sl, 'tp': tp}

    return {'action': 'hold'}
