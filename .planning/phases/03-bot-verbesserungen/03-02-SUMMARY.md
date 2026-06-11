---
plan: 03-02
phase: 03-bot-verbesserungen
status: complete
completed: 2026-06-11
requirements: [BOTS-01, BOTS-02, BOTS-03, BOTS-04, BOTS-05]
---

# Plan 03-02: Bot-Karte Metriken — SUMMARY

## What Was Built

Bot card in `BotsClient.tsx` rebuilt from heartbeat-metrics to trade-data-metrics via new `/api/bots/:id/stats` endpoint (Plan 01). Four stat tiles: P&L (color-coded), Positionen (open trades from DB), Trades (total count), Uptime.

## Key Files

- `src/app/bots/BotsClient.tsx` — stats polling, formatPnl helper, 4-tile grid
- `src/app/api/bots/[id]/stats/route.ts` — stats endpoint (+ fix: removed isSameOriginRequest gate)

## Commits

- `9f7084d` feat(03-02): Stats-Polling + Stat-Komponente erweitern
- `408d42f` feat(03-02): Stats-Grid auf P&L/Positionen/Trades/Uptime umbauen
- `350782f` fix(03-02): stats endpoint — remove isSameOriginRequest gate on GET

## UAT Results

| # | Criterion | Result |
|---|-----------|--------|
| BOTS-01 | Positionen zeigt echte offene Trades (3) | ✓ PASS |
| BOTS-02 | Kein Synced-Feld | ✓ PASS |
| BOTS-03 | P&L statt Balance, `-` ohne closed Trades | ✓ PASS |
| BOTS-04 | Trades-Kachel zeigt Gesamtanzahl (3) | ✓ PASS |
| BOTS-05 | Bot verschwindet nach ~30s bei Disconnect | ✓ PASS |

## Deviations

**Bug fix required:** `isSameOriginRequest` in stats GET route returned `false` for browser requests (browsers omit `Origin` header on same-origin GET). Removed gate — consistent with all other bot GET routes which have no auth check.

## Self-Check: PASSED
