# AI-Trading autoresearch — Agent Instructions

## Goal
Maximize the **Sharpe Ratio** of a trading strategy for **EURUSDp M5** (5-minute candles, Euro/USD).
Target: ~5–10 trades per day, Sharpe > 1.0.

## Interface (must not change)
```python
on_tick(candles: list, positions: list, config: dict) -> dict
```
- `candles`: list of dicts `{datetime, open, high, low, close}`, newest last
- `positions`: list of open positions `{instrument, type, entry, sl, tp, ...}`
- `config`: dict from config.json, strategy params under `config['strategy']`
- Return: `{action: buy|sell|close|hold, lots: float, sl: float, tp: float}`

## Allowed config.strategy keys (can change values in code, not in config.json)
- `ema_fast`, `ema_slow`, `ema_trend`, `atr_period`, `sl_atr_mult`, `tp_atr_mult`, `lots`, `candles_count`

## Improvement ideas to explore
- Add momentum or RSI filter before entry
- Tune SL/TP multipliers for better risk-reward
- Add time-of-day filter (avoid low-liquidity hours)
- Use multiple confirmation signals
- Add trailing stop logic using current candle
- Improve trend filter (e.g., ADX instead of single EMA)
- Experiment with different crossover periods

## Constraints
- No external libraries beyond `math`, `statistics` (built-in only)
- Keep file under 200 lines
- One trade at a time (already enforced by position check)
- SL must always be set (never 0)
- TP/SL ratio should be >= 1.5 for positive expectancy
- **MINIMUM 20 trades required** — strategies with fewer trades are rejected as invalid (< 20 = -999 Sharpe). A strategy that barely trades is useless.
- Target trade frequency: 20–80 trades per backtest period (~17 trading days). This means roughly 1–5 trades per day.
