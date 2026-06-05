"""
analyze_strategy.py — Calls Claude API to analyze strategy.py and writes a structured
Strategy entry to the AlphaTrack strategies JSON file.

Usage:
    ANTHROPIC_API_KEY=<key> python analyze_strategy.py
"""

import json
import os
import sys
import glob
import shutil
import tempfile
from datetime import datetime, timezone


# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BOT_DIR = os.path.dirname(os.path.abspath(__file__))
STRATEGY_FILE = os.path.join(BOT_DIR, "strategy.py")
CONFIG_FILE = os.path.join(BOT_DIR, "config.json")
EXPERIMENTS_DIR = os.path.join(BOT_DIR, "experiments")

ALPHATRACK_DATA_DIR = r"C:\Users\Kevin\Desktop\AlphaTrack\data"
STRATEGIES_FILENAME = "strategies-FiFT3HmJf-.json"
STRATEGIES_FILE = os.path.join(ALPHATRACK_DATA_DIR, STRATEGIES_FILENAME)

BOT_ID = "LtDzeFverW"
STRATEGY_ID = f"ai-trading-{BOT_ID}"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def load_json(path: str, default=None):
    if not os.path.exists(path):
        return default
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def find_best_experiment() -> dict | None:
    """Return the kept experiment with the highest sharpe ratio, or None."""
    pattern = os.path.join(EXPERIMENTS_DIR, "*.json")
    best = None
    best_sharpe = float("-inf")
    for filepath in glob.glob(pattern):
        try:
            data = load_json(filepath)
            if not data:
                continue
            if data.get("kept") is True:
                sharpe = data.get("sharpe", float("-inf"))
                if sharpe > best_sharpe:
                    best_sharpe = sharpe
                    best = data
        except (json.JSONDecodeError, OSError):
            continue
    return best


def build_notes(experiment: dict | None, config: dict) -> str:
    lines = []
    if experiment:
        sharpe = experiment.get("sharpe")
        n_trades = experiment.get("n_trades")
        win_rate = experiment.get("win_rate")
        change = experiment.get("change_desc", "")
        lines.append("Backtest-Statistiken (bestes gespeichertes Experiment):")
        if sharpe is not None:
            lines.append(f"  Sharpe Ratio: {sharpe:.4f}")
        if n_trades is not None:
            lines.append(f"  Anzahl Trades: {n_trades}")
        if win_rate is not None:
            lines.append(f"  Win Rate: {win_rate:.2f}%")
        if change:
            lines.append(f"  Konfiguration: {change}")
    else:
        lines.append("Kein gespeichertes Experiment gefunden.")

    strat = config.get("strategy", {})
    ema_fast = strat.get("ema_fast")
    ema_slow = strat.get("ema_slow")
    ema_trend = strat.get("ema_trend")
    atr_period = strat.get("atr_period")
    sl_mult = strat.get("sl_atr_mult")
    tp_mult = strat.get("tp_atr_mult")
    if any(v is not None for v in [ema_fast, ema_slow, ema_trend]):
        lines.append(
            f"Parameter: EMA {ema_fast}/{ema_slow}/{ema_trend}, "
            f"ATR({atr_period}) SL={sl_mult}x TP={tp_mult}x"
        )

    lines.append("Automatisch optimiert durch autoresearch.py")
    return "\n".join(lines)


