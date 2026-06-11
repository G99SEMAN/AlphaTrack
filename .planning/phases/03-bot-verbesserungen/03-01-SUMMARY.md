---
phase: 03-bot-verbesserungen
plan: "01"
subsystem: backend-types
tags: [types, api, bot-stats, set_parameters]
dependency_graph:
  requires: []
  provides:
    - BotCommandType mit set_parameters
    - SetParametersPayload Interface
    - BotStats Interface
    - BotStatus.parameters Feld
    - GET /api/bots/:id/stats Endpunkt
    - set_parameters Validierung in command/route.ts
  affects:
    - src/types/bot.ts
    - src/app/api/bots/[id]/stats/route.ts
    - src/app/api/bridge/command/route.ts
tech_stack:
  added: []
  patterns:
    - Per-Bot API-Endpunkt nach log/route.ts Muster
    - Same-Origin-Gate auf Frontend-only Endpunkten
    - realizedPnl=null Semantik für fehlende closed-Trades
key_files:
  created:
    - src/app/api/bots/[id]/stats/route.ts
  modified:
    - src/types/bot.ts
    - src/app/api/bridge/command/route.ts
decisions:
  - "BotStats.realizedPnl ist null (nicht 0) wenn keine closed-Trades — unterscheidbar von echtem Null-P&L (D-06)"
  - "getProfileTrades(bot.profileId) statt getTrades() — profil-spezifische Trade-Datei, nicht hardcodierte trades.json (Pitfall 1)"
  - "addBotCommand bleibt unverändert — set_parameters Payload via flaskBody.payload direkt an Flask (Pitfall 4)"
metrics:
  duration: "237s (~4 min)"
  completed: "2026-06-11"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 3
---

# Phase 03 Plan 01: Daten-Layer und Backend-Typen Summary

**One-liner:** Typ-Verträge für Bot-Parameter und Stats erweitert; neuer GET /api/bots/:id/stats Endpunkt aggregiert profil-spezifische Trade-Metriken; Command-Route validiert set_parameters.

## What Was Built

### Task 1: Typ-Verträge in bot.ts (Commit: 0607907)

Vier Erweiterungen an `src/types/bot.ts`:

1. `BotCommandType` — Union um `'set_parameters'` erweitert (D-09)
2. `BotStatus.parameters?` — optionales `Record<string, string | number | boolean>` Feld (D-07/D-08); rückwärtskompatibel durch `?`
3. `SetParametersPayload` — neues Interface mit `parameters: Record<string, string | number | boolean>` (D-09)
4. `BotStats` — neues Interface mit `openCount`, `tradeCount`, `realizedPnl: number | null`, `currency` (D-02)

Die Heartbeat-Route benötigt keine explizite Änderung — `saveBotStatus` spreaded den gesamten Status-Body inkl. des optionalen `parameters`-Felds automatisch (D-08, verifiziert durch `npx tsc --noEmit`).

### Task 2: Stats-Endpunkt GET /api/bots/:id/stats (Commit: 9b5e875)

Neue Datei `src/app/api/bots/[id]/stats/route.ts`:

- Same-Origin-Gate (403) als erstes Gate (T-03-01)
- `getBotById(id)` → 404 bei unbekannter Bot-ID
- `getProfileTrades(bot.profileId)` aus `@/lib/profiles` — liest `data/trades-{profileId}.json` (Pitfall 1 vermieden: NICHT `getTrades()` aus `data.ts`)
- Filter: `t.sourceId === id`
- `openCount`: Trades mit `status === 'open'`
- `tradeCount`: alle Bot-Trades
- `realizedPnl`: Summe der `pnl`-Felder aller `status === 'closed'` Trades; `null` wenn keine vorhanden (D-06)
- `currency`: aus `getProfiles().find(...)?.currency ?? 'EUR'`
- Response typisiert als `BotStats`

### Task 3: Command-Route set_parameters (Commit: bfbed98)

Vier Änderungen an `src/app/api/bridge/command/route.ts`:

1. `SetParametersPayload` importiert
2. `'set_parameters'` zu `VALID_COMMANDS` Array hinzugefügt
3. Body-Typ um `| SetParametersPayload` erweitert
4. Validierungsblock nach close_position: prüft `typeof parameters === 'object' && !Array.isArray(parameters)` → 400 bei Verstoß (T-03-02)

`addBotCommand(bridgeId, command)` bleibt unverändert — Payload wird via bestehende `flaskBody.payload = payload` Logik an Flask weitergeleitet (Pitfall 4).

## Commits

| Task | Commit | Beschreibung |
|------|--------|--------------|
| 1 | 0607907 | feat(03-01): Typ-Verträge in bot.ts erweitern |
| 2 | 9b5e875 | feat(03-01): Stats-Endpunkt GET /api/bots/:id/stats erstellen |
| 3 | bfbed98 | feat(03-01): Command-Route um set_parameters erweitern |

## Verification

- `npx tsc --noEmit` nach jedem Task: keine Fehler
- `npm run build`: grün, alle 47 Seiten generiert, `/api/bots/[id]/stats` in Route-Liste sichtbar

## Deviations from Plan

Keine — Plan wurde exakt wie beschrieben umgesetzt.

## Known Stubs

Keine — alle drei Dateien liefern vollständige Implementierungen ohne Platzhalter.

## Threat Flags

Keine neuen unerwarteten Trust-Boundaries. Alle neuen Endpunkte (`/api/bots/:id/stats`, erweiterter `/api/bridge/command`) entsprechen dem Threat-Modell im Plan (T-03-01 bis T-03-04).

## Self-Check: PASSED

- [x] `src/types/bot.ts` existiert mit allen 4 neuen Symbolen
- [x] `src/app/api/bots/[id]/stats/route.ts` existiert und exportiert GET
- [x] `src/app/api/bridge/command/route.ts` enthält set_parameters an 3+ Stellen
- [x] Commits 0607907, 9b5e875, bfbed98 vorhanden
- [x] Build grün
