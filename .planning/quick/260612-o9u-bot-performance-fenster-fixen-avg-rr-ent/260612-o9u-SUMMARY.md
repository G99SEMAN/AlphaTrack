---
phase: quick-260612-o9u
plan: 01
subsystem: bots/performance
tags: [bug-fix, ui, data-repair, polling]
dependency_graph:
  requires: []
  provides: [bots-performance-auto-refresh, unified-pnl-source, repaired-trade-attribution]
  affects: [src/components/bots/BotPerfCard.tsx, src/app/bots/performance/BotPerformanceClient.tsx, src/app/api/bots/trades/route.ts, data/bot-trades-FiFT3HmJf-.json]
tech_stack:
  added: []
  patterns: [polling-without-loading-flicker, sourceId-attribution-filter]
key_files:
  created:
    - src/app/api/bots/trades/route.ts
  modified:
    - src/components/bots/BotPerfCard.tsx
    - src/app/bots/performance/BotPerformanceClient.tsx
    - data/bot-trades-FiFT3HmJf-.json
decisions:
  - "Sum divergence check relaxed: live bridge wrote pos_154943041 (-0.15 EUR) to bot-trades after plan was created but before journal sync — expected behavior, not a bug; 6 target repairs verified correct"
metrics:
  duration: ~10 min
  completed: 2026-06-12
---

# Phase quick-260612-o9u Plan 01: Bot Performance Fenster Fixen Summary

**One-liner:** Fixed 4 bugs in Bot Performance view: removed Avg RR KPI, added silent 10s polling, unified P&L source via new /api/bots/trades route, and repaired botId/sourceId on 6 misattributed trades.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Avg-RR-KPI entfernen + Auto-Refresh ergaenzen | 4420ce8 | BotPerfCard.tsx, BotPerformanceClient.tsx |
| 2 | P&L-Quelle vereinheitlichen (neue Route + Client-Umstellung) | 596cf19 | api/bots/trades/route.ts, BotPerformanceClient.tsx |
| 3 | Einmalige Datenreparatur der 6 Trades | bfe5d75 | data/bot-trades-FiFT3HmJf-.json |

## What Was Done

### Task 1: Avg RR entfernen + Auto-Refresh

**BotPerfCard.tsx:**
- Removed `rrSum`, `rrCount`, `avgRR` variables from the useMemo calculation
- Removed Avg RR entry from `kpis` array
- Changed grid from `grid-cols-4` to `grid-cols-3`
- Destructuring simplified to `{ totalPnl, winRate, chartData }`

**BotPerformanceClient.tsx:**
- Removed `setLoading(true)` and `setLoading(false)` from `fetchData` callback — polling no longer causes loading flicker
- Replaced single `useEffect(() => { fetchData() })` with `fetchData().finally(() => setLoading(false))` for initial load + `setInterval(fetchData, 10000)` with `clearInterval` cleanup

### Task 2: Neue Route + Client-Umstellung

**src/app/api/bots/trades/route.ts (neu):**
- GET handler with `profileId` validation (same regex as `/api/bridge/trades`)
- Returns `getProfileTrades(profileId).filter(t => t.sourceId)` — only Bot/Bridge-attributed trades
- Uses same data source as `/api/bots/[id]/stats` (getProfileTrades + sourceId filter)

**BotPerformanceClient.tsx:**
- Fetch URL changed from `/api/bridge/trades?profileId=...` to `/api/bots/trades?profileId=...`
- Card filter changed from `t.botId === bw.bot.id` to `t.sourceId === bw.bot.id` (consistent with /api/bots/[id]/stats line 17)

### Task 3: Datenreparatur

6 closed trades in `data/bot-trades-FiFT3HmJf-.json` with `botId: null, sourceId: 'bridge/tradeexecuter'` were patched atomically to `botId: 'kYH5wxoW99', sourceId: 'kYH5wxoW99'`:
- pos_154884957, pos_154885207, pos_154885363, pos_154885701, pos_154886012, pos_154886835

## Deviations from Plan

### Auto-fixed Issues

None.

### Verification Note: P&L Sum Divergence

The plan's verify check `Math.abs(sa - sb) > 0.01` failed with `9.35 vs 9.50`. Investigation revealed this is NOT a data corruption issue:

- The 6 target trades are correctly patched (verified separately)
- The divergence (-0.15 EUR) is caused by `pos_154943041` — a live trade written by the bridge to `bot-trades` after the plan was created but before its next sync to the profile journal
- This is expected behavior in a live system: `bot-trades` is the bridge's write buffer; `trades-FiFT3HmJf-.json` (journal) receives data via the sync in `/api/bridge/trades POST`
- The 6 repaired trades are confirmed correct; the sum will align once the bridge's next POST sync runs

## Known Stubs

None.

## Threat Flags

None — no new network endpoints beyond the read-only GET route (profileId-validated, no auth needed for same-origin reads).

## Self-Check

### Files exist:
- src/components/bots/BotPerfCard.tsx — FOUND (modified)
- src/app/bots/performance/BotPerformanceClient.tsx — FOUND (modified)
- src/app/api/bots/trades/route.ts — FOUND (created)
- data/bot-trades-FiFT3HmJf-.json — FOUND (modified)

### Commits exist:
- 4420ce8 — FOUND
- 596cf19 — FOUND
- bfe5d75 — FOUND

## Self-Check: PASSED
