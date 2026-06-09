---
phase: 1
slug: datenkorrektheit
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-09
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Kein Test-Framework konfiguriert |
| **Config file** | none |
| **Quick run command** | `npm run build` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd-verify-work`:** Build must be green + manual UI checks passed
- **Max feedback latency:** 60 seconds (build), manual checks variabel

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | TRADES-02 | T-1-01 / — | sourceId in normalizeTrade() gesetzt | build | `npm run build` | ✅ | ⬜ pending |
| 1-01-02 | 01 | 1 | TRADES-01 | T-1-02 / — | Close-Event-Endpunkt mit isValidApiKey() geschützt | build + manual | `npm run build` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | TRADES-01 | T-1-03 / — | Heartbeat-Fallback markiert fehlende Trades als closed | build + manual | `npm run build` | ✅ | ⬜ pending |
| 1-01-04 | 01 | 1 | TRADES-03 | — / — | MT5-Kommentar enthält `/bridge/tradeexecuter` | manual | — | ✅ | ⬜ pending |
| 1-01-05 | 01 | 1 | NET-01 | — / — | Netzwerk- und Bot-Ansicht zeigen gleiche Zahl | manual | — | ✅ | ⬜ pending |
| 1-01-06 | 01 | 1 | SYNC-01 | — / — | Synced-Anzeige in BotsClient, BotDetailClient, WatchdogPanel, BridgeDashboardWidget entfernt | build | `npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/app/api/bridge/close-event/route.ts` — Neuer Endpunkt muss angelegt werden (❌ existiert noch nicht)

*Alle anderen Dateien existieren bereits — nur close-event/route.ts ist neu zu erstellen.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Trade wird nach Close-Event als closed angezeigt | TRADES-01 | Bridge + MT5 erforderlich | Bridge-Close-Event senden, Journal prüfen |
| Heartbeat-Fallback schließt überzählige offene Trades | TRADES-01 | Bridge + MT5 erforderlich | Trade in MT5 schließen ohne Close-Event; Heartbeat abwarten; Journal prüfen |
| Neuer Trade erhält sourceId im Journal | TRADES-02 | Bridge-POST erforderlich | Trade via Bridge/Bot eröffnen; Journal-Eintrag auf sourceId prüfen |
| MT5-Kommentar enthält `/bridge/tradeexecuter` | TRADES-03 | MT5-Zugang erforderlich | Trade via Trade-Executor ausführen; MT5-History-Kommentarfeld prüfen |
| Netzwerk- und Bot-Ansicht zeigen gleiche Trade-Anzahl | NET-01 | UI-Prüfung | Bridge verbinden, beide Ansichten öffnen und Zahlen vergleichen |
| Synced-Anzeige nicht sichtbar | SYNC-01 | UI-Prüfung | Bots-Seite und Bridge-Widget öffnen — kein "Synced"/"Sync" Feld sichtbar |
