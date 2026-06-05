"""Diagnose: testet verschiedene MT5 copy_rates Methoden."""
from datetime import datetime
import MetaTrader5 as mt5

mt5.initialize()
print(f"MT5 Build: {mt5.terminal_info().build}")

SYMBOL = "EURUSDp"
mt5.symbol_select(SYMBOL, True)

# Test 1: copy_rates_from_pos (neueste N Bars — kein Datum nötig)
print("\n[Test 1] copy_rates_from_pos (letzte 100 M5 Bars)...")
r = mt5.copy_rates_from_pos(SYMBOL, mt5.TIMEFRAME_M5, 0, 100)
print(f"  Ergebnis: {len(r) if r is not None else None} Bars | Fehler: {mt5.last_error()}")
if r is not None and len(r) > 0:
    first = datetime.utcfromtimestamp(r[0]['time'])
    last  = datetime.utcfromtimestamp(r[-1]['time'])
    print(f"  Zeitraum: {first} bis {last}")

# Test 2: copy_rates_from (von einem Datum, N Bars)
print("\n[Test 2] copy_rates_from (ab 2024-01-01, 1000 Bars)...")
r2 = mt5.copy_rates_from(SYMBOL, mt5.TIMEFRAME_M5, datetime(2024, 1, 1), 1000)
print(f"  Ergebnis: {len(r2) if r2 is not None else None} Bars | Fehler: {mt5.last_error()}")

# Test 3: copy_rates_range
print("\n[Test 3] copy_rates_range (2024-01-01 bis 2024-12-31)...")
r3 = mt5.copy_rates_range(SYMBOL, mt5.TIMEFRAME_M5, datetime(2024, 1, 1), datetime(2024, 12, 31))
print(f"  Ergebnis: {len(r3) if r3 is not None else None} Bars | Fehler: {mt5.last_error()}")

# Test 4: Wie viel History ist überhaupt verfügbar?
print("\n[Test 4] Verfügbare History (letzte 50000 Bars ab heute rückwärts)...")
r4 = mt5.copy_rates_from_pos(SYMBOL, mt5.TIMEFRAME_M5, 0, 50000)
if r4 is not None and len(r4) > 0:
    first = datetime.utcfromtimestamp(r4[0]['time'])
    last  = datetime.utcfromtimestamp(r4[-1]['time'])
    print(f"  {len(r4)} Bars verfügbar: {first} bis {last}")
else:
    print(f"  Keine Daten | Fehler: {mt5.last_error()}")

mt5.shutdown()
