# London Open V1 — Strategie-Dokumentation

## Funktionsweise

Asia-Range Breakout auf GBPUSDp M15 zur London Open. Der Bot ermittelt das Hoch und Tief der Asia-Session und tradet den Ausbruch daraus im frühen Londoner Handelsfenster. Pro Tag wird maximal ein Trade eröffnet.

**Phase 1 – Asia-Range ermitteln:**
Alle M15-Kerzen des heutigen Tages innerhalb von `asia_start_utc` bis `asia_end_utc` (Standard: 00:00–07:00 UTC) werden ausgewertet. Das höchste Hoch und tiefste Tief dieser Kerzen bilden die Asia-Range.

**Einstieg (07:00–09:00 UTC, einstellbar):**
- BUY: Schlusskurs der aktuellen Kerze > Asia-High
- SELL: Schlusskurs der aktuellen Kerze < Asia-Low

**Kein Einstieg wenn:**
- Aktuelle UTC-Stunde außerhalb `entry_start_utc` bis `entry_end_utc` (exklusiv)
- Bereits heute ein Trade eröffnet wurde (`_last_trade_date == heute`)
- Bereits eine offene Position vorhanden
- Keine Asia-Kerzen gefunden (Range kann nicht berechnet werden)

**Ausstieg:**
- Über absoluten SL und TP (Preisangabe an MT5). Kein manuelles Schließen durch den Bot.
- SL-BUY: `asia_high - sl_buffer_pips × pip`
- SL-SELL: `asia_low + sl_buffer_pips × pip`
- TP: `SL-Distanz × rr_ratio` in Richtung des Trades

## Parameter

| Parameter | Standard | Beschreibung |
|-----------|----------|-------------|
| `lots` | 0.03 | Lot-Größe |
| `sl_buffer_pips` | 5 | Puffer in Pips innerhalb der Asia-Range für den SL |
| `rr_ratio` | 1.5 | Reward/Risk-Ratio (TP = SL-Distanz × rr_ratio) |
| `asia_start_utc` | 0 | Beginn der Asia-Session (UTC-Stunde, inklusiv) |
| `asia_end_utc` | 7 | Ende der Asia-Session (UTC-Stunde, exklusiv) |
| `entry_start_utc` | 7 | Beginn des Einstiegsfensters (UTC-Stunde, inklusiv) |
| `entry_end_utc` | 9 | Ende des Einstiegsfensters (UTC-Stunde, exklusiv) |
| `tick_interval_sec` | 60 | Tick-Intervall in Sekunden |

## Wichtige Hinweise

- **Kerzen-Zeitzone:** Die Bridge liefert `candle["datetime"]` in **Europe/Berlin-Zeit (CET/CEST)**. Der Bot konvertiert intern via `_parse_berlin_to_utc()` nach UTC für die Session-Berechnung. OHLC-Werte kommen als Strings und werden mit `float()` konvertiert.
- **Kerzen-Reihenfolge:** Die Bridge liefert Kerzen neueste zuerst (Index 0 = aktuellste). Der Bot kehrt die Liste für die Asia-Range-Auswertung um (`reversed(candles)`).
- **Max. 1 Trade/Tag:** `_last_trade_date` wird im Speicher gehalten — nach einem Neustart kann der Bot theoretisch erneut handeln. Bewusste Design-Entscheidung.
- **Pip-Größe:** 0.0001 (GBPUSD Standard). Bei einem Broker-Suffix (`p`) bleibt die Pip-Größe gleich.
- **Symbol:** GBPUSDp, **Timeframe:** M15, **Mindest-Kerzen:** 60 (≈15h, deckt Asia-Range + Einstiegsfenster ab)
- **ACHTUNG — Backtest-Inkompatibilität:** Der Session-Filter in `on_tick()` verwendet `datetime.now(timezone.utc)` statt `self._now()`. Im Backtest-Runner wird dadurch immer die Echtzeit geprüft, nicht die Kerzenzeit — Session-Filter bricht im Backtest. Sollte auf `self._now()` umgestellt werden.
