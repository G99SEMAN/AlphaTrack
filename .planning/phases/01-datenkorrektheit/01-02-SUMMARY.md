---
plan: 01-02
phase: 01-datenkorrektheit
status: complete
completed: 2026-06-10
requirements: [TRADES-01]
key-files:
  created:
    - src/app/api/bridge/close-event/route.ts
  modified:
    - src/app/api/bridge/heartbeat/route.ts
---

# Plan 01-02: Close-Event + Heartbeat-Fallback (TRADES-01)

## Was wurde umgesetzt

TRADES-01 vollständig implementiert: MT5-geschlossene Trades erscheinen in AlphaTrack als `closed`.

**Task 1** — Neuer Endpunkt `POST /api/bridge/close-event` (`src/app/api/bridge/close-event/route.ts`):
- `isValidApiKey`-Guard, `profileId`-Regex-Validierung
- Trade-Suche via `externalId = pos_${ticket}` + `status === 'open'`
- Mutation: `status='closed'`, `exit=exitPrice`, `closeTime`, optionaler `pnl`-Override (D-12)
- `saveProfileTrades()` schreibt direkt in `trades-{profileId}.json` (Dashboard-Quelle)
- `revalidatePath` /dashboard /journal /statistiken (D-15); `addBridgeLogEntry` für Logging

**Task 2** — `reconcileOpenTrades()` im Heartbeat-Handler (`src/app/api/bridge/heartbeat/route.ts`):
- Modul-Level-Funktion; bildet `ticketSet` aus `pos_${t}`-Strings
- Schließt offene Trades, deren `externalId` nicht mehr im ticketSet ist (D-04)
- Aufruf nur wenn `body.profileId && Array.isArray(status.openTicketIds)` — rückwärtskompatibel
- `revalidatePath` /dashboard /journal nach Mutation

## Abweichungen

Kein `syncBridgeTradesToProfile()`-Aufruf in beiden Handlern — `saveProfileTrades()` schreibt direkt in `trades-{profileId}.json` (Dashboard-Quelle), kein Datei-Versatz (OQ2 RESOLVED laut RESEARCH).

## Self-Check: PASSED

- `close-event/route.ts` existiert mit POST-Export und isValidApiKey-Guard
- `reconcileOpenTrades` in heartbeat/route.ts auf Modul-Ebene
- Beide Handler schreiben via saveProfileTrades, KEIN syncBridgeTradesToProfile
- `npm run build` grün
