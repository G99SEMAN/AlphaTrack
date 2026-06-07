# FVG-Scalper autoresearch — Agent Instructions

## Goal
Maximize the **Sharpe Ratio** of an ICT/SMC Fair Value Gap scalping strategy for **NDAQ.OQ (Nasdaq 100)**.
Session: 08:00–17:00 CET. Target: 1–5 setups per day, Sharpe > 1.0.

## Interface (must not change)
```python
class FVGScalper(BaseBot):
    def on_tick(self, candles: list, positions: list) -> dict
```
- `candles`: 100 M1 candles (newest last), `{datetime, open, high, low, close}`
- `positions`: list of open positions for this bot `{instrument, type, entry, sl, tp, ticket, ...}`
- `self._config`: config dict (strategy params under `self._config['strategy']`)
- `self._bridge.get_candles(symbol, interval, count)`: fetch H1/H4/M5/M15 candles
- Return: `{action: buy|sell|close|hold, lots: float, sl: float, tp: float}` or `{action: close, ticket: int}`

## Core ICT Concepts (preserve the multi-TF structure)
1. **H1/H4 FVG** — identify Fair Value Gap (3-candle imbalance), determine bearish/bullish bias
2. **M5/M15 confirmation** — Liquidity Sweep (price manipulates recent swing) + Displacement (strong opposite move)
3. **M1 entry** — same sweep+displacement on 1M timeframe → enter in FVG direction

## Allowed improvements
- Tune FVG detection: minimum gap size, staleness filter (discard very old FVGs)
- Improve bias detection: use more candles, add trend strength filter (e.g., ATR-based)
- Adjust sweep detection: lookback periods, body-to-range ratio threshold
- Add SMT divergence check using two correlated instruments (if bridge supports it)
- Improve entry timing: candle body confirmation, momentum filter
- Tune SL/TP calculation: dynamic ATR-based instead of fixed percentage
- Add session-time weighting (avoid low-liquidity gaps at open/close)
- Add volatility filter (skip if ATR too low or too high)
- Improve CRV filter (min_crv tuning)
- Add max daily loss protection

## Constraints
- No external libraries beyond `math`, `statistics`, `datetime` (built-in only)
- Keep file under 500 lines
- `class FVGScalper(BaseBot)` must remain — name and inheritance cannot change
- SL must always be set and non-zero
- CRV must be >= 1.5 minimum
- **MINIMUM 20 trades required** — fewer trades = -999 Sharpe (rejected as invalid)
- Do NOT remove the `_in_session()` method (it's patched during backtest)
- Do NOT remove `_reset_state()` method (called by position management)
