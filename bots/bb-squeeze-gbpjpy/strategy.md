# BB Squeeze GBP/JPY — Strategie-Dokumentation

## Funktionsweise

Der Bot handelt den klassischen **Bollinger-Band-Squeeze-Breakout** auf GBPJPYp im 15-Minuten-Timeframe. Das Prinzip basiert auf John Bollingers Beobachtung: Phasen niedriger Volatilität (Squeeze) werden regelmäßig von starken Ausbrüchen gefolgt. Der Bot erkennt diese Kompressionsphase anhand des lokalen BandWidth-Minimums und eröffnet eine Position, sobald eine Kerze außerhalb der Bänder schließt.

Gehandelt wird ausschließlich während der Londoner Eröffnungsphase (**08:00–11:00 Uhr Berliner Zeit**), da GBP/JPY hier die höchste Liquidität und die zuverlässigsten Trendausbrüche zeigt. Die Zeitprüfung ist DST-korrekt (via zoneinfo/pytz).

**Einstieg:**
- BUY: Letzte M15-Kerze schließt **über** dem oberen Bollinger-Band, nachdem in den letzten 12 Kerzen ein BandWidth-Minimum erkannt wurde, und Preis liegt **über** dem EMA200
- SELL: Letzte M15-Kerze schließt **unter** dem unteren Bollinger-Band, nachdem in den letzten 12 Kerzen ein BandWidth-Minimum erkannt wurde, und Preis liegt **unter** dem EMA200

**Kein Einstieg wenn:**
- Außerhalb 08:00–11:00 Uhr Berliner Zeit
- Bereits 1 Position offen
- Tages-Limit erreicht (max. 1 Trade pro Kalendertag in Berliner Zeit)
- Kein Squeeze in den letzten 12 Kerzen erkannt (BandWidth nicht am 25-Kerzen-Minimum)
- Letzte Kerze schließt innerhalb der Bänder
- Preis steht gegen EMA200 (Trendfilter)

**Ausstieg:**
- **SL:** Gegenüberliegendes Band zum Einstiegszeitpunkt — **maximal 2×ATR(14)** (ATR-Cap verhindert übermäßig breite SL bei hoher Volatilität)
- **TP:** 1,5× SL-Distanz vom Einstieg (RR 1:1,5)
- **Break-Even (Soft):** Sobald der Preis um `be_threshold_pips` (Standard: 20 Pips) in Gewinnrichtung läuft, wird BE aktiviert. Bei Rückkehr auf Entry ± 3 Pip Puffer schließt der Bot die Position aktiv.

> **Hinweis Break-Even:** Da die Bridge keine SL-Modifikation am laufenden Trade unterstützt, wird die Position direkt durch den Bot geschlossen (Soft-Close). Der in MT5 gesetzte Hardware-SL bleibt als Sicherheitsnetz für Verbindungsabbrüche und Preislücken aktiv.

## Parameter

| Parameter | Wert | Typ | Beschreibung |
|-----------|------|-----|-------------|
| `bb_period` | 20 | int | Bollinger-Band-Berechnungsperiode |
| `bb_std` | 2.0 | float | Standardabweichungs-Multiplikator der Bänder |
| `squeeze_lookback` | 25 | int | Anzahl Kerzen für BandWidth-Minimum-Vergleich |
| `squeeze_recent_bars` | 12 | int | Wie viele der letzten Kerzen auf Squeeze-Muster geprüft werden |
| `ema_period` | 200 | int | EMA-Periode für Trendfilter (BUY nur über EMA, SELL nur unter EMA) |
| `atr_sl_cap_multiplier` | 2.0 | float | Maximale SL-Distanz als Vielfaches des ATR(14) |
| `rr_ratio` | 1.5 | float | TP-Multiplikator: TP = SL-Distanz × rr_ratio |
| `risk_percent` | 1.0 | float | Risikoanteil pro Trade in % des Kontoguthabens |
| `pip_value_per_lot` | 7.0 | float | USD pro Pip pro Standard-Lot (kalibrieren — siehe Hinweis) |
| `be_threshold_pips` | 20 | float | Pips im Plus, ab denen Break-Even aktiviert wird |
| `trading_start_hour` | 8 | int | Handelsfenster Beginn in Berliner Lokalzeit |
| `trading_end_hour` | 11 | int | Handelsfenster Ende in Berliner Lokalzeit |
| `candles_count` | 300 | int | Anzahl Kerzen pro Tick-Aufruf (Warmup-Fenster) |
| `max_positions` | 1 | int | Maximale gleichzeitig offene Positionen |

