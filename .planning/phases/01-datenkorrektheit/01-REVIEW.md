---
phase: "01"
phase_name: "datenkorrektheit"
review_depth: standard
status: findings
files_reviewed: 8
findings:
  critical: 3
  warning: 5
  info: 2
  total: 10
reviewed_at: 2026-06-10
---

# Phase 01 Code Review — Datenkorrektheit

## Summary

The core attribution logic (sourceId, normalizeTrade) and the new close-event/heartbeat endpoints are architecturally sound, but the close-event endpoint is missing the bot-ID validation present in every other bridge route, creating a path-traversal risk in the log-file layer. Input validation across the new endpoints is inconsistent: profileId and numeric fields lack type guards that the trades route applies. Five additional warnings cover a type-system bypass, missing response-check in the UI, and a data-integrity gap in heartbeat reconciliation.

## Findings

### CR-01 — close-event: bridgeId not validated against known bots (path traversal in log layer)

**Severity:** Critical
**File:** `src/app/api/bridge/close-event/route.ts:53`

**Issue:** Every other bridge endpoint (`/trades` lines 75–81, `/heartbeat` lines 46–53) validates `bridgeId` by calling `getBotById()` and falls back to a URL-based lookup before proceeding. The close-event endpoint skips this entirely and passes the raw caller-supplied `bridgeId` directly to `addBridgeLogEntry()`. Inside `src/lib/bot-data.ts`, `addBridgeLogEntry` computes the log file path as `path.join(DATA_DIR, 'bot-log-${botId}.json')` (line 50). Because `path.join` normalises `..` segments on POSIX but not reliably across all Node versions and OS combinations, an authenticated caller (one who knows the API key) can supply `bridgeId: "../../seed/somekey"` and write a log entry to an arbitrary file path under the data directory tree.

Even setting aside path traversal, a caller can create ghost log files for bot IDs that do not exist in `bots.json`, polluting the data directory with unbounded files.

**Fix:**
```typescript
// After destructuring body, resolve and validate bridgeId exactly as heartbeat/trades do:
let resolvedBridgeId = bridgeId
if (!getBotById(bridgeId)) {
  const byUrl = getBots().find(b => b.url.includes(`/bot/${bridgeId}`))
  if (byUrl) {
    resolvedBridgeId = byUrl.id
  } else {
    return NextResponse.json({ error: 'Unknown bridgeId' }, { status: 404 })
  }
}
// Then use resolvedBridgeId for addBridgeLogEntry and all subsequent calls
```

Also add the missing import of `getBotById` and `getBots` from `@/lib/bot-data`.

---

### CR-02 — heartbeat: profileId passed to file I/O without format or existence validation

**Severity:** Critical
**File:** `src/app/api/bridge/heartbeat/route.ts:58-59`

**Issue:** `body.profileId` is passed directly to `reconcileOpenTrades()` with no validation whatsoever — no regex check, no lookup against known profiles. Inside `reconcileOpenTrades`, `getProfileTrades(profileId)` constructs the file path as `path.join(DATA_DIR, 'trades-${profileId}.json')` and reads it, then `saveProfileTrades` writes back to the same derived path. A caller who knows the API key can supply `profileId: "../bots"` to read/overwrite `data/bots.json`, or any other file in the data directory.

The trades endpoint applies both a regex guard (`/^[a-zA-Z0-9_-]{1,64}$/`) and an existence check against `getProfiles()`. The heartbeat endpoint applies neither.

**Fix:**
```typescript
if (body.profileId && Array.isArray(status.openTicketIds)) {
  // Validate format
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(body.profileId)) {
    // Silently skip — malformed profileId should not crash the heartbeat response
    addBridgeLogEntry(resolvedId, 'warn', 'Heartbeat: ungueltige profileId ignoriert', body.profileId)
  } else {
    reconcileOpenTrades(body.profileId, status.openTicketIds)
  }
}
```

---

### CR-03 — close-event: exitPrice and ticket not validated as correct types

**Severity:** Critical
**File:** `src/app/api/bridge/close-event/route.ts:27`

**Issue:** The validation guard `ticket == null || exitPrice == null` uses loose equality and only checks for null/undefined. It does not verify that `ticket` is a number or that `exitPrice` is a finite number.

