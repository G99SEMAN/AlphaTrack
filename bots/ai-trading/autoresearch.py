"""
AI-Trading autoresearch Loop.
Claude API modifiziert strategy.py → Backtest → behalten/revertieren → wiederholen.

Verwendung:
  set ANTHROPIC_API_KEY=sk-ant-...
  python autoresearch.py [--max N]
"""
import argparse
import json
import os
import py_compile
import shutil
import sys
import tempfile
import time
from datetime import datetime
from pathlib import Path

import anthropic

BASE_DIR = Path(__file__).parent
STRATEGY_FILE = BASE_DIR / 'strategy.py'
EXPERIMENTS_DIR = BASE_DIR / 'experiments'
CONFIG_FILE = BASE_DIR / 'config.json'
PROGRAM_FILE = BASE_DIR / 'program.md'


def _load_config() -> dict:
    with open(CONFIG_FILE, 'r') as f:
        return json.load(f)


def _load_program() -> str:
    if PROGRAM_FILE.exists():
        return PROGRAM_FILE.read_text(encoding='utf-8')
    return "Optimize the trading strategy for maximum Sharpe Ratio on EURUSDp M5."


def _load_history(n: int = 10) -> list:
    if not EXPERIMENTS_DIR.exists():
        return []
    files = sorted(EXPERIMENTS_DIR.glob('exp_*.json'))[-n:]
    history = []
    for f in files:
        try:
            history.append(json.load(open(f)))
        except Exception:
            pass
    return history


def _save_experiment(num: int, data: dict):
    EXPERIMENTS_DIR.mkdir(exist_ok=True)
    path = EXPERIMENTS_DIR / f'exp_{num:04d}.json'
    with open(path, 'w') as f:
        json.dump(data, f, indent=2, default=str)


def _best_sharpe() -> float:
    history = _load_history(200)
    kept = [e.get('sharpe', -999.0) for e in history if e.get('kept')]
    return max(kept, default=-999.0)


def _clean_code(text: str) -> str:
    """Extrahiert Python-Code — entfernt Markdown-Fences und vorangestellten Prosa-Text."""
    import re
    text = text.encode('utf-8').decode('utf-8-sig').strip()

    # Markdown-Block per Regex extrahieren (robuster als split)
    match = re.search(r'```(?:python)?\n?(.*?)```', text, re.DOTALL)
    if match:
        return match.group(1).strip()

    # Kein Fence: ersten Python-Anfang suchen und alles davor wegwerfen
    py_starts = ('"""', "'''", 'def ', 'import ', 'from ', '# ', 'class ')
    for i, line in enumerate(text.splitlines()):
        if any(line.strip().startswith(p) for p in py_starts):
            return '\n'.join(text.splitlines()[i:]).strip()

    return text


def _is_valid_python(code: str) -> tuple:
    """Prüft Python-Syntax vor dem Schreiben. Gibt (True, '') oder (False, Fehler) zurück."""
    try:
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False,
                                         encoding='utf-8') as f:
            f.write(code)
            fname = f.name
        py_compile.compile(fname, doraise=True)
        return True, ""
    except py_compile.PyCompileError as e:
        return False, str(e)
    finally:
        try:
            os.unlink(fname)
        except Exception:
            pass


def _ask_claude(strategy_code: str, history: list, current_best: float, program: str) -> str:
    history_lines = ""
    if history:
        history_lines = "\nRecent experiments:\n"
        for e in history[-10:]:
            status = "KEPT" if e.get('kept') else "reverted"
            history_lines += (
                f"  #{e.get('n', '?')}: Sharpe={e.get('sharpe', 0):.3f}"
                f" trades={e.get('n_trades', 0)} {status}"
                f" — {e.get('change_desc', '')}\n"
            )

    prompt = f"""{program}

Current strategy.py (best Sharpe so far: {current_best:.3f}):
```python
{strategy_code}
```
{history_lines}
Make ONE focused change to improve the Sharpe Ratio. Think about: entry filters, exit logic, parameter tuning, or signal quality. Return ONLY the complete new strategy.py content — valid Python, no markdown fences, no explanation outside code. Required interface: on_tick(candles, positions, config) → dict with keys: action (buy/sell/close/hold), lots, sl, tp."""

    client = anthropic.Anthropic()
    msg = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2500,
        system=(
            "You are a Python trading strategy code generator. "
            "Output ONLY valid Python code. "
            "Never include any explanation, markdown fences, or text before or after the code. "
            "Your response must start directly with a Python docstring or import statement."
        ),
        messages=[{"role": "user", "content": prompt}],
    )
    return _clean_code(msg.content[0].text)


def _reload_and_backtest(config: dict) -> dict:
    sys.modules.pop('strategy', None)
    sys.modules.pop('backtest', None)
    try:
        from backtest import run_backtest
        return run_backtest(config)
    except Exception as e:
        return {'sharpe': -999.0, 'n_trades': 0, 'error': str(e)}


def _update_strategy_description():
    """Ruft analyze_strategy.py auf um die Strategie-Beschreibung in AlphaTrack zu aktualisieren."""
    import subprocess
    script = BASE_DIR / 'analyze_strategy.py'
    if not script.exists():
        return
    try:
        result = subprocess.run(
            [sys.executable, str(script)],
            capture_output=True, text=True, timeout=60
        )
        if result.returncode == 0:
            print(f"  [Strategien] Beschreibung aktualisiert")
        else:
            print(f"  [Strategien] Fehler: {result.stderr.strip()[:80]}")
    except Exception as e:
        print(f"  [Strategien] Fehler: {e}")


