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

## Core ICT Concepts (preserve the 2-stage structure)
1. **HTF FVG** (`self._bridge.get_candles(symbol, cfg['htf'], cfg['htf_candles'])`) — Fair Value Gap or Near-Gap as direction bias
2. **M1 entry** — Liquidity Sweep of a recent swing + displacement candle in FVG direction

## Configurable parameters (change values in on_tick via cfg, not in config.json)
- `htf`: higher timeframe (default "M5", try "M15" or "H1")
- `htf_candles`: candle count for HTF (default 100)
- `htf_bias_lookback`: candles for bias detection (default 10)
- `sweep_lookback`: lookback for sweep detection (default 6)
- `fvg_tolerance`: price tolerance to enter FVG zone in % (default 0.001)
- `min_crv`: minimum CRV to enter trade (default 1.5)

## Allowed improvements
- Tune FVG detection: adjust the near-gap body ratio threshold (currently 0.40)
- Add staleness filter: ignore FVGs older than N candles
- Improve bias detection: use more candles, add trend strength (e.g. count of consecutive closes)
- Adjust sweep detection: change lookback, add body/wick ratio requirement
- Add second confirmation: require HTF entry signal before M1 entry
- Tune SL/TP: use ATR for dynamic sizing instead of fixed percentage
- Add re-entry logic: trade a second time if FVG is tested again
- Add time filter: skip last/first N candles of session
- Try different HTF values (M5, M15) via cfg lookups

## Constraints
- No external libraries beyond `math`, `statistics`, `datetime` (built-in only)
- Keep file under 500 lines
- `class FVGScalper(BaseBot)` must remain — name and inheritance cannot change
- SL must always be set and non-zero
- CRV must be >= 1.5 minimum
- **MINIMUM 20 trades required** — fewer trades = -999 Sharpe (rejected as invalid)
- Do NOT remove the `_in_session()` method (it's patched during backtest)
- Do NOT remove `_reset_state()` method (called by position management)