def atomic_write_json(path: str, data) -> None:
    """Write JSON to a temp file then rename for atomic replacement."""
    dir_ = os.path.dirname(path)
    fd, tmp_path = tempfile.mkstemp(dir=dir_, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        shutil.move(tmp_path, path)
    except Exception:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise


# ---------------------------------------------------------------------------
# Claude API call
# ---------------------------------------------------------------------------

def call_claude(strategy_code: str, config: dict, experiment: dict | None) -> dict:
    try:
        import anthropic
    except ImportError:
        print("[ERROR] anthropic package not installed. Run: pip install anthropic")
        sys.exit(1)

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("[ERROR] ANTHROPIC_API_KEY environment variable not set.")
        sys.exit(1)

    strat_cfg = config.get("strategy", {})
    symbol = strat_cfg.get("symbol", "EURUSDp")
    timeframe = strat_cfg.get("timeframe", "M5")

    exp_summary = ""
    if experiment:
        exp_summary = (
            f"\nBest kept experiment: sharpe={experiment.get('sharpe', 'N/A'):.4f}, "
            f"n_trades={experiment.get('n_trades', 'N/A')}, "
            f"win_rate={experiment.get('win_rate', 'N/A'):.2f}%, "
            f"config: {experiment.get('change_desc', '')}"
        )

    notes_text = build_notes(experiment, config)

    user_prompt = f"""Analyze the following trading strategy Python code for {symbol} on {timeframe} timeframe.
{exp_summary}

Return ONLY a JSON object with exactly these fields:
{{
  "id": "{STRATEGY_ID}",
  "name": "[AI-Trading] <short strategy name in German>",
  "description": "<1-2 sentences in German describing what this strategy does>",
  "timeframe": "{timeframe}",
  "rules": ["<rule 1 in German>", "<rule 2 in German>", ...],
  "notes": {json.dumps(notes_text)},
  "riskPerTrade": 1,
  "color": "#3b82f6",
  "createdAt": "{datetime.now(timezone.utc).isoformat()}"
}}

rules must have 5-7 items in German describing the entry/exit/filter conditions.
Do not include any markdown, code fences, or explanation — only the raw JSON object.

Strategy code:
```python
{strategy_code}
```
"""

    client = anthropic.Anthropic(api_key=api_key)
    print("[INFO] Calling Claude API (claude-sonnet-4-6) ...")
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1500,
        system="You are a trading strategy analyst. Output only valid JSON, no markdown.",
        messages=[{"role": "user", "content": user_prompt}],
    )

    raw = message.content[0].text.strip()

    # Strip accidental markdown fences if Claude adds them despite instructions
    if raw.startswith("```"):
        lines = raw.splitlines()
        raw = "\n".join(
            line for line in lines if not line.strip().startswith("```")
        ).strip()

    result = json.loads(raw)
    return result


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    # 1. Read strategy.py
    print(f"[INFO] Reading strategy from: {STRATEGY_FILE}")
    if not os.path.exists(STRATEGY_FILE):
        print(f"[ERROR] strategy.py not found at {STRATEGY_FILE}")
        sys.exit(1)
    with open(STRATEGY_FILE, "r", encoding="utf-8") as f:
        strategy_code = f.read()

    # 2. Read config.json
    print(f"[INFO] Reading config from: {CONFIG_FILE}")
    config = load_json(CONFIG_FILE, default={})

    # 3. Find best kept experiment
    print(f"[INFO] Scanning experiments in: {EXPERIMENTS_DIR}")
    experiment = find_best_experiment()
    if experiment:
        print(
            f"[INFO] Best kept experiment: n={experiment.get('n')}, "
            f"sharpe={experiment.get('sharpe', 0):.4f}, "
            f"win_rate={experiment.get('win_rate', 0):.2f}%"
        )
    else:
        print("[WARN] No kept experiments found.")

    # 4. Call Claude
    try:
        strategy_entry = call_claude(strategy_code, config, experiment)
    except json.JSONDecodeError as exc:
        print(f"[ERROR] Claude returned invalid JSON: {exc}")
        sys.exit(1)
    except Exception as exc:
        print(f"[ERROR] Claude API call failed: {exc}")
        sys.exit(1)

    # Ensure required fields are present / correct
    strategy_entry["id"] = STRATEGY_ID
    strategy_entry.setdefault("riskPerTrade", 1)
    strategy_entry.setdefault("color", "#3b82f6")
    strategy_entry.setdefault("createdAt", datetime.now(timezone.utc).isoformat())

    print(f"[INFO] Received strategy entry: {strategy_entry.get('name', '(unnamed)')}")

    # 5. Load existing strategies file
    print(f"[INFO] Loading strategies from: {STRATEGIES_FILE}")
    existing: list = load_json(STRATEGIES_FILE, default=[])
    if not isinstance(existing, list):
        print("[WARN] strategies file is not a JSON array — resetting to []")
        existing = []

    # 6. Remove any existing ai-trading- entry
    before = len(existing)
    existing = [s for s in existing if not str(s.get("id", "")).startswith("ai-trading-")]
    removed = before - len(existing)
    if removed:
        print(f"[INFO] Removed {removed} existing ai-trading- entr{'y' if removed == 1 else 'ies'}.")

    # 7. Append new entry
    existing.append(strategy_entry)
    print(f"[INFO] Total strategies after update: {len(existing)}")

    # 8. Atomic write
    print(f"[INFO] Writing strategies file atomically to: {STRATEGIES_FILE}")
    os.makedirs(ALPHATRACK_DATA_DIR, exist_ok=True)
    atomic_write_json(STRATEGIES_FILE, existing)

    print("[OK] analyze_strategy.py complete.")
    print(f"[OK] Strategy '{strategy_entry.get('name')}' saved with id={STRATEGY_ID}")


if __name__ == "__main__":
    main()
