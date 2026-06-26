# FVG GBP/USD — Strategie-Dokumentation

## Funktionsweise

Handelt **Fair Value Gaps (FVGs)** nach der ICT-Methodik auf GBP/USD M15. Ein FVG entsteht, wenn eine Impulsmuster-Kerze so stark ausbricht, dass zwischen der ersten und dritten Kerze eines 3-Kerzen-Musters eine Preislücke (Imbalance) verbleibt. Der Bot wartet, bis der Preis in eine solche unberührte Zone zurücktracet, und eröffnet dann einen Trade in die ursprüngliche Ausbruchsrichtung. Der EMA(200) filtert Trades gegen den übergeordneten Trend.

**Einstieg:**
- BUY: Bullisches FVG erkannt (`Candle[i].High < Candle[i+2].Low`), aktueller Preis retracet IN die Zone, Preis liegt über EMA(200)
- SELL: Bärisches FVG erkannt (`Candle[i].Low > Candle[i+2].High`), aktueller Preis retracet IN die Zone, Preis liegt unter EMA(200)

**Kein Einstieg wenn:**
- Außerhalb der Handelssessions (London 07–10 UTC, NY 12–15 UTC) — sofern `session_filter=1`
- FVG wurde bereits besucht (mitigiert) — eine frühere Kerze schloss innerhalb der Zone
- FVG ist älter als `fvg_max_age_bars` Kerzen
- FVG kleiner als 3 Pips (Micro-Gap)
- EMA-Trendfilter blockiert die Richtung
- Berechnetes RR-Verhältnis unter `min_rr`

**Ausstieg:**
- TP: Gegenüberliegendes Ende der FVG-Zone (vollständige Gap-Füllung)
  - Bullish BUY → TP = `Candle[i+2].Low` (oberes Ende)
  - Bearish SELL → TP = `Candle[i+2].High` (unteres Ende)
- SL: Außerhalb der FVG-Zone + `sl_buffer_pips` Puffer
- Kein automatischer Break-Even oder Trailing Stop

## Parameter

| Parameter | Standard | Typ | Beschreibung |
|-----------|----------|-----|-------------|
| `lots` | 0.01 | float | Feste Lotgröße pro Trade |
| `ema_period` | 200 | int | EMA-Periode für den Trendfilter |
| `fvg_max_age_bars` | 20 | int | Max. Alter einer FVG in M15-Kerzen (~5 Stunden) |
| `sl_buffer_pips` | 5 | float | Sicherheitspuffer außerhalb FVG-Zone für den SL (in Pips) |
| `session_filter` | 1 | int | 1 = nur London+NY Session aktiv, 0 = immer handeln |
| `min_rr` | 1.0 | float | Mindest-RR — FVGs mit schlechterem Verhältnis werden übersprungen |

## Wichtige Hinweise

- **Pip-Größe**: GBP/USD = 0.0001 (hardcodiert für 5-stellige Broker). Bei anderem Pair oder Broker `PIP_SIZE` in `strategy.py` anpassen.
- **Enges TP**: Das TP liegt am FVG-Rand — typisch 3–15 Pips. Hohe Win-Rate, aber RR oft <1:1 wenn Preis tief in Zone eintritt. `min_rr=1.0` filtert schlechte Setups heraus.
- **EMA Warm-up**: Der EMA(200) braucht mindestens 200 M15-Kerzen (~50h). `candles_count: 300` stellt das sicher.
- **Mitigation**: Eine FVG gilt als mitigiert, sobald eine abgeschlossene Kerze innerhalb der Zone schließt. Sie wird dann nicht mehr gehandelt.
- **Session-Fenster**: London 07:00–10:00 UTC und NY 12:00–15:00 UTC entsprechen den volumenreichsten Phasen und der höchsten FVG-Qualität bei GBP/USD.
