# TestBot 2 — Strategie-Dokumentation

## Funktionsweise

Timer-basierter Test-Bot ohne Preislogik. Öffnet regelmäßig einen BUY-Trade auf EURUSDp und schließt ihn nach einer konfigurierbaren Haltedauer. Dient ausschließlich zum Testen der Bridge-Verbindung, des Trade-Workflows und des Parameter-Editors.

**Einstieg:**
- BUY: Kein Trade offen UND vergangene Zeit seit letztem Trade ≥ `interval_minutes`

**Kein Einstieg wenn:**
- Bereits eine offene Position vorhanden

**Ausstieg:**
- CLOSE: Ticket-Alter ≥ `hold_minutes` (gemessen mit lokaler System-Uhr seit `send_trade()`)
- Kein SL/TP — der Bot schließt die Position manuell per Timer

## Parameter

| Parameter | Standard | Beschreibung |
|-----------|----------|-------------|
| `hold_minutes` | 10 | Wie lange ein Trade offen bleibt (Minuten) |
| `interval_minutes` | 30 | Mindestabstand zwischen zwei Trade-Eröffnungen (Minuten) |

## Wichtige Hinweise

- **Haltedauer-Messung:** Verwendet `self.ticket_age_sec()` (lokale System-Uhr seit `send_trade()`), nicht den MT5-Zeitstempel. MT5-Zeitstempel kommen in Broker-Zeit (UTC+3) und würden Altersberechnungen um Stunden verfälschen.
- **Neustart-Verhalten:** Nach einem Neustart gelten alle geladenen Tickets als „maximal alt" (`added_at=0`) und werden beim nächsten Tick sofort geschlossen.
- **Ausschließlich BUY:** Keine SELL-Logik — für reines Testen des Workflows ausreichend.
- **Kein Preisfilter:** Der Bot handelt immer zum Marktpreis, unabhängig von Trend, Volatilität oder Session.
- **Symbol:** EURUSDp (hart kodiert in `config.json`), Kerzendaten werden nicht ausgewertet.
- **Nicht für Produktion geeignet** — ausschließlich für Infrastruktur-Tests.
