"""
Exportiert historische NDAQ.OQ M1 Daten fuer den FVG-Scalper Backtest.
Zieht Daten ueber die Bridge HTTP API (Bridge muss laufen).
Splittet in Train/Val am konfigurierten Cutoff-Datum.

Verwendung:
  cd bots/scalping
  python data/fetch_history.py [--count N] [--cutoff YYYY-MM-DD]
"""
import argparse
import csv
import json
import os
import sys
from datetime import datetime

DATA_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(DATA_DIR, '..', 'config.json')

sys.path.insert(0, os.path.join(DATA_DIR, '..'))


def _load_config() -> dict:
    with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def _fetch(bridge_url: str, api_key: str, symbol: str, interval: str, count: int) -> list:
    import requests
    try:
        r = requests.get(
            f"{bridge_url.rstrip('/')}/candles",
            params={"symbol": symbol, "interval": interval, "count": count},
            headers={"X-Bot-Api-Key": api_key},
            timeout=60,
        )
        if not r.ok:
            print(f"[FEHLER] Bridge antwortete {r.status_code}")
            return []
        candles = r.json().get("candles", [])
        return candles
    except Exception as e:
        print(f"[FEHLER] Bridge nicht erreichbar: {e}")
        return []


def _save_csv(candles: list, path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['datetime', 'open', 'high', 'low', 'close'])
        for c in candles:
            writer.writerow([c['datetime'], c['open'], c['high'], c['low'], c['close']])


def main():
    parser = argparse.ArgumentParser(description='NDAQ.OQ History Export')
    parser.add_argument('--count', type=int, default=8000,
                        help='Anzahl M1-Kerzen (default: 8000 ≈ 2 Wochen)')
    parser.add_argument('--cutoff', type=str, default=None,
                        help='Train/Val Cutoff-Datum YYYY-MM-DD (default: letzte 20%%)')
    args = parser.parse_args()

    config = _load_config()
    symbol = config.get('strategy', {}).get('symbol', 'NDAQ.OQ')
    bridge_url = config.get('bridge_url', 'http://localhost:8765')
    api_key = config.get('api_key', '')

    print(f"[FETCH] Lade {args.count} M1-Kerzen fuer {symbol} von Bridge...")
    candles = _fetch(bridge_url, api_key, symbol, 'M1', args.count)

    if not candles:
        print("[FEHLER] Keine Daten erhalten — Bridge laufend?")
        sys.exit(1)

    # Bridge liefert neueste Kerze zuerst → aufsteigend sortieren (älteste zuerst)
    candles.sort(key=lambda c: c['datetime'])

    print(f"[OK] {len(candles)} Kerzen: {candles[0]['datetime']} bis {candles[-1]['datetime']}")
    print(f"[INFO] Bridge-Limit: {len(candles)} Kerzen (max verfügbar)")

    # Train/Val Split: erste 80% = Train (ältere Daten), letzte 20% = Val (neuere Daten)
    if args.cutoff:
        train = [c for c in candles if c['datetime'][:10] < args.cutoff]
        val   = [c for c in candles if c['datetime'][:10] >= args.cutoff]
        print(f"[SPLIT] Cutoff: {args.cutoff} (manuell)")
    else:
        cutoff_idx = int(len(candles) * 0.80)
        train = candles[:cutoff_idx]
        val   = candles[cutoff_idx:]
        print(f"[SPLIT] 80/20 Split bei Index {cutoff_idx} ({train[-1]['datetime'][:10] if train else '?'})")

    print(f"[SPLIT] Train: {len(train)} Kerzen | Val: {len(val)} Kerzen")

    if len(train) < 1200:
        print("[WARN] Zu wenig Train-Daten (min. 1200 für H1-Bias-Erkennung). Bridge limitiert auf 5000 Kerzen.")

    train_path = os.path.join(DATA_DIR, 'ndaq_m1_train.csv')
    val_path   = os.path.join(DATA_DIR, 'ndaq_m1_val.csv')

    _save_csv(train, train_path)
    print(f"[OK] Train → {train_path}")

    if val:
        _save_csv(val, val_path)
        print(f"[OK] Val   → {val_path}")

    print("\n[FERTIG] config.json bereits konfiguriert (train_csv / val_csv)")


if __name__ == '__main__':
    main()
