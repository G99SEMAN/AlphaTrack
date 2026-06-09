# Requirements: AlphaTrack — TODO Abarbeitung

**Defined:** 2026-06-09
**Core Value:** Jeder Trade muss eindeutig einer Quelle zugeordnet sein — ohne korrekte Trade-Attribution sind alle Statistiken, P&L-Anzeigen und Bot-Performance-Daten wertlos.

## v1 Requirements

### Datenkorrektheit

- [ ] **TRADES-01**: Trades die bereits geschlossen wurden werden korrekt als geschlossen markiert
- [ ] **TRADES-02**: Jeder Trade trägt eine eindeutige Quell-ID (Bot-ID oder `bridge/tradeexecuter`)
- [ ] **TRADES-03**: MetaTrader-Kommentar bei Trade-Executor-Trades enthält `/bridge/tradeexecuter`
- [ ] **NET-01**: Tradeanzahl in Bridge-Netzwerkansicht und Bot-Ansicht sind konsistent (kein 8 vs. 1 Mismatch)
- [ ] **SYNC-01**: Sync-Zähler zeigt korrekte Zahl (nicht fälschlicherweise 8400+)

### Bridge

- [ ] **BRIDGE-01**: Bridge erscheint/verschwindet automatisch ohne manuelles Löschen nötig zu sein
- [ ] **BRIDGE-02**: Trash-Icon zum manuellen Löschen der Bridge ist entfernt
- [ ] **BRIDGE-03**: Bridge-Log zeigt keinen „Alle Bots"-Filter (keine Bot-Einträge in Bridge-Log)
- [ ] **BRIDGE-04**: Bridge Settings Seite ist entfernt

### Bots

- [ ] **BOTS-01**: Bot-Positionsanzahl in Bot-Karte spiegelt tatsächlich offene Trades wider (nicht 0)
- [ ] **BOTS-02**: „Synced"-Feld in Bot-Karte ist entfernt (war leer, kein Mehrwert)
- [ ] **BOTS-03**: Bot-Karte zeigt P&L des jeweiligen Bots statt Balance
- [ ] **BOTS-04**: Bot-Karte zeigt Gesamt-Trade-Anzahl des Bots
- [ ] **BOTS-05**: Bot verschwindet automatisch wenn er sich trennt (kein manuelles Entfernen nötig)
- [ ] **BOTS-06**: Bot-Entfernen-Button in Bot-Settings ist entfernt
- [ ] **BOTS-07**: Namens-Bearbeitung in Bot-Settings ist entfernt
- [ ] **BOTS-08**: Editierbare Bot-Parameter (z.B. Lotgröße) erscheinen in Bot-Settings mit Bestätigen-Button der Änderungen an den Bot sendet

### Seiten-Bereinigung

- [ ] **BOTLOG-01**: Bot-Log-Seite ist entfernt (wird nicht mehr benötigt)

### Performance

- [ ] **PERF-01**: Bot-Performance-Graph zeigt P&L über Zeit korrekt an (setzt korrekte Trade-Attribution voraus)
- [ ] **PERF-02**: Trade-Anzahl pro Bot ist in Performance-Ansicht sichtbar

### UI

- [ ] **UI-01**: Trennlinie zwischen offenen Trades hat gleichen visuellen Stil wie bei vergangenen Trades

## v2 Requirements

*(Keine — alle TODO-Punkte sind v1)*

## Out of Scope

| Feature | Reason |
|---------|--------|
| Bot-Authentifizierung/Login-System | Nicht Teil dieser Abarbeitung |
| Neue Features jenseits der TODO-Liste | Nur bestehende Punkte werden umgesetzt |
| Datenbankmigrierung | Bleibt bei JSON-Datei-basiertem Storage |
| Multi-Benutzer / Auth | Nicht relevant für lokale Installation |

## Traceability

*(Wird vom Roadmapper ausgefüllt)*

| Requirement | Phase | Status |
|-------------|-------|--------|
| TRADES-01 | TBD | Pending |
| TRADES-02 | TBD | Pending |
| TRADES-03 | TBD | Pending |
| NET-01 | TBD | Pending |
| SYNC-01 | TBD | Pending |
| BRIDGE-01 | TBD | Pending |
| BRIDGE-02 | TBD | Pending |
| BRIDGE-03 | TBD | Pending |
| BRIDGE-04 | TBD | Pending |
| BOTS-01 | TBD | Pending |
| BOTS-02 | TBD | Pending |
| BOTS-03 | TBD | Pending |
| BOTS-04 | TBD | Pending |
| BOTS-05 | TBD | Pending |
| BOTS-06 | TBD | Pending |
| BOTS-07 | TBD | Pending |
| BOTS-08 | TBD | Pending |
| BOTLOG-01 | TBD | Pending |
| PERF-01 | TBD | Pending |
| PERF-02 | TBD | Pending |
| UI-01 | TBD | Pending |

**Coverage:**
- v1 requirements: 21 total
- Mapped to phases: 0 (wird vom Roadmapper ausgefüllt)
- Unmapped: 21 ⚠️

---
*Requirements defined: 2026-06-09*
*Last updated: 2026-06-09 nach initialer Definition*
