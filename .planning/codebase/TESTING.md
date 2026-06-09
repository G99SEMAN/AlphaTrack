# Testing Patterns

**Analysis Date:** 2026-06-09

## Test Framework

**Runner:**
- Not configured — no test framework detected
- No Jest, Vitest, or other test runner in `package.json`
- No test config files found (jest.config.*, vitest.config.*, etc.)

**Assertion Library:**
- Not applicable — no testing framework installed

**Run Commands:**
- No test scripts defined in package.json
- Only dev, build, and start scripts available

## Test File Organization

**Status:** No test files found in codebase

**Search Results:**
- No `*.test.*` files in `src/` directory
- No `*.spec.*` files anywhere
- No `__tests__` directories
- No test utilities or fixtures

**Implication:**
- Codebase currently has **zero automated test coverage**
- Testing is manual only
- All functionality relies on integration testing and user testing

## Test Structure

**Not Applicable** — No test framework or tests are present in the codebase.

## Mocking

**Framework:** Not used

**What Should Be Mocked (if tests were added):**
- API calls via `fetch()` (used in `src/app/api/` routes)
- File system operations (`fs.readFileSync`, `fs.writeFileSync`, `fs.mkdirSync`)
- External APIs (Anthropic API in `src/app/api/wirtschaftskalender/erklaerung/route.ts`)
- Next.js navigation (`redirect()`, `revalidatePath()`) in Server Actions
- Browser APIs (`localStorage`, `document.documentElement`) in client components
- Date/time dependencies (for consistent test results)

**What Should NOT Be Mocked (if tests were added):**
- Core business logic (calculations, data transformations)
- Data type checking
- React component rendering and interaction patterns
- Configuration loading and parsing

## Fixtures and Factories

**Status:** Not implemented

**Where Fixtures Should Live (if tests were added):**
- `src/__fixtures__/` or `tests/fixtures/`
- Sample trade data, profiles, and strategies
- Mock API responses from external services

**Example Data that Would Need Fixtures:**
- Trade objects: `{ id, date, instrument, type, entry, exit, pnl, ... }`
- Profile objects: `{ id, name, type, broker, startCapital, currency, ... }`
- Strategy objects: `{ id, name, description, trades, stats, ... }`

## Coverage

**Requirements:** No coverage target defined

**View Coverage (if tests existed):**
```bash
npm test -- --coverage
# Currently not available
```

## Test Types

**Unit Tests:**
- Should test: Utility functions in `src/lib/` (profiles, strategies, statistics calculations)
- Should test: Type guards and data validation
- Should test: Data transformers (parsers, formatters)
- **Currently:** None implemented

**Integration Tests:**
- Should test: Server Actions combined with data persistence (`createProfileAction` → file write → state update)
- Should test: API routes with file system operations
- Should test: Component interactions with Server Actions
- **Currently:** None implemented

**E2E Tests:**
- Framework: Not used
- Should test: Full user flows (profile creation → trade import → dashboard view)
- Should test: Export/import cycle for settings and trades
- **Currently:** None implemented — only manual user testing

## Common Patterns

**Async Testing (if tests existed):**
```typescript
// For testing Server Actions
await expect(createProfileAction(formData)).resolves.not.toThrow()

// For testing async API calls
const result = await fetchFromClaude(title, country)
expect(result).toHaveProperty('zusammenfassung')
```

**Error Testing (if tests existed):**
```typescript
// For testing error handling
try {
  await deleteProfileAction(invalidId)
  fail('Should have thrown')
} catch (e) {
  expect(e).toBeInstanceOf(Error)
}

// For testing silent failures
// Should verify cache fallback when write fails
```

## Critical Gaps to Test

### High Priority (Core Functionality)

**Data Persistence:**
- File: `src/lib/profiles.ts`
- Test: Atomic writes with `.tmp` file pattern
- Test: Profile CRUD operations (create, read, update, delete)
- Test: Cache invalidation after mutations

**Trade Calculations:**
- File: `src/lib/statsExtended.ts`
- Test: Win rate calculations
- Test: P&L calculations (including commission, swap, spread costs)
- Test: Drawdown and streak calculations
- Test: Equity curve generation

**Trade Import (MT5):**
- File: `src/lib/parsers/mt5.ts`
- Test: HTML parsing for position extraction
- Test: Symbol normalization
- Test: Date parsing (MT5 format → ISO)
- Test: Initial balance detection
- Test: Handling malformed HTML

**Server Actions:**
- File: `src/lib/actions.ts`
- Test: Form data parsing and validation
- Test: Profile switching and active profile management
- Test: Trade creation with optional fields
- Test: Screenshot file handling (upload/delete)
- Test: Strategy and trade associations

### Medium Priority (User Flows)

**Export/Import:**
- File: `src/app/api/einstellungen/export/route.ts`, `import/route.ts`
- Test: ZIP file generation with correct structure
- Test: Import validation and recovery
- Test: Round-trip: export → import → no data loss

**API Routes:**
- Files: `src/app/api/*/route.ts`
- Test: Correct JSON responses
- Test: Error handling for missing profiles
- Test: Parameter validation

**Context Providers:**
- Files: `src/context/TradingLockContext.tsx`, `BotStatusContext.tsx`
- Test: State initialization from localStorage
- Test: State persistence to localStorage
- Test: Hook usage in components

### Low Priority (UI/UX)

**Component Rendering:**
- Files: Large components (`ProfileSetupForm.tsx`, `TradeModal.tsx`, `JournalClient.tsx`)
- Test: Conditional rendering based on state
- Test: Form submission and error states
- Test: Modal open/close transitions

**Hooks:**
- File: `src/hooks/useAccentTheme.ts`
- Test: Theme switching
- Test: localStorage persistence
- Test: DOM manipulation (class additions/removals)

## Recommended Testing Strategy

**Phase 1 (Immediate):**
1. Install Vitest (lightweight, Next.js compatible)
2. Add tests for `src/lib/parsers/mt5.ts` — highest risk, most complex logic
3. Add tests for statistics calculations in `src/lib/statsExtended.ts`
4. Add tests for profile CRUD in `src/lib/profiles.ts`

**Phase 2 (Soon):**
1. Add tests for all Server Actions in `src/lib/actions.ts`
2. Add integration tests for API routes
3. Add tests for trade import flow

**Phase 3 (Future):**
1. Add E2E tests using Playwright
2. Add component snapshot tests for complex components
3. Add performance benchmarks for large trade journals

## Current Risk Assessment

**High Risk (No Tests):**
- Trade calculation logic (statsExtended.ts) — 382 lines, complex math
- MT5 parsing (mt5.ts) — fragile HTML parsing, 100+ lines
- Server Actions (actions.ts) — 366 lines, many database mutations
- Data persistence (profiles.ts) — file I/O with atomic writes

**Medium Risk (Manual Testing):**
- Import/export functionality
- Multi-step forms (ProfileSetupForm.tsx — 842 lines)
- Context state management

**Low Risk:**
- Simple display components
- Read-only API routes

---

*Testing analysis: 2026-06-09*