def _run_validation(config: dict) -> dict:
    sys.modules.pop('strategy', None)
    sys.modules.pop('backtest', None)
    try:
        from backtest import run_validation
        return run_validation(config)
    except Exception as e:
        return {'sharpe': None, 'error': str(e)}


def _extract_change_desc(code: str) -> str:
    for line in code.splitlines():
        stripped = line.strip()
        if stripped.startswith('#') and len(stripped) > 2:
            return stripped.lstrip('# ').strip()[:120]
    return 'modification'


def main():
    parser = argparse.ArgumentParser(description='AI-Trading autoresearch loop')
    parser.add_argument('--max', type=int, default=0, help='Max. Experimente (0 = unbegrenzt)')
    args = parser.parse_args()

    if not os.environ.get('ANTHROPIC_API_KEY'):
        print('[FEHLER] ANTHROPIC_API_KEY nicht gesetzt.')
        print('  Setze ihn mit: set ANTHROPIC_API_KEY=sk-ant-...')
        sys.exit(1)

    EXPERIMENTS_DIR.mkdir(exist_ok=True)
    config = _load_config()
    program = _load_program()
    max_exp = args.max

    print(f"[autoresearch] AI-Trading Loop gestartet")
    print(f"[autoresearch] Symbol: {config['strategy']['symbol']} {config['strategy']['timeframe']}")
    print(f"[autoresearch] Max. Experimente: {max_exp if max_exp > 0 else '∞'}")

    # Basis-Backtest
    print("\n[INIT] Basis-Backtest der aktuellen Strategie...")
    base = _reload_and_backtest(config)
    best_sharpe = base.get('sharpe', -999.0)
    print(f"[INIT] Basis-Sharpe: {best_sharpe:.3f} | Trades: {base.get('n_trades', 0)}")

    exp_num = len(list(EXPERIMENTS_DIR.glob('exp_*.json')))

    while max_exp == 0 or exp_num < max_exp:
        exp_num += 1
        ts = datetime.now().strftime('%H:%M:%S')
        print(f"\n{'─'*50}")
        print(f"[{ts}] Experiment #{exp_num} | Beste Sharpe: {best_sharpe:.3f}")

        current_code = STRATEGY_FILE.read_text(encoding='utf-8')
        history = _load_history(10)
        backup = STRATEGY_FILE.with_suffix('.py.bak')
        shutil.copy(STRATEGY_FILE, backup)

        # Claude fragen
        print(f"[{exp_num}] Frage Claude nach Verbesserung...")
        try:
            new_code = _ask_claude(current_code, history, best_sharpe, program)
        except Exception as e:
            print(f"[{exp_num}] Claude API Fehler: {e}")
            time.sleep(30)
            continue

        # Syntax-Check vor dem Schreiben
        valid, syntax_err = _is_valid_python(new_code)
        if not valid:
            print(f"[{exp_num}] Syntax-Fehler (nicht geschrieben): {syntax_err[:80]}")
            _save_experiment(exp_num, {
                'n': exp_num, 'timestamp': datetime.now().isoformat(),
                'sharpe': -999.0, 'n_trades': 0, 'win_rate': 0,
                'kept': False, 'best_sharpe': best_sharpe,
                'change_desc': 'syntax error', 'error': syntax_err[:120],
            })
            time.sleep(3)
            continue

        # Neue Strategie schreiben
        STRATEGY_FILE.write_text(new_code, encoding='utf-8')
        change_desc = _extract_change_desc(new_code)

        # Backtest
        print(f"[{exp_num}] Backtest läuft...")
        result = _reload_and_backtest(config)
        new_sharpe = result.get('sharpe', -999.0)
        n_trades = result.get('n_trades', 0)
        error = result.get('error')

        if error:
            print(f"[{exp_num}] Fehler: {error} → Reverted")
            shutil.copy(backup, STRATEGY_FILE)
            kept = False
        elif new_sharpe > best_sharpe and n_trades >= 20:
            best_sharpe = new_sharpe
            kept = True
            print(f"[{exp_num}] VERBESSERT → Train Sharpe={new_sharpe:.3f} | Trades={n_trades}")
            # Out-of-sample Validation (nur Info, nicht für keep/revert Entscheidung)
            val = _run_validation(config)
            val_sharpe = val.get('sharpe')
            if val_sharpe is not None:
                verdict = "✓ generalisiert" if val_sharpe > 0.5 else "⚠ Overfitting?"
                print(f"[{exp_num}] VAL   Sharpe={val_sharpe:.3f} | Trades={val.get('n_trades', 0)} → {verdict}")
            else:
                print(f"[{exp_num}] VAL   (keine Validierungsdaten — siehe data/fetch_history.py)")
            # Strategie-Beschreibung in AlphaTrack aktualisieren
            _update_strategy_description()
        else:
            shutil.copy(backup, STRATEGY_FILE)
            kept = False
            print(f"[{exp_num}] Kein Fortschritt (Sharpe={new_sharpe:.3f}) → Reverted")

        _save_experiment(exp_num, {
            'n': exp_num,
            'timestamp': datetime.now().isoformat(),
            'sharpe': new_sharpe,
            'n_trades': n_trades,
            'win_rate': result.get('win_rate', 0),
            'kept': kept,
            'best_sharpe': best_sharpe,
            'change_desc': change_desc,
            'error': error,
        })

        time.sleep(3)

    print(f"\n[autoresearch] {exp_num} Experimente abgeschlossen. Beste Sharpe: {best_sharpe:.3f}")


if __name__ == '__main__':
    main()