## Backtest-Baseline (Jan–Jun 2026)

Optimierte Konfiguration, getestet mit historischen M15-Kerzen über die Bridge aus MetaTrader 5.

| Metrik | Wert |
|--------|------|
| Trades gesamt | 38 |
| Gewinner / Verlierer | 17 / 21 |
| Win-Rate | 44,7 % |
| Gesamt-P&L | **+$5.853** |
| Ø Win | $2.152 |
| Ø Loss | $1.464 |
| Profit-Faktor | **1,19** |
| Max. Drawdown | **$5.067** |

### Optimierungshistorie

| Konfiguration | Win-Rate | P&L | Max DD | PF |
|---|---|---|---|---|
| Original (lookback=50, recent=5) | 32,4 % | -$10.526 | $13.379 | 0,68 |
| + Daily Limit + EMA50 | 36,7 % | -$4.234 | $7.087 | 0,84 |
| + EMA200 | 42,9 % | +$2.520 | $6.107 | 1,09 |
| **+ ATR-Cap 2×ATR(14) ← Baseline** | **44,7 %** | **+$5.853** | **$5.067** | **1,19** |

**Wichtigste Erkenntnisse:**
- `squeeze_lookback=50` umfasste die ruhige Asien-Session (03:00–06:00 Uhr), sodass das BW-Minimum immer in der Nacht lag — zum Handelsbeginn um 08:00 Uhr war das Squeeze-Signal bereits abgelaufen. Durch `lookback=25` (~6h) und `recent_bars=12` (~3h) wird das Squeeze-Fenster sauber auf die Londoner Session fokussiert.
- Der **EMA200-Trendfilter** ist der entscheidende Qualitätsfaktor: Er blockiert Counter-Trend-Trades und hebt die Win-Rate von 32 % auf 43 %.
- Der **ATR-Cap** verhindert übermäßig breite SL bei stark volatilen Kerzen. Einige vorherige SL-Treffer wurden dadurch zu TP-Treffern, da der engere SL mehr Spielraum nach oben ließ.

## Wichtige Hinweise

- **`pip_value_per_lot` kalibrieren:** Für einen USD-Account und USD/JPY ≈ 155–165: ca. 6,1–6,5 USD/Pip/Lot. Formel: `pip_value = 1000 / USDJPY_rate` (Beispiel: USDJPY=158 → ~6.33). Falscher Wert führt zu Over-/Underexposure beim 1%-Risiko.

- **Statistik-Warnung:** 38 Trades (6 Monate) sind für robuste Aussagen zu wenig. Erst ab ~150 Trades sind weitere Optimierungen (z.B. Circuit Breaker) statistisch belastbar.

- **Backtest-Kompatibilität:** Alle Zeitprüfungen nutzen `self._now()` statt `datetime.now()` — voll kompatibel mit dem AlphaTrack Backtest-Runner.

- **Tick-Intervall 30s:** Der Bot prüft alle 30 Sekunden auf neue Signale und Break-Even-Bedingungen.

- **Broker-Suffix:** Symbol muss dem Broker-Suffix entsprechen (z.B. `GBPJPYp`). In `config.json → strategy.symbol` anpassen falls abweichend.