- A payload `{ ticket: false, exitPrice: 0, ... }` passes the null check (`false == null` is `false`), and `externalId` becomes `"pos_false"`, which will never match a real trade but silently returns `{ ok: true, updated: false }`.
- A payload `{ ticket: 123, exitPrice: "high", ... }` passes the null check. `exitPrice` (a string) is written to `updated[idx].exit`, corrupting the trade record with a non-numeric exit price. P&L calculations downstream that assume `exit` is a number will produce `NaN`.

**Fix:**
```typescript
if (
  !bridgeId || !profileId ||
  typeof ticket !== 'number' || !Number.isFinite(ticket) ||
  typeof exitPrice !== 'number' || !Number.isFinite(exitPrice) ||
  !closeTime
) {
  return NextResponse.json({ error: 'Missing or invalid required fields' }, { status: 400 })
}
if (pnl !== undefined && (typeof pnl !== 'number' || !Number.isFinite(pnl))) {
  return NextResponse.json({ error: 'Invalid pnl value' }, { status: 400 })
}
```

---

### WR-01 — trades: normalizeTrade bypasses TypeScript type checking with double cast

**Severity:** Warning
**File:** `src/app/api/bridge/trades/route.ts:50`

**Issue:** `normalizeTrade` returns `{ ...rest, botId: resolvedBotId, sourceId } as unknown as Omit<Trade, 'id'>`. The `as unknown as` pattern is a full type-system bypass: `rest` is `Record<string, unknown>` and TypeScript cannot verify that required Trade fields (`date`, `instrument`, `type`, `entry`, `size`, `status`) are present or correctly typed. A bridge can submit a payload with `status: "OPEN"` (wrong case), `entry: "1.2345"` (string not number), or missing `instrument`, and the object will be accepted without error. These invalid objects are then written to the bot-trades JSON file and synced to profile trades, corrupting both stores.

**Fix:** Add explicit field validation in `normalizeTrade` or before calling it:
```typescript
function isValidRawTrade(raw: Record<string, unknown>): boolean {
  return (
    typeof raw.date === 'string' &&
    typeof raw.instrument === 'string' &&
    (raw.type === 'long' || raw.type === 'short') &&
    typeof raw.entry === 'number' &&
    typeof raw.size === 'number' &&
    (raw.status === 'open' || raw.status === 'closed' || raw.status === 'cancelled')
  )
}
// In POST handler, before normalizeTrade:
const validRaw = rawTrades.filter(isValidRawTrade)
const invalidCount = rawTrades.length - validRaw.length
if (invalidCount > 0) {
  addBridgeLogEntry(resolvedBridgeId, 'warn', `${invalidCount} Trade(s) mit ungueltigem Format ignoriert`)
}
const trades = validRaw.map(normalizeTrade)
```

---

### WR-02 — heartbeat: reconcileOpenTrades closes trades without exit data

**Severity:** Warning
**File:** `src/app/api/bridge/heartbeat/route.ts:13-16`

**Issue:** When `reconcileOpenTrades` determines a trade is no longer in the broker's open positions list, it sets `status: 'closed'` but does not set `exit`, `closeTime`, or `pnl`. A trade closed via reconciliation will have `status: 'closed'` with `exit: undefined`. The dashboard P&L calculation (which multiplies `exit - entry` by `size`) will produce `NaN` for these trades, corrupting aggregated statistics. The `close-event` endpoint correctly sets all three fields — reconciliation should do the same or at minimum mark the trade differently to signal incomplete close data.

**Fix:**
```typescript
return {
  ...t,
  status: 'closed' as const,
  closeTime: new Date().toISOString(),
  // exit and pnl deliberately omitted — will be backfilled by next trade sync
  notes: (t.notes ? t.notes + ' | ' : '') + '[Auto-geschlossen via Heartbeat-Reconciliation]',
}
```

Alternatively, use a separate status value or flag to indicate "pending close confirmation" rather than writing a final `closed` status without exit data.

---

### WR-03 — BotDetailClient: saveName does not check fetch response status

**Severity:** Warning
**File:** `src/app/bots/[id]/BotDetailClient.tsx:63-70`

**Issue:** The `saveName` function fires a PATCH request but never inspects `res.ok` or `res.status`. If the server returns a 4xx or 5xx response (e.g. bot not found, validation error, server crash), the UI still calls `setCurrentName(nameInput.trim())` and `setEditingName(false)`, making the UI display the new name while the server-side name was never updated. The user has no indication that the save failed, and the displayed name diverges from the stored name until the page is refreshed.

