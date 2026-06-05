"""
AI-Trading Strategy v6 — EMA Crossover Trend Following with ATR-based SL/TP
Key insight: The mean reversion approach generates too many losing trades in trending markets.
Switch back to trend following but with better filters:
- Use EMA crossover (fast/slow) as entry signal
- Trend filter: price must be above/below trend EMA
- ATR-based SL/TP with wider multipliers for better RR
- RSI filter to avoid entering in extreme conditions
- Simpler, fewer conditions = more trades with better edge
"""

import math
import statistics


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


def _rsi(values: list, period: int) -> float:
    if len(values) < period + 1:
        return 50.0
    gains, losses = [], []
    for i in range(len(values) - period, len(values)):
        delta = values[i] - values[i - 1]
        gains.append(max(delta, 0.0))
        losses.append(max(-delta, 0.0))
    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100.0 - (100.0 / (1.0 + rs))


def _adx(candles: list, period: int) -> float:
    """Calculate ADX to measure trend strength."""
    if len(candles) < period * 2 + 1:
        return 0.0

    window = candles[-(period * 2 + 1):]
    plus_dms = []
    minus_dms = []
    trs = []

    for i in range(1, len(window)):
        hi = float(window[i]['high'])
        lo = float(window[i]['low'])
        phi = float(window[i - 1]['high'])
        plo = float(window[i - 1]['low'])
        pc = float(window[i - 1]['close'])

        up_move = hi - phi
        down_move = plo - lo
        plus_dm = up_move if (up_move > down_move and up_move > 0) else 0.0
        minus_dm = down_move if (down_move > up_move and down_move > 0) else 0.0

        tr = max(hi - lo, abs(hi - pc), abs(lo - pc))
        plus_dms.append(plus_dm)
        minus_dms.append(minus_dm)
        trs.append(tr)

    # Smooth over period
    def smooth(vals, p):
        if len(vals) < p:
            return 0.0
        s = sum(vals[:p])
        for v in vals[p:]:
            s = s - s / p + v
        return s

    atr_s = smooth(trs, period)
    plus_s = smooth(plus_dms, period)
    minus_s = smooth(minus_dms, period)

    if atr_s == 0:
        return 0.0

    plus_di = 100.0 * plus_s / atr_s
    minus_di = 100.0 * minus_s / atr_s
    di_sum = plus_di + minus_di
    if di_sum == 0:
        return 0.0

    dx = 100.0 * abs(plus_di - minus_di) / di_sum

    # Simplified ADX: just return dx as proxy
    return dx


def on_tick(candles: list, positions: list, config: dict) -> dict:
    cfg = config.get('strategy', {})
    symbol = cfg.get('symbol', 'EURUSDp')
    fast = int(cfg.get('ema_fast', 8))
    slow = int(cfg.get('ema_slow', 21))
    trend_p = int(cfg.get('ema_trend', 50))
    atr_p = int(cfg.get('atr_period', 14))
    sl_mult = float(cfg.get('sl_atr_mult', 1.0))
    tp_mult = float(cfg.get('tp_atr_mult', 2.0))
    lots = float(cfg.get('lots', 0.01))

    min_candles = max(slow, trend_p, atr_p) + 40
    if len(candles) < min_candles:
        return {'action': 'hold'}

    # Time filter: London + NY sessions (7:00-20:00 UTC)
    last_dt = candles[-1].get('datetime', '')
    if last_dt:
        try:
            if 'T' in str(last_dt):
                hour = int(str(last_dt).split('T')[1].split(':')[0])
            else:
                hour = int(str(last_dt).split(' ')[1].split(':')[0])
            if hour < 7 or hour >= 20:
                return {'action': 'hold'}
        except (IndexError, ValueError):
            pass

    closes = [float(c['close']) for c in candles]
    close = closes[-1]

    ef = _ema(closes, fast)
    es = _ema(closes, slow)
    et = _ema(closes, trend_p)

    cf, cs = ef[-1], es[-1]
    pf, ps = ef[-2], es[-2]
    trend_curr = et[-1]

    if None in (cf, cs, pf, ps, trend_curr):
        return {'action': 'hold'}

    curr_atr = _atr(candles, atr_p)
    if curr_atr <= 0:
        return {'action': 'hold'}

    rsi_val = _rsi(closes, 14)

    # Skip if already in a position
    if [p for p in positions if p.get('instrument') == symbol]:
        return {'action': 'hold'}

    # EMA crossover detection
    bull_cross = (pf <= ps) and (cf > cs)
    bear_cross = (pf >= ps) and (cf < cs)

    # Trend filter: price relative to trend EMA
    trend_up = close > trend_curr
    trend_down = close < trend_curr

    # ADX filter: only trade when there's some trend strength
    adx_val = _adx(candles, 14)
    trending = adx_val > 18

    # RSI filter: avoid extreme readings (likely to reverse)
    rsi_ok_buy = 40 < rsi_val < 70
    rsi_ok_sell = 30 < rsi_val < 60

    # --- BUY SIGNAL ---
    # Fast EMA crosses above slow EMA, price above trend EMA, some trend strength
    if bull_cross and trend_up and rsi_ok_buy and trending:
        sl = round(close - sl_mult * curr_atr, 5)
        tp = round(close + tp_mult * curr_atr, 5)
        if (tp - close) >= 1.5 * (close - sl) and (close - sl) > 0:
            return {
                'action': 'buy',
                'lots': lots,
                'sl': sl,
                'tp': tp
            }

    # --- SELL SIGNAL ---
    # Fast EMA crosses below slow EMA, price below trend EMA, some trend strength
    if bear_cross and trend_down and rsi_ok_sell and trending:
        sl = round(close + sl_mult * curr_atr, 5)
        tp = round(close - tp_mult * curr_atr, 5)
        if (close - tp) >= 1.5 * (sl - close) and (sl - close) > 0:
            return {
                'action': 'sell',
                'lots': lots,
                'sl': sl,
                'tp': tp
            }

    return {'action': 'hold'}