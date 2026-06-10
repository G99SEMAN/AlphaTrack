# Roadmap: AlphaTrack — TODO Abarbeitung

## Overview

Dieses Brownfield-Bugfix-Projekt arbeitet 21 offene TODOs ab. Die Reihenfolge ist goal-backward: Zuerst wird die Trade-Attribution korrekt gemacht (Fundament aller Statistiken), dann Bridge- und Bot-UI bereinigt, zuletzt Performance-Visualisierung und finale UI-Fixes abgeschlossen.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Datenkorrektheit** - Trade-Attribution, Status und Sync-Zähler korrekt (completed 2026-06-10)
- [ ] **Phase 2: Bridge-Bereinigung** - Auto-Discovery und UI-Cleanup der Bridge
- [ ] **Phase 3: Bot-Verbesserungen** - Korrekte Bot-Metriken und aufgeräumte Bot-Settings
- [ ] **Phase 4: Performance & Abschluss** - Performance-Grafiken, Seitenbereinigung und UI-Fix

## Phase Details

### Phase 1: Datenkorrektheit

**Goal**: Jeder Trade ist eindeutig einer Quelle zugeordnet, kein Trade hat falschen Status, und alle Zähler zeigen korrekte Werte
**Depends on**: Nothing (first phase)
**Requirements**: TRADES-01, TRADES-02, TRADES-03, NET-01, SYNC-01
**Success Criteria** (what must be TRUE):

  1. Trades, die in MetaTrader geschlossen wurden, werden in AlphaTrack als geschlossen angezeigt — kein Trade bleibt fälschlicherweise offen
  2. Jeder Trade in der Journal-Ansicht trägt eine Quell-ID (Bot-ID oder `bridge/tradeexecuter`) — kein Trade ist ohne Quell-Zuordnung
  3. Trade-Executor-Trades enthalten `/bridge/tradeexecuter` im MetaTrader-Kommentar
  4. Bridge-Netzwerkansicht und Bot-Ansicht zeigen dieselbe Trade-Anzahl — kein 8-vs-1-Mismatch sichtbar
  5. Sync-Zähler zeigt eine plausible Zahl (nicht 8400+); nach einem Neustart liegt er im erwarteten Bereich

**Plans**: 4 plans
Plans:

- [x] 01-01-PLAN.md — TRADES-02: sourceId-Feld am Trade-Typ + Befüllung/Migration im Trade-Endpunkt (Wave 1)
- [x] 01-02-PLAN.md — TRADES-01: Close-Event-Endpunkt + Heartbeat-Fallback für Trade-Status (Wave 1)
- [x] 01-03-PLAN.md — SYNC-01 + NET-01: Sync-Zähler aus UI entfernen + Netzwerk/Bot-Konsistenz verifizieren (Wave 2)
- [x] 01-04-PLAN.md — TRADES-03: MT5-Kommentar '/bridge/tradeexecuter' in Python-Bridge (Wave 1)

### Phase 2: Bridge-Bereinigung

**Goal**: Die Bridge-Komponente verwaltet sich selbst — kein manueller Eingriff nötig, und die UI zeigt nur relevante Steuerelemente
**Depends on**: Phase 1
**Requirements**: BRIDGE-01, BRIDGE-02, BRIDGE-03, BRIDGE-04
**Success Criteria** (what must be TRUE):

  1. Wenn die Bridge sich verbindet, erscheint sie in der UI automatisch — wenn sie sich trennt, verschwindet sie ohne manuelles Löschen
  2. Kein Trash-Icon / Löschen-Button ist in der Bridge-UI sichtbar
  3. Der Bridge-Log enthält keinen Filter "Alle Bots" — nur bridge-eigene Einträge sind filterbar
  4. Die Bridge-Settings-Seite existiert nicht mehr (navigieren zu ihr ergibt 404 oder Weiterleitung)

**Plans**: 2 plansPlans:

- [ ] 02-01-PLAN.md — BRIDGE-01 + BRIDGE-02: Heartbeat-Timeout-Filter (Auto-Discovery) + Trash-Icon entfernen (Wave 1)
- [ ] 02-02-PLAN.md — BRIDGE-03 + BRIDGE-04: Bot-Filter aus Bridge-Log entfernen + Bridge-Settings-Seite loeschen (Wave 1)

**Cross-cutting constraints:**

- npm run build kompiliert ohne TypeScript-Fehler

**UI hint**: yes

### Phase 3: Bot-Verbesserungen

**Goal**: Bot-Karten zeigen korrekte Metriken (Positionen, P&L, Trade-Anzahl) und Bot-Settings sind auf die tatsächlich nötigen Funktionen reduziert
**Depends on**: Phase 1
**Requirements**: BOTS-01, BOTS-02, BOTS-03, BOTS-04, BOTS-05, BOTS-06, BOTS-07, BOTS-08
**Success Criteria** (what must be TRUE):

  1. Die Bot-Karte zeigt die tatsächliche Anzahl offener Positionen (nicht 0 wenn Trades offen sind)
  2. Die Bot-Karte zeigt P&L des jeweiligen Bots statt Balance; das leere "Synced"-Feld ist nicht mehr vorhanden
  3. Die Bot-Karte zeigt die Gesamt-Trade-Anzahl des Bots
  4. Wenn ein Bot sich trennt, verschwindet er automatisch aus der Liste — kein Entfernen-Button nötig
  5. Bot-Settings zeigen editierbare Parameter (z.B. Lotgröße) mit Bestätigen-Button; Namens-Bearbeitung und Entfernen-Button sind entfernt

**Plans**: TBD
**UI hint**: yes

### Phase 4: Performance & Abschluss

**Goal**: Performance-Grafiken zeigen korrekte Bot-spezifische Daten, veraltete Seiten sind entfernt, und die Trade-Ansicht hat einen visuell konsistenten Stil
**Depends on**: Phase 1
**Requirements**: PERF-01, PERF-02, BOTLOG-01, UI-01
**Success Criteria** (what must be TRUE):

  1. Der Bot-Performance-Graph zeigt P&L über Zeit korrekt und bot-spezifisch an (setzt Phase 1 Trade-Attribution voraus)
  2. Die Performance-Ansicht zeigt die Trade-Anzahl je Bot
  3. Die Bot-Log-Seite existiert nicht mehr (navigieren zu ihr ergibt 404 oder Weiterleitung)
  4. Die Trennlinie zwischen offenen Trades hat denselben visuellen Stil wie bei vergangenen Trades

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Datenkorrektheit | 4/4 | Complete   | 2026-06-10 |
| 2. Bridge-Bereinigung | 0/2 | Planned | - |
| 3. Bot-Verbesserungen | 0/? | Not started | - |
| 4. Performance & Abschluss | 0/? | Not started | - |