**Fix:**
```typescript
async function saveName() {
  if (!nameInput.trim() || nameInput.trim() === currentName) {
    setEditingName(false)
    return
  }
  setSavingName(true)
  try {
    const res = await fetch(`/api/bots/${bot.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nameInput.trim() }),
    })
    if (!res.ok) {
      // Optionally surface error to user
      console.error('[BotDetail] Name speichern fehlgeschlagen:', res.status)
      return
    }
    setCurrentName(nameInput.trim())
    setEditingName(false)
  } finally {
    setSavingName(false)
  }
}
```

---

### WR-04 — trades: migration write races with main save on concurrent requests

**Severity:** Warning
**File:** `src/app/api/bridge/trades/route.ts:94-98`

**Issue:** The migration block (lines 94–98) calls `saveBotTrades(profileId, existing)` to backfill `sourceId` on existing trades. Immediately after, the same request continues to build `bridgeTradesFinal` and conditionally calls `saveBotTrades(profileId, bridgeTradesFinal)` again (line 141). If two concurrent POST requests arrive for the same `profileId` where both find un-migrated trades (the file has not been written yet by the first request), both will read the original un-migrated file, both will write the migrated version, and the second write will overwrite any new trades added by the first. The system has no locking mechanism (noted as an architectural constraint), but the double-write within a single request also unnecessarily duplicates I/O. Combine the migration into the final write:

**Fix:**
```typescript
// Remove the separate migration save block. Instead, apply migration inline:
const existing = getBotTrades(profileId).map(t =>
  t.sourceId ? t : { ...t, sourceId: 'bridge/tradeexecuter' }
)
// Then proceed with existingMap, merged, etc.
// The single saveBotTrades call at line 141 will persist the migration along with any new trades.
```

---

### IN-01 — bot.ts: tradesSync is a required field in BotStatus but is no longer used in UI

**Severity:** Info
**File:** `src/types/bot.ts:49`

**Issue:** `BotStatus.tradesSync: number` (line 49) is a required (non-optional) field that was removed from all UI display components in phase 01-03. It is still required in the interface, which means every heartbeat payload from the Python bridge must include it, and any mock or test that constructs a `BotStatus` object without it will be a TypeScript error. The field serves no purpose in the TypeScript codebase after the UI removal. If it is intentionally kept for bridge compatibility, it should be marked optional (`tradesSync?: number`) to reflect that the frontend no longer depends on it.

**Fix:**
```typescript
// In src/types/bot.ts, change line 49 from:
tradesSync: number
// to:
tradesSync?: number  // Retained for bridge wire compatibility; not displayed in UI
```

---

### IN-02 — close-event: profileId validation passes before profile existence is checked

**Severity:** Info
**File:** `src/app/api/bridge/close-event/route.ts:31-52`

**Issue:** The close-event endpoint validates the format of `profileId` (line 31) but does not verify that the profile actually exists in `profiles.json` before reading and writing trades for it. The `/trades` POST endpoint explicitly checks `getProfiles().find(p => p.id === profileId)` and returns 422 with a user-friendly error. Without this check, a stale or misconfigured bridge can silently write close-events for a deleted profile, creating orphan trade files (`trades-${profileId}.json`) without any log warning.

**Fix:**
```typescript
import { getProfileTrades, saveProfileTrades, getProfiles } from '@/lib/profiles'

// After format validation, add:
const profiles = getProfiles()
if (!profiles.find(p => p.id === profileId)) {
  addBridgeLogEntry(bridgeId, 'warn', `Close-Event: unbekannte profileId ${profileId}`)
  return NextResponse.json({ error: `Unbekannte profileId: ${profileId}` }, { status: 422 })
}
```

---

## Files Reviewed

- `src/types/trade.ts`
- `src/app/api/bridge/trades/route.ts`
- `src/app/api/bridge/close-event/route.ts`
- `src/app/api/bridge/heartbeat/route.ts`
- `src/app/bots/BotsClient.tsx`
- `src/app/bots/[id]/BotDetailClient.tsx`
- `src/components/bridge/WatchdogPanel.tsx`
- `src/components/bridge/BridgeDashboardWidget.tsx`
