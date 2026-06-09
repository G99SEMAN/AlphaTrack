# Codebase Concerns

**Analysis Date:** 2026-06-09

## Tech Debt

### Synchronous File I/O in API Routes (High Impact)

**Issue:** Multiple API routes use synchronous file operations (`readFileSync`, `writeFileSync`) which block the event loop and can cause request timeouts under concurrent load.

**Files:**
- `src/app/api/einstellungen/export/route.ts` — exports profiles/trades/screenshots, blocking during ZIP generation and file reads
- `src/app/api/einstellungen/import/route.ts` — imports and writes multiple files synchronously
- `src/app/api/screenshots/[filename]/route.ts` — serves images with synchronous file reads
- `src/app/api/bots/performance-tracked/route.ts` — synchronous read/write for tracking data
- `src/app/api/wirtschaftskalender/erklaerung/route.ts` — reads cache file synchronously

**Impact:** 
- Request latency spikes during export/import operations
- Potential request timeouts if multiple exports/imports run concurrently
- Poor scalability under concurrent API usage
- Could cause 503 errors on slow file systems

**Fix approach:**
- Replace `readFileSync`/`writeFileSync` with async `fs.promises` API
- Use `promises.readFile()`, `promises.writeFile()`, `promises.mkdir()`
- Maintain atomic writes using temp file pattern but with async operations
- Add connection timeouts and concurrent operation limits

### Duplicate Atomic Write Implementation

**Issue:** Atomic write logic is duplicated across multiple files, with identical implementations but no shared utility (except `fs-utils.ts` which is unused).

**Files:**
- `src/lib/fs-utils.ts` — defines `atomicWrite()` but only used in `einstellungen-actions.ts`
- `src/lib/profiles.ts` — has its own `atomicWrite()` implementation (lines 27-31)
- `src/lib/bot-data.ts` — has its own `atomicWrite()` implementation (lines 30-35)

**Impact:**
- Code duplication makes maintenance harder
- Inconsistency risk if one implementation is updated
- No central place to improve atomic write safety

**Fix approach:**
- Export `atomicWrite()` from `src/lib/fs-utils.ts`
- Replace all inline implementations with imports from `fs-utils.ts`
- Consider adding a safer version that creates directory structure automatically

### Cache Invalidation Complexity

**Issue:** React `cache()` function is used in data layer (`getProfiles`, `getActiveProfileId`) but no consistent invalidation strategy across the app. Some Server Actions call `revalidatePath()` but not all paths are covered correctly.

**Files:**
- `src/lib/profiles.ts` — uses `cache()` for profile reads
- `src/lib/bot-data.ts` — has both in-memory caching (`_botsCache`, `_botsWithStatusCache`) and `cache()` usage
- `src/lib/actions.ts` — inconsistent `revalidatePath()` calls, sometimes missing after mutations

**Impact:**
- Potential stale data shown in UI after profile/trade updates
- Browser caching at 31536000s (1 year) on screenshots could cause outdated images
- No cache invalidation for bot trades after sync with bridge

**Fix approach:**
- Audit all Server Actions to ensure they call appropriate `revalidatePath()` or `revalidateTag()`
- Replace per-file caching with tag-based revalidation in Next.js
- Document cache invalidation requirements for each mutation

### Type Safety Issues with `unknown` and `Record<string, unknown>`

**Issue:** Several API routes accept generic `Record<string, unknown>` payloads and cast to specific types without proper validation.

**Files:**
- `src/app/api/bridge/trades/route.ts` (line 46) — `normalizeTrade()` uses `Record<string, unknown>` with unsafe cast
- `src/app/api/bridge/discover/route.ts` (line 86) — `infoData` typed as `Record<string, unknown>` with unsafe property access
- `src/app/api/einstellungen/import/route.ts` — JSON data not fully validated before use

**Impact:**
- Runtime errors if API clients send unexpected payload structures
- No validation of critical fields like `externalId`, `symbol`, `direction`
- Silent failures if type assumptions are violated

**Fix approach:**
- Create Zod or similar schema validators for all API payloads
- Validate at route handler entry point, before processing
- Use type-safe casting with explicit validation

## Known Bugs

### Profile Trade Sync Race Condition

**Symptoms:** After bridge sends trades to `/api/bridge/trades`, sometimes profile trades don't update immediately in `/journal` view, or show inconsistent state.

