"""
AI-Trading Strategy v41 — EMA Crossover + ATR with Volatility Filter
Symbol: EURUSDp M5
Focus: Add volatility regime filter to reduce whipsaws, stricter momentum thresholds
"""


def _ema(values: list, period: int) -> list:
    k = 2.0 / (period + 1)
    out = [None] * len(values)
    for i, v in enumerate(values):
        if i < period - 1:
            continue
        if i == period - 1:
            out[i] = sum(values[i - period + 1:i + 1]) / period
        else:
            out[i] = v * k + out[i - 1] * (1 - k)
    return out


def _atr(candles: list, period: int) -> float:
    if len(candles) < period + 1:
        return 0.0
    trs = []
    for i in range(max(1, len(candles) - period * 2), len(candles)):
        hi = float(candles[i]['high'])
        lo = float(candles[i]['low'])
        pc = float(candles[i - 1]['close'])
        trs.append(max(hi - lo, abs(hi - pc), abs(lo - pc)))
    return sum(trs[-period:]) / period if trs else 0.0


def _volatility_ratio(candles: list, period: int) -> float:
    """Calculate volatility ratio (current vs average)."""
    if len(candles) < period + 1:
        return 1.0
    
    volatilities = []
    for i in range(max(1, len(candles) - period), len(candles)):
        hi = float(candles[i]['high'])
        lo = float(candles[i]['low'])
        volatilities.append(hi - lo)
    
    avg_vol = sum(volatilities) / len(volatilities) if volatilities else 1.0
    current_vol = float(candles[-1]['high']) - float(candles[-1]['low'])
    
    return current_vol / avg_vol if avg_vol > 0 else 1.0


def _momentum(closes: list, period: int) -> float:
    """Momentum with direction consideration."""
    if len(closes) < period + 1:
        return 0.0
    recent = closes[-1]
    past = closes[-period-1]
    if past == 0:
        return 0.0
    return (recent - past) / past


def _consecutive_bars_direction(candles: list, direction: str, count: int) -> bool:
    """Check if last N bars show consistent direction."""
    if len(candles) < count:
        return False
    
    if direction == 'up':
        for i in range(-count + 1, 0):
            if float(candles[i]['close']) <= float(candles[i-1]['close']):
                return False
    elif direction == 'down':
        for i in range(-count + 1, 0):
            if float(candles[i]['close']) >= float(candles[i-1]['close']):
                return False
    
    return True


def _ema_trend_strength(ema_vals: list) -> float:
    """Measure EMA separation strength."""
    if len(ema_vals) < 2 or ema_vals[-1] is None or ema_vals[-2] is None:
        return 0.0
    return abs(ema_vals[-1] - ema_vals[-2])


def on_tick(candles: list, positions: list, config: dict) -> dict:
    cfg = config.get('strategy', {})
    symbol = cfg.get('symbol', 'EURUSDp')
    ema_fast = int(cfg.get('ema_fast', 5))
    ema_slow = int(cfg.get('ema_slow', 13))
    ema_trend = int(cfg.get('ema_trend', 34))
    atr_p = int(cfg.get('atr_period', 14))
    sl_mult = float(cfg.get('sl_atr_mult', 1.5))
    tp_mult = float(cfg.get('tp_atr_mult', 3.0))
    lots = float(cfg.get('lots', 0.01))

    min_candles = max(ema_slow, ema_trend, 50) + 10

    if len(candles) < min_candles:
        return {'action': 'hold'}

    closes = [float(c['close']) for c in candles]
    close = closes[-1]

    # Calculate indicators
    ema_f = _ema(closes, ema_fast)
    ema_s = _ema(closes, ema_slow)
    ema_t = _ema(closes, ema_trend)

    ef_curr, ef_prev = ema_f[-1], ema_f[-2]
    es_curr, es_prev = ema_s[-1], ema_s[-2]
    et_curr, et_prev = ema_t[-1], ema_t[-2]

    if None in (ef_curr, ef_prev, es_curr, es_prev, et_curr, et_prev):
        return {'action': 'hold'}

    curr_atr = _atr(candles, atr_p)
    if curr_atr <= 0:
        return {'action': 'hold'}

    # Check if position already open
    if [p for p in positions if p.get('instrument') == symbol]:
        return {'action': 'hold'}

    # Volatility regime filter - avoid extremely low or high volatility
    vol_ratio = _volatility_ratio(candles, 20)
    if vol_ratio < 0.5 or vol_ratio > 2.5:
        return {'action': 'hold'}

    momentum_5 = _momentum(closes, 5)
    momentum_10 = _momentum(closes, 10)
    trend_strength = _ema_trend_strength(ema_s)
    
    # BUY signal: stricter conditions
    if (ef_prev <= es_prev and ef_curr > es_curr and 
        close > et_curr and et_curr > et_prev and
        momentum_5 > 0.00015 and momentum_10 > 0.00008 and
        _consecutive_bars_direction(candles, 'up', 3) and
        trend_strength > 0.00001):
        
        sl = close - sl_mult * curr_atr
        tp = close + tp_mult * curr_atr
        
        if sl < close and tp > close and (tp - close) / (close - sl) >= 1.5:
            return {
                'action': 'buy',
                'lots': lots,
                'sl': round(sl, 5),
                'tp': round(tp, 5),
            }

    # SELL signal: stricter conditions
    if (ef_prev >= es_prev and ef_curr < es_curr and 
        close < et_curr and et_curr < et_prev and
        momentum_5 < -0.00015 and momentum_10 < -0.00008 and
        _consecutive_bars_direction(candles, 'down', 3) and
        trend_strength > 0.00001):
        
        sl = close + sl_mult * curr_atr
        tp = close - tp_mult * curr_atr
        
        if sl > close and tp < close and (close - tp) / (sl - close) >= 1.5:
            return {
                'action': 'sell',
                'lots': lots,
                'sl': round(sl, 5),
                'tp': round(tp, 5),
            }

    return {'action': 'hold'}