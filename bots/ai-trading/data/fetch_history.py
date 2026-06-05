"""
Exportiert historische EURUSDp M5 Daten aus dem laufenden MT5 Terminal.
Splittet verfügbare History in Train/Val:
  train_2025.csv  — ältere Daten (für autoresearch Optimierung)
  val_2026.csv    — neuere Daten  (Out-of-Sample Validierung)

Verwendung:
  python data/fetch_history.py
"""
import csv
import os
from datetime import datetime, UTC

import MetaTrader5 as mt5

DATA_DIR = os.path.dirname(__file__)
SYMBOL = "EURUSDp"
VAL_CUTOFF = datetime(2026, 3, 1)  # Alles vor diesem Datum = Train, danach = Val


def ts_to_dt(ts: int) -> datetime:
    return datetime.fromtimestamp(ts, UTC).replace(tzinfo=None)


def save_csv(candles: list, filename: str):
    path = os.path.join(DATA_DIR, filename)
    with open(path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['datetime', 'open', 'high', 'low', 'close', 'volume'])
        for r in candles:
            dt = ts_to_dt(r['time']).strftime('%Y-%m-%d %H:%M:%S')
            writer.writerow([dt, r['open'], r['high'], r['low'], r['close'], r['tick_volume']])
    return path


def main():
    print("[MT5] Verbinde...")
    if not mt5.initialize():
        print(f"[FEHLER] {mt5.last_error()}")
        return

    print(f"[MT5] Build {mt5.terminal_info().build}")
    mt5.symbol_select(SYMBOL, True)

    # Alle verfügbaren M5-Bars laden
    print(f"\n[FETCH] Lade alle verfügbaren M5-Bars für {SYMBOL}...")
    rates = mt5.copy_rates_from_pos(SYMBOL, mt5.TIMEFRAME_M5, 0, 99999)
    mt5.shutdown()

    if rates is None or len(rates) == 0:
        print(f"[FEHLER] Keine Daten: {mt5.last_error()}")
        return

    first = ts_to_dt(rates[0]['time'])
    last  = ts_to_dt(rates[-1]['time'])
    print(f"[OK] {len(rates)} Bars: {first.date()} bis {last.date()}")

    # Train/Val Split am Cutoff-Datum
    train = [r for r in rates if ts_to_dt(r['time']) < VAL_CUTOFF]
    val   = [r for r in rates if ts_to_dt(r['time']) >= VAL_CUTOFF]

    print(f"\n[SPLIT] Train: {len(train)} Bars (bis {VAL_CUTOFF.date()})")
    print(f"[SPLIT] Val:   {len(val)} Bars (ab {VAL_CUTOFF.date()})")

    if len(train) < 1000:
        print("[WARN] Zu wenig Train-Daten — Cutoff-Datum anpassen?")

    # Speichern
    if train:
        path = save_csv(train, "train_2025.csv")
        print(f"[OK] Train → {path}")

    if val:
        path = save_csv(val, "val_2026.csv")
        print(f"[OK] Val   → {path}")

    print("\n[FERTIG] config.json anpassen:")
    print('  "train_csv": "train_2025.csv"')
    print('  "val_csv":   "val_2026.csv"')


if __name__ == '__main__':
    main()