**Files:**
- `src/app/api/bridge/trades/route.ts` (lines 9-32, 141)
- `src/lib/bot-data.ts` — trade deduplication logic

**Trigger:** 
1. Bridge sends trades with same `externalId` while UI is fetching profile trades
2. `syncBridgeTradesToProfile()` runs after bot trades are saved
3. If profile trades are fetched between the two operations, data is stale

**Workaround:** Refresh dashboard manually or wait for next auto-sync

**Fix approach:**
- Use a transaction-like pattern: read both bot-trades and profile-trades, merge, write both atomically
- Add version numbers or timestamps to detect concurrent modifications

### Bot Log Deduplication Not Working

**Issue:** Bot log entries with identical `timestamp`, `level`, and `message` should be deduplicated, but timezone-dependent timestamps may prevent deduplication.

**Files:**
- `src/lib/bot-data.ts` (line 247) — dedup key uses exact timestamp match

**Trigger:**
- Bot sends logs with high precision timestamps that differ by milliseconds
- Same signal received multiple times with slightly different timestamps

**Impact:** Bot logs grow unbounded with near-duplicate entries

**Fix approach:**
- Round timestamps to seconds for dedup key
- Or use a time-window approach: dedupe entries within 5-second window
- Consider moving to event-based logging with sequence numbers

### Screenshot Path Traversal Not Fully Mitigated

**Issue:** Screenshot endpoint uses regex validation but could be vulnerable to edge cases with encoded characters.

**Files:**
- `src/app/api/screenshots/[filename]/route.ts` (line 19) — regex `/^[a-zA-Z0-9_-]+\.[a-zA-Z]{2,5}$/` doesn't account for encoded characters

**Current mitigation:** Basic regex + path resolution in `path.join()`

**Risk:** Low if Next.js param handling is secure, but regex could be more explicit about allowed extensions

**Fix approach:**
- Enumerate allowed extensions explicitly: `['png', 'jpg', 'jpeg', 'webp', 'gif']`
- Validate against that list, not a broad regex
- Add `path.resolve()` to verify final path is within screenshots directory

## Security Considerations

### API Key Storage in `data/api-keys.json`

**Risk:** API keys (ANTHROPIC_API_KEY, BOT_API_KEY) stored in plaintext in `data/api-keys.json`. If data directory is backed up or shared, keys are exposed.

**Files:**
- `src/lib/api-keys.ts` (lines 28-35) — saves keys to JSON
- `src/app/api/einstellungen/import/route.ts` — can restore keys from backup
- `src/lib/einstellungen-actions.ts` (line 47) — validates keys with basic regex

**Current mitigation:** 
- Environment variables checked first (`process.env[name]`)
- File-based keys are fallback only
- Basic SAFE_VALUE regex validation

**Recommendations:**
- Document that `data/api-keys.json` must not be committed to git
- Add warning in UI if API keys are stored in file vs env vars
- Consider encrypting file-based keys at rest
- Add audit logging for key access/modification
- Rotate keys periodically in production

### BOT_API_KEY Header Comparison (Timing-Safe)

**Status:** SECURE — `src/lib/auth.ts` correctly uses `crypto.timingSafeEqual()` to prevent timing attacks

### SSRF Protection in Bridge Discovery

**Status:** SECURE — `src/app/api/bridge/discover/route.ts` validates URLs and blocks loopback/private addresses

### Backup File Size Limit

**Status:** SECURE — 50MB limit enforced in `src/app/api/einstellungen/import/route.ts`

### File ID Validation in Import

**Status:** SECURE — Whitelist regex `/^[a-zA-Z0-9_-]+$/` prevents traversal in file paths

## Performance Bottlenecks

### Excessive Re-renders in Large Lists

**Issue:** `TradeRow.tsx` (554 lines) and `JournalClient.tsx` (429 lines) don't use React.memo or virtualization for trade lists. Importing 1000+ trades causes browser lag.

**Files:**
- `src/components/journal/TradeRow.tsx` — no memo, renders full row for every trade
- `src/components/journal/JournalClient.tsx` — renders all trades without virtualization

**Cause:** No pagination or virtualization library in dependencies

**Impact:**
- Initial render of 500+ trades takes 3-5 seconds
- Scroll lag on journal page
- High memory usage

