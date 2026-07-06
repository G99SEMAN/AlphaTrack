# Vol-Scalp GBP/JPY — Strategie-Dokumentation

## Funktionsweise

TTM-Squeeze-Breakout-Scalping auf GBPJPYp M1. Die Strategie erkennt Ruhephasen
(Bollinger Bands vollständig innerhalb des Keltner Channel = "Squeeze") und
eröffnet Trades, sobald der Kurs aus dieser Ruhephase ausbricht ("Fire" =
Volatilitätsausbruch). Solange der Squeeze aktiv ist, werden keine neuen
Einstiege eröffnet. Bereits offene Positionen laufen unabhängig davon bis
SL oder TP weiter, auch wenn der Squeeze zwischenzeitlich zurückkehrt.

**Einstieg:**
- BUY: Kein Squeeze aktiv (Bollinger Band bricht aus dem Keltner Channel aus)
  UND aktueller Kurs > oberes Keltner-Band
- SELL: Kein Squeeze aktiv UND aktueller Kurs < unteres Keltner-Band
- **Edge-getriggert**: Nur EIN Einstiegsversuch pro Squeeze→Fire-Übergang. Sobald
  einmal gehandelt (oder der Versuch an einem Filter scheitert), sperrt der Bot
  weitere Einstiege in derselben Ausbruchsphase — erst wenn der Markt zurück in
  den Squeeze fällt und danach erneut ausbricht, ist ein neuer Einstieg möglich.
  Verhindert Dutzende Einstiege pro Trendphase bei `tick_interval_sec: 1`.

**Kein Einstieg wenn:**
- Squeeze aktiv (Bollinger Band liegt vollständig innerhalb Keltner Channel)
- Tagesverlustlimit erreicht (siehe Schutzmechanismen)
- Cooldown nach Verlustserie aktiv
- Max. Positionen bereits offen
- High-Impact-News (GBP/JPY) innerhalb des Blackout-Fensters
- Aktueller Spread deutlich über dem gleitenden Durchschnitt
- TP zu klein relativ zum aktuellen Spread

**Ausstieg:**
- SL = ATR(14) × `sl_atr_multiplier`
- TP = SL-Distanz × `rr_ratio`
- SL/TP werden als `sl_pips`/`tp_pips` (Abstand, nicht Fixpreis) an die Bridge
  gesendet — dort am tatsächlichen Ausführungspreis verankert (verhindert
  Trades ohne TP bei Preissprüngen zwischen Signal und Order-Ausführung)

## Schutzmechanismen (Risiko-Layer)

Diese vier Mechanismen wurden auf Basis einer Risiko-Validierung ergänzt, weil
Scalping-Strategien in volatilen Phasen strukturell durch Spread-Ausweitung und
Slippage gefährdet sind:

1. **Spread-Filter**: Aktueller Spread (über neue Bridge-Route `/tick`) wird
   gegen den gleitenden Durchschnitt der letzten 30 Messungen geprüft. Bei
   Überschreitung von `spread_filter_multiplier` wird kein Trade eröffnet.
2. **Mindest-TP-Sicherheitsfaktor**: Das TP-Ziel muss mindestens
   `min_tp_spread_factor` × aktueller Spread betragen, sonst ist der Trade
   bereits rechnerisch unrentabel und wird übersprungen.
3. **Tagesverlustlimit**: Sinkt die Kontobilanz an einem Kalendertag um mehr
   als `daily_loss_limit_percent`, werden keine neuen Trades mehr eröffnet
   (Reset um Mitternacht UTC).
4. **Cooldown nach Verlustserie**: Nach `consecutive_loss_cooldown_count`
   aufeinanderfolgenden Verlust-Trades pausiert der Bot für
   `consecutive_loss_cooldown_minutes`.
5. **News-Blackout**: High-Impact-Events für GBP/JPY (Wirtschaftskalender via
   Bridge `/calendar`) sperren den Handel ±`news_blackout_minutes`.

Alle Schutzmechanismen benötigen Live-Bridge-Daten und sind im Backtest
automatisch inaktiv (kein `self._bridge` vorhanden) — die Kernstrategie
(Squeeze/Breakout) bleibt dadurch backtestbar.

## Parameter

| Parameter | Standard | Beschreibung |
|-----------|----------|-------------|
| `bb_period` | 20 | Periode für Bollinger Bands (SMA + StdDev) |
| `bb_std` | 2.0 | Standardabweichungs-Multiplikator der Bollinger Bands |
| `kc_multiplier` | 1.5 | ATR-Multiplikator für Keltner Channel |
| `atr_period` | 14 | ATR-Periode (Keltner Channel + SL-Berechnung) |
| `sl_atr_multiplier` | 1.0 | SL-Distanz = ATR × dieser Wert |
| `rr_ratio` | 1.2 | TP-Distanz = SL-Distanz × dieser Wert |
| `risk_percent` | 0.5 | Kontorisiko pro Trade in % der Balance |
| `pip_value_per_lot` | 7.0 | Pip-Wert pro Lot (für Lotgrößen-Berechnung) |
| `spread_filter_multiplier` | 1.5 | Max. erlaubter Spread relativ zum gleitenden Durchschnitt |
| `min_tp_spread_factor` | 2.5 | TP muss mind. das X-fache des aktuellen Spreads betragen |
| `daily_loss_limit_percent` | 3.0 | Max. täglicher Bilanzverlust in % bevor Handel pausiert |
| `consecutive_loss_cooldown_count` | 3 | Anzahl Verluste in Folge bis Cooldown greift |
| `consecutive_loss_cooldown_minutes` | 60 | Cooldown-Dauer nach Verlustserie |
| `news_blackout_enabled` | 1 | News-Blackout-Filter aktiv (1) oder deaktiviert (0) |
| `news_blackout_minutes` | 15 | Blackout-Fenster vor/nach High-Impact-News |
| `max_positions` | 3 | Max. gleichzeitig offene Positionen (nicht live editierbar) |
| `candles_count` | 150 | Anzahl geladener M1-Kerzen pro Tick |
| `tick_interval_sec` | 1 | Tick-Intervall — technisches Minimum, da "hochfrequent" gewünscht |

## Wichtige Hinweise

- **Kein echtes Tick-Scalping**: Die Architektur pollt Kerzen/Preise alle 1s
  über HTTP (keine Sub-Sekunden-Ausführung möglich). "Hochfrequent" bedeutet
  hier realistisch mehrere Trades pro Volatilitätsfenster, nicht Millisekunden-HFT.
- **Candle-Reihenfolge**: Bridge liefert live neueste Kerze zuerst, der
  Backtest-Runner älteste zuerst. `_to_chronological()` normalisiert beides
  auf älteste-zuerst, bevor die Indikatoren berechnet werden.
- **Neue Bridge-Route `/tick`**: Wurde für den Spread-Filter ergänzt
  (`bridge/gateway.py` + `bridge/mt5_connector.py`) — additiv, keine
  Änderung an bestehenden Routen. Erfordert Bridge-Neustart auf dem Mini-PC.
- **GBPJPY-Spreads** sind bei Brokern tendenziell breiter als bei EURUSD —
  der Spread-Filter und Mindest-TP-Faktor sind deshalb hier besonders wichtig.
- Zeit-Checks nutzen konsequent `self._now()` (Backtest-Pflicht).
