# FVG GBP/JPY — Strategie-Dokumentation

## Funktionsweise

Handelt **Fair Value Gaps (FVGs)** nach der ICT-Methodik auf GBP/JPY M15. Ein FVG entsteht, wenn eine Impulsmuster-Kerze so stark ausbricht, dass zwischen der ersten und dritten Kerze eines 3-Kerzen-Musters eine Preislücke (Imbalance) verbleibt. Der Bot wartet, bis der Preis in eine solche unberührte Zone zurücktracet, und eröffnet einen Trade in die ursprüngliche Ausbruchsrichtung. Das TP liegt über das FVG-Ende hinaus, um besseres RR zu erzielen.

Optimiert durch Backtesting 2026-05-01 bis 2026-06-27: **98 Trades | 59.2% Win-Rate | +$10.84 | PF 1.21**.

**Einstieg:**
- BUY: Bullisches FVG erkannt (`Candle[i].High < Candle[i+2].Low`), Preis retracet IN die Zone (optional: Preis über EMA)
- SELL: Bärisches FVG erkannt (`Candle[i].Low > Candle[i+2].High`), Preis retracet IN die Zone (optional: Preis unter EMA)

**Kein Einstieg wenn:**
- FVG wurde bereits besucht (mitigiert) — eine frühere Kerze schloss innerhalb der Zone
- FVG älter als `fvg_max_age_bars` Kerzen
- FVG kleiner als `min_fvg_pips` Pips
- Berechnetes RR unter `min_rr`
- Session-Filter aktiv und außerhalb London/NY (Standard: ausgeschaltet)

**Ausstieg:**
- TP: FVG-Ende + Zonenbreite × `tp_extension_mult`
  - Bullish BUY → TP = `Candle[i+2].Low` + Zonenbreite × 1.0
  - Bearish SELL → TP = `Candle[i+2].High` − Zonenbreite × 1.0
- SL: Außerhalb der FVG-Zone + `sl_buffer_pips` Puffer (Standard: 10 Pips)
- Kein automatischer Break-Even oder Trailing Stop

## Parameter

| Parameter | Standard | Typ | Beschreibung |
|-----------|----------|-----|-------------|
| `lots` | 0.01 | float | Feste Lotgröße pro Trade |
| `ema_filter` | 0 | int | 1 = EMA-Trendfilter aktiv, 0 = deaktiviert |
| `ema_period` | 200 | int | EMA-Periode (nur relevant wenn `ema_filter=1`) |
| `fvg_max_age_bars` | 30 | int | Max. Alter einer FVG in M15-Kerzen (~7.5 Stunden) |
| `min_fvg_pips` | 5 | float | Minimale FVG-Zonenbreite in Pips (filtert Micro-Gaps) |
| `sl_buffer_pips` | 10 | float | Sicherheitspuffer außerhalb FVG-Zone für den SL |
| `session_filter` | 0 | int | 1 = nur London+NY Session, 0 = 24/5 aktiv |
| `min_rr` | 0.5 | float | Mindest-RR — FVGs mit schlechterem Verhältnis werden übersprungen |
| `tp_extension_mult` | 1.0 | float | TP-Extension: 1.0 = Zonenbreite über FVG-Ende hinaus |

## Wichtige Hinweise

- **JPY-Pip-Größe**: GBP/JPY = 0.01 (hardcodiert). SL/TP werden mit 3 Dezimalstellen gesetzt.
- **Kein Session-Filter (Standard)**: Backtests zeigen, dass GBP/JPY FVGs über den gesamten Tag gehandelt werden sollten — Session-Filter reduziert P&L signifikant.
- **Kein EMA-Filter (Standard)**: EMA-Filter hat in Tests die Performance verschlechtert. Kann bei Bedarf aktiviert werden (`ema_filter=1`).
- **Backtest-Ergebnis**: Beste Konfiguration aus 57-Tage-Backtest: TP×1.0, SL=10p, MinFVG=5p, Age=30, kein Filter → 98 Trades, Win-Rate 59.2%, PF 1.21, +$10.84 bei 0.01 Lots.
- **pip_value_per_lot**: Muss mit dem tatsächlichen Pip-Wert des Brokers übereinstimmen. Standard 7.0 USD/Lot für GBP/JPY (Näherungswert — variiert mit aktuellem Kurs).
