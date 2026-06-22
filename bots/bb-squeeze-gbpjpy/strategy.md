# BB Squeeze GBP/JPY — Strategie-Dokumentation

## Funktionsweise

Der Bot handelt den klassischen **Bollinger-Band-Squeeze-Breakout** auf GBPJPYp im 15-Minuten-Timeframe. Das Prinzip basiert auf John Bollingers Beobachtung: Phasen niedriger Volatilität (Squeeze) werden regelmäßig von starken Ausbrüchen gefolgt. Der Bot erkennt diese Kompressionsphase anhand des lokalen BandWidth-Minimums und eröffnet eine Position, sobald eine Kerze außerhalb der Bänder schließt.

Gehandelt wird ausschließlich während der Londoner Eröffnungsphase (**08:00–11:00 Uhr Berliner Zeit**), da GBP/JPY hier die höchste Liquidität und die zuverlässigsten Trendausbrüche zeigt. Die Zeitprüfung ist DST-korrekt (via zoneinfo/pytz).

**Einstieg:**
- BUY: Letzte M15-Kerze schließt **über** dem oberen Bollinger-Band, nachdem in den letzten 5 Kerzen ein BandWidth-Minimum erkannt wurde
- SELL: Letzte M15-Kerze schließt **unter** dem unteren Bollinger-Band, nachdem in den letzten 5 Kerzen ein BandWidth-Minimum erkannt wurde

**Kein Einstieg wenn:**
- Außerhalb 08:00–11:00 Uhr Berliner Zeit
- Bereits 1 Position offen
- Kein Squeeze in den letzten 5 Kerzen erkannt (BandWidth nicht am 50-Kerzen-Minimum)
- Letzte Kerze schließt innerhalb der Bänder

**Ausstieg:**
- **SL:** Gegenüberliegendes Band zum Einstiegszeitpunkt (dynamisch — weitet sich bei hoher Volatilität automatisch aus)
- **TP:** 1,5× SL-Distanz vom Einstieg (RR 1:1,5)
- **Break-Even (Soft):** Sobald der Preis um `be_threshold_pips` (Standard: 20 Pips) in Gewinnrichtung läuft, wird BE aktiviert. Bei Rückkehr auf Entry ± 3 Pip Puffer schließt der Bot die Position aktiv.

> **Hinweis Break-Even:** Da die Bridge keine SL-Modifikation am laufenden Trade unterstützt, wird die Position direkt durch den Bot geschlossen (Soft-Close). Der in MT5 gesetzte Hardware-SL bleibt als Sicherheitsnetz für Verbindungsabbrüche und Preislücken aktiv.

## Parameter

| Parameter | Standard | Typ | Beschreibung |
|-----------|----------|-----|-------------|
| `bb_period` | 20 | int | Bollinger-Band-Berechnungsperiode |
| `bb_std` | 2.0 | float | Standardabweichungs-Multiplikator der Bänder |
| `squeeze_lookback` | 50 | int | Anzahl Kerzen für BandWidth-Minimum-Vergleich |
| `squeeze_recent_bars` | 5 | int | Wie viele der letzten Kerzen auf Squeeze-Muster geprüft werden |
| `rr_ratio` | 1.5 | float | TP-Multiplikator: TP = SL-Distanz × rr_ratio |
| `risk_percent` | 1.0 | float | Risikoanteil pro Trade in % des Kontoguthabens |
| `pip_value_per_lot` | 7.0 | float | USD pro Pip pro Standard-Lot (kalibrieren — siehe Hinweis) |
| `be_threshold_pips` | 20 | float | Pips im Plus, ab denen Break-Even aktiviert wird |
| `trading_start_hour` | 8 | int | Handelsfenster Beginn in Berliner Lokalzeit |
| `trading_end_hour` | 11 | int | Handelsfenster Ende in Berliner Lokalzeit |

## Wichtige Hinweise

- **`pip_value_per_lot` kalibrieren:** Der Wert hängt vom aktuellen USD/JPY-Kurs und der Kontowährung ab. Für einen USD-Account und USD/JPY ≈ 155–165: ca. 6,1–6,5 USD/Pip/Lot. Für einen EUR-Account entsprechend in EUR umrechnen. Falsche Werte führen zu Over- oder Underexposure beim 1%-Risiko.
  - Formel (USD-Account): `pip_value = 1000 / USDJPY_rate`
  - Beispiel: USDJPY = 158 → `pip_value = 1000 / 158 ≈ 6.33`

- **Backtest-Kompatibilität:** Alle Zeitprüfungen nutzen `self._now()` statt `datetime.now()` — voll kompatibel mit dem AlphaTrack Backtest-Runner.

- **Tick-Intervall 30s:** Der Bot prüft alle 30 Sekunden auf neue Signale und Break-Even-Bedingungen. Für reine Signal-Checks würden 60s reichen, die kürzere Frequenz verbessert die Break-Even-Reaktionszeit.

- **Broker-Suffix:** Symbol muss dem Broker-Suffix entsprechen (z.B. `GBPJPYp` mit Suffix `p`). In `config.json → strategy.symbol` anpassen falls abweichend.
