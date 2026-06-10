---
plan: 01-01
phase: 01-datenkorrektheit
status: complete
completed: 2026-06-10
requirements: [TRADES-02]
key-files:
  created: []
  modified:
    - src/types/trade.ts
    - src/app/api/bridge/trades/route.ts
---

# Plan 01-01: sourceId Trade-Attribution (TRADES-02)

## Was wurde umgesetzt

TRADES-02 vollständig implementiert: Jeder Trade trägt eine eindeutige Quell-ID (`sourceId`).

**Task 1** — `sourceId?: string` ans Ende des `Trade`-Interface in `src/types/trade.ts` angehängt. Optionales Feld für Rückwärtskompatibilität mit bestehenden Trades.

**Task 2** — `normalizeTrade()` in `src/app/api/bridge/trades/route.ts` erweitert:
- `sourceId = resolvedBotId !== null ? resolvedBotId : 'bridge/tradeexecuter'`
- Return-Statement schließt `sourceId` ein
- POST-Handler: rückwirkende Einmal-Migration via `!t.sourceId`-Guard — bestehende Trades ohne `sourceId` erhalten `'bridge/tradeexecuter'`

## Abweichungen

D-05 (per-Bot-API-Key) nicht umgesetzt — laut RESEARCH existiert nur ein globaler `BOT_API_KEY`; Attribution erfolgt über `botId` im Payload (dokumentiert im Plan-Objective).

## Self-Check: PASSED

- `sourceId?: string` in Trade-Interface vorhanden
- `normalizeTrade()` leitet sourceId korrekt ab
- Rückwirkende Migration mit `!t.sourceId`-Guard implementiert
- `npm run build` grün