**Improvement path:**
- Add `react-window` or `react-virtual` for virtualization
- Implement pagination (20-50 trades per page)
- Memoize `TradeRow` with `React.memo()`
- Add index to MongoDB/file-based queries if backend used

### No Database — File-Based Data at Scale Limit

**Issue:** All data (profiles, trades, strategies, bot logs) stored as JSON files. No database means O(n) reads and writes for all operations.

**Files:**
- `src/lib/profiles.ts` — `saveProfiles()` rewrites entire file
- `src/lib/bot-data.ts` — `saveBotTrades()` rewrites entire file
- Data files in `data/` directory

**Current scale:** Works fine up to ~5000 trades per profile. Beyond that:
- Export/import becomes slow (serialize/deserialize entire file)
- Concurrent read/write causes issues
- No indexing on instrument, date, or bot_id

**Scaling limit:** ~50,000 total trades across all profiles before unacceptable slowdown

**Improvement path:**
- Migrate to SQLite for local use (no external service)
- Or use LevelDB/RocksDB for key-value storage
- Add indexes on common queries (instrument, date range, bot_id)
- Implement pagination at data layer

### Log File Unbounded Growth

**Issue:** Bot log entries (`bot-log-*.json`, `bot-events-*.json`) are capped at 100 entries per bot, but if many bots run continuously, total log storage grows quickly.

**Files:**
- `src/lib/bot-data.ts` (line 17) — `BOT_MAX_LOG_ENTRIES = 100`
- Bridge logs never pruned

**Impact:**
- `/data/bot-log-*.json` files can reach MB+ size with high-frequency logging
- Log queries slow down as JSON files grow

**Improvement path:**
- Implement time-based retention (e.g., keep 7 days of logs)
- Or implement circular buffer with max file size
- Archive old logs to separate location

## Fragile Areas

### Multi-Step Setup Wizard State Management

**Files:** `src/components/profile/ProfileSetupForm.tsx` (842 lines)

**Why fragile:** 
- Single component manages 4+ steps with nested state (step, substeps, form data, import state)
- No state machine; manual step progression can get out of sync
- Import subflow has conditional logic spread across 200+ lines

**Safe modification:**
- Break into smaller subcomponents (Step1Form, Step2Form, etc.)
- Use React Context or state machine library (xstate) for step progression
- Add invariant checks: `step === 4` should guarantee `importSubStep` is set

**Test coverage gaps:**
- No test for completing full 4-step wizard
- Import edge cases not tested (file parsing errors, missing broker)
- Step backward navigation not tested

### Modal Portal Rendering in `TradeModal.tsx`

**Files:** `src/components/journal/TradeModal.tsx` (656 lines)

**Why fragile:**
- Uses `createPortal()` with `document.body.style.overflow` manipulation (lines 74-78)
- Multiple overlapping modals could conflict on overflow property
- Screenshot upload uses FileReader without progress tracking

**Safe modification:**
- Centralize portal rendering in layout component
- Use shared scroll-lock context instead of direct DOM manipulation
- Add error boundary around modal

**Test coverage gaps:**
- Screenshot upload with large files (>5MB) not tested
- Concurrent modal opens not tested
- Form validation edge cases (RR ratio, negative P&L)

### Import/Export with External File Paths

**Files:**
- `src/app/api/einstellungen/export/route.ts`
- `src/app/api/einstellungen/import/route.ts`

**Why fragile:**
- ZIP file structure must match exactly (`backup.json`, `screenshots/` folder)
- No version detection; old backup formats would fail silently
- Screenshots referenced by path in trades; if filenames don't match, trades orphaned

**Safe modification:**
- Add explicit format version check with error message
- Verify all referenced screenshots exist before committing import
- Implement rollback if import fails (restore from backup)

**Test coverage gaps:**
- Corrupted backup.json not tested
- Missing screenshots in ZIP not tested
- Importing backup into non-empty database not tested

## Scaling Limits

### Network Discovery Auto-Scan

**Current capacity:** Scans 192.168.178.1-254 sequentially in batches of 30 (SCAN_CONCURRENCY)

**Limit:** Discovers first responding Bridge only; if multiple bridges on network, only one found

**Scaling path:**
- Change to return all responding bridges
- Let user select which one to connect to
- Cache bridge locations to avoid re-scan

**Files:** `src/app/api/bridge/discover/route.ts` (lines 44-55)

### Bot Command Queue

