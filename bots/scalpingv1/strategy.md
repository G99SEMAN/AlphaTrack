# Scalping V1 — Strategie-Dokumentation

## Funktionsweise

EMA-Crossover mit RSI-Filter auf EURUSDp M5 während der London/NY-Session. Der Bot sucht nach einem Kreuzungspunkt des schnellen und langsamen EMA und filtert das Signal mit dem RSI, um die Richtung zu bestätigen. Positionen werden ausschließlich über fixen SL/TP in Pips geschlossen.

**Einstieg:**
- BUY: Schneller EMA kreuzt langsamen EMA von unten nach oben UND RSI > 50
- SELL: Schneller EMA kreuzt langsamen EMA von oben nach unten UND RSI < 50

**Kein Einstieg wenn:**
- Aktuelle UTC-Stunde liegt außerhalb `session_start_utc` bis `session_end_utc` (exklusiv)
- Bereits eine offene Position vorhanden (`positions` nicht leer)
- Zu wenige Kerzen vorhanden (benötigt: `ema_slow + rsi_period + 2`, Standard: 36)

**Ausstieg:**
- Ausschließlich über fixen SL/TP in Pips (MT5 verwaltet die Orders; kein manuelles Schließen durch den Bot)

## Parameter

| Parameter | Standard | Beschreibung |
|-----------|----------|-------------|
| `sl_pips` | 10 | StopLoss in Pips |
| `tp_pips` | 15 | TakeProfit in Pips (empfohlen: 1.5 × SL) |
| `lots` | 0.05 | Lot-Größe |
| `ema_fast` | 5 | Periode des schnellen EMA |
| `ema_slow` | 20 | Periode des langsamen EMA |
| `rsi_period` | 14 | RSI-Periode |
| `session_start_utc` | 7 | Handelsbeginn in UTC-Stunden (inklusiv) |
| `session_end_utc` | 16 | Handelsende in UTC-Stunden (exklusiv) |
| `tick_interval_sec` | 60 | Wie oft `on_tick()` aufgerufen wird (Sekunden) |

## Wichtige Hinweise

- **Zeitzone:** `session_start_utc` und `session_end_utc` sind **UTC-Stunden**. Die AlphaTrack-UI zeigt Zeiten in Lokalzeit (CEST = UTC+2 im Sommer). Ein `session_end_utc=20` entspricht 22:00 Uhr Lokalzeit im Sommer — nicht 20:00 Uhr Lokalzeit.
- **Session-Filter:** `session_start_utc <= UTC-Stunde < session_end_utc` — der Endwert ist exklusiv. Ein Trade um genau 20:00 UTC wird NICHT mehr eröffnet.
- **Max. 1 Position:** Solange eine offene Position existiert, werden keine neuen Signale verarbeitet, unabhängig von EMA/RSI.
- **EMA-Berechnung:** Wilder-Methode (exponentiell, `k = 2 / (period + 1)`). Cross-Erkennung vergleicht die vorletzte mit der letzten Kerze.
- **Symbol:** EURUSDp (Broker-Suffix `p` beachten)
- **Timeframe:** M5 (5-Minuten-Kerzen)
- **Backtest-Kompatibilität:** Session-Filter nutzt `self._now()` — korrekt für den Backtest-Runner.
