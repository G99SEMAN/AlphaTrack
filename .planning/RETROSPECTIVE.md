# Retrospective: AlphaTrack

## Milestone: v1.0 — TODO Abarbeitung

**Shipped:** 2026-06-12
**Phases:** 4 | **Plans:** 12 | **Commits:** ~109

### What Was Built

- **sourceId Trade-Attribution** — Jeder Trade trägt jetzt eine eindeutige Quell-ID (`bridge/tradeexecuter` oder Bot-ID)
- **Close-Event + Heartbeat-Fallback** — MT5-geschlossene Trades werden korrekt als `closed` markiert
- **Bridge Auto-Discovery** — Bridge erscheint/verschwindet automatisch via 30s-Heartbeat-Timeout; Trash-Icon entfernt
- **Bridge-Log + Settings bereinigt** — Bot-Filter aus Bridge-Log entfernt; Bridge-Settings-Seite gelöscht
- **Bot-Karte Metriken** — P&L, Positionen und Trade-Anzahl aus echten Trade-Daten (nicht Heartbeat-Status)
- **Bot-Settings Umbau** — Edit/Delete entfernt, Parameter-Editor mit `set_parameters`-Command
- **Ticket-Registry-Persistenz** — `_ticket_to_at_bot_id` in `ticket_registry.json` gespeichert; überlebt Bridge-Neustart
- **Trade-Row UI-Fix** — borderBottom-Konsistenz zwischen offenen und geschlossenen Trades

### What Worked

- **Goal-backward Phase-Reihenfolge:** Datenkorrektheit zuerst war richtig — ohne sourceId hätten alle nachfolgenden Metriken auf falschen Daten aufgebaut
- **Separate Plan-Dateien pro Requirement:** Kleine, fokussierte Pläne (1-3 Requirements pro Plan) machten Execution schnell und überschaubar
- **Automatische Verifikation:** `gsd-verify-work` mit muss-haves/grep-Checks fing Regressionen früh ab; `human_needed`-Flags für Laufzeit-Verhalten waren ehrlich und nicht blockierend
- **Atomare Commits pro Plan:** Jede Plan-Execution endete mit einem sauberen Commit — einfach rückrollbar

### What Was Inefficient

- **REQUIREMENTS.md nie aktualisiert:** Die Traceability-Tabelle blieb auf "Pending" obwohl alle Requirements umgesetzt waren — manuelle Aktualisierung wurde nie getriggert
- **ROADMAP.md Checkboxen inkonsistent:** Phase 3 Pläne blieben `[ ]` obwohl Summaries existierten — ROADMAP wird nicht automatisch beim Plan-Abschluss aktualisiert
- **Performance Metrics in STATE.md unvollständig:** Nur Phase 02 hatte Timing-Daten; andere Phasen wurden nicht erfasst

### Patterns Established

- **30s-Heartbeat-Timeout** als universelles Auto-Discovery-Muster für Bridge und Bots
- **`/api/bots/:id/stats`-Endpunkt** für trade-basierte Bot-Metriken (trennt Bot-Status von Bot-Performance)
- **`ticket_registry.json`-Persistenz** als leichtgewichtige Lösung für Bridge-Neustart-Robustheit
- **`botId` + `sourceId` auf Trade** als zweigleisige Attribution (Bot-Instanz + Quelle)

### Key Lessons

- Laufzeit-Verhalten (Timeouts, Live-Browser-Tests) kann nicht automatisiert verifiziert werden — `human_needed` klar markieren und beim Milestone-Close per Acknowledge durchlassen
- Code-Review nach Phase-Execution (via `/gsd-code-review`) fand mehrere echte Bugs (race conditions, unsafe writes) die sonst durchgegangen wären
- Trade-Attribution ist tatsächlich das Fundament — fast jeder nachfolgende Bug ließ sich auf fehlende/falsche `sourceId`/`botId` zurückführen

### Cost Observations

- Sessions: ~5-6 (über 3 Tage, 2026-06-09 bis 2026-06-12)
- Notable: Phasen 1-3 an einem Tag (2026-06-10), Phase 4 am nächsten Tag

---

## Cross-Milestone Trends

*(Wird nach weiteren Meilensteinen befüllt)*