**Current capacity:** All commands stored in memory + file for single bot instance

**Limit:** No distributed command queue; if AlphaTrack restarts, queued commands are lost (though this is acceptable for local deployment)

**Scaling path:** If deploying to cloud, implement Redis/RabbitMQ for command queue

**Files:** `src/lib/bot-data.ts` (lines 174-209)

### Profile-per-File Architecture

**Current capacity:** ~20 profiles before profile list loading becomes noticeable

**Limit:** Each profile has separate files for trades (`trades-{id}.json`), strategies (`strategies-{id}.json`), bot trades (`bot-trades-{id}.json`). File I/O scales linearly with profile count.

**Scaling path:** Migrate to single database file with indexing

**Files:** `src/lib/profiles.ts`, `src/lib/bot-data.ts`

## Dependencies at Risk

### ANTHROPIC_API_KEY Dependency

**Risk:** `src/app/api/wirtschaftskalender/erklaerung/route.ts` requires ANTHROPIC_API_KEY to fetch calendar explanations. If key is missing/invalid, calendar page fails silently.

**Impact:** 
- Economic calendar feature unavailable if key not set
- No warning shown to user, just empty explanations

**Migration plan:**
- Make ANTHROPIC_API_KEY optional
- Show warning in UI if key not configured
- Cache explanations locally to reduce API calls
- Or implement fallback explanation from hardcoded data

**Files:** `src/app/api/wirtschaftskalender/erklaerung/route.ts` (lines 35-50)

### JSZip for Export/Import

**Risk:** JSZip is third-party dependency; if it has security vulnerability, both export/import affected

**Current usage:**
- `src/app/api/einstellungen/export/route.ts` — ZIP generation
- `src/app/api/einstellungen/import/route.ts` — ZIP parsing

**Mitigation:** Version pinned in package.json at ^3.10.1

**Recommendation:** Monitor security advisories; consider native Node.js zip library if one becomes stable

## Missing Critical Features

### No Backup/Recovery Strategy

**Problem:** If `data/` directory is lost, all profiles, trades, and strategies are gone. No automatic backup or recovery mechanism.

**Blocks:** Running AlphaTrack in production; data loss risk is too high

**Solution approach:**
- Implement automatic daily backup to NAS (via import/export)
- Or add database transaction logging
- Document backup/restore procedure
- Add backup status indicator in UI

### No Undo/Redo for Trades

**Problem:** Deleting a trade is permanent; no way to recover or view deleted trades

**Blocks:** Users are reluctant to use journal for record-keeping if deletion is risky

**Solution approach:**
- Soft delete: mark trades as deleted, don't show in journal but keep in file
- Trash/recovery folder in UI
- Audit log of all modifications

### No Trade Reconciliation UI

**Problem:** Bridge sends trades, profile has trades. If they diverge, no UI shows conflicts or lets user reconcile.

**Blocks:** Complex trading workflows where bridge and UI get out of sync

**Files:** `src/app/api/bridge/trades/route.ts` (lines 9-32) — reconciliation is automatic, no user control

**Solution approach:**
- Show reconciliation report when trades synced
- Let user approve/reject synced trades
- Highlight conflicts in journal

## Test Coverage Gaps

### No Unit Tests

**What's not tested:** Zero test files found in codebase

**Files:** No `*.test.ts`, `*.spec.ts` files

**Risk:** 
- Regression bugs not caught
- Refactoring breaks functionality silently
- API contract changes go unnoticed

**Specific gaps:**
- `src/lib/actions.ts` — Server Actions not tested (createTrade, updateTrade, deleteProfile, etc.)
- `src/app/api/bridge/trades/route.ts` — Trade sync deduplication logic not tested
- `src/lib/bot-data.ts` — Cache invalidation not tested

**Priority tests to add:**
1. Trade deduplication with same `externalId`
2. Profile creation → trade save sequence
3. Bot command queuing and pruning
4. Bridge trade sync conflict resolution
5. API key validation (timing-safe comparison)

### No Integration Tests

**Gap:** No tests for full workflows (setup wizard → create profile → import trades → reconcile with bridge)

### No E2E Tests

**Gap:** No tests simulating real bot-to-bridge-to-UI communication flow

**Recommendation:** Add Jest + React Testing Library for unit tests; consider Playwright for E2E

---

*Concerns audit: 2026-06-09*
