<!-- refreshed: 2026-06-09 -->
# Architecture

**Analysis Date:** 2026-06-09

## System Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend Layer (Next.js)                      │
│  Pages (layout, dashboard, journal, etc.)  Components (77 files) │
│  `src/app/**/page.tsx`                    `src/components/**`    │
├──────────────────────┬──────────────────────┬───────────────────┤
│   Profile/Trade      │   Bridge/Bot         │   Analytics       │
│   Management         │   Control            │   Calculators     │
│  `src/components/    │  `src/components/    │  `src/components/ │
│   profile/`          │   bridge/`           │   analyse/`       │
│  `src/components/    │  `src/components/    │  `src/components/ │
│   journal/`          │   bots/`             │   statistiken/`   │
└────────┬─────────────┴────────┬─────────────┴──────┬────────────┘
         │                      │                     │
         ▼                      ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│              Server-Side Logic Layer (Next.js)                   │
│  Server Actions        API Routes          Data Services        │
│  `src/lib/actions.ts`  `src/app/api/**`    `src/lib/*.ts`       │
│                                                                   │
│  - Profile Management  - REST Endpoints    - Trade Calculations │
│  - Trade Operations    - Bot Commands      - Bot Status Mgmt    │
│  - Export/Import       - Bridge Integration - Statistics Compute │
└────────┬──────────────┬────────┬──────────┬───────┬──────┬─────┘
         │              │        │          │       │      │
         ▼              ▼        ▼          ▼       ▼      ▼
┌──────────────┐ ┌──────────┐ ┌─────────┐ ┌───────────────────┐
│   React      │ │  Bridge  │ │ External│ │ localStorage &    │
│   Contexts   │ │ (Python) │ │  APIs   │ │ sessionStorage    │
│              │ │  Bot     │ │         │ │                   │
│ `src/context/│ │  Fleet   │ │ News,   │ │ Settings, themes, │
│ *.tsx`       │ │          │ │ Calendar│ │ trading lock state│
└──────────────┘ └──────────┘ └─────────┘ └───────────────────┘
         │              │
         ▼              ▼
┌─────────────────────────────────────────────────────────────────┐
│              Persistent Storage Layer                            │
│  File-Based JSON Storage (data/)                                │
│  - `data/profiles.json` - Trading profiles                      │
│  - `data/trades.json` - Trade records                           │
│  - `data/bot-*.json` - Bot configs, status, logs, commands      │
│  - `data/strategies-*.json` - Strategy definitions              │
│  - `data/active.json` - Currently active profile ID             │
└─────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| **Dashboard** | Trade overview, performance metrics, equity curve | `src/app/dashboard/page.tsx` |
| **Journal** | Trade entry, editing, filtering, export/import | `src/app/journal/page.tsx` |
| **Bridge** | Bot command execution, status monitoring, live feeds | `src/app/bridge/page.tsx` |
| **Bot Management** | Bot CRUD, logs, performance analytics | `src/app/bots/page.tsx` |
| **Settings** | App config, export/import workspace data | `src/app/einstellungen/page.tsx` |
| **Profile System** | Multi-profile support, profile switching | `src/lib/profiles.ts` |
| **Trade Data** | Trade CRUD, statistics calculation, P&L computation | `src/lib/data.ts` |
| **Bot Data** | Bot status, command queuing, bridge logs | `src/lib/bot-data.ts` |
| **Auth** | API key validation, same-origin verification | `src/lib/auth.ts` |

## Pattern Overview

**Overall:** Multi-tenant SPA with server-side data persistence, real-time bot polling, and REST API backend.

**Key Characteristics:**
- **File-based persistence** — JSON files in `data/` directory for all state (profiles, trades, bots)
- **React Server Components** — Next.js 15 leverages async components; some pages render server-side
- **Client Context Providers** — `TradingLockProvider` and `BotStatusProvider` manage global UI state
- **Atomic writes** — All file operations use temp files + rename for crash safety
- **Polling-based updates** — Bot status fetched every 5 seconds via client-side `BotStatusContext`
- **Server Actions** — Mutations (create profile, add trade) use Next.js `'use server'` actions

## Layers

**Presentation Layer:**
- Purpose: Render UI, handle user interactions, display data
- Location: `src/app/`, `src/components/`
- Contains: Page components (Server Components), client components, layout wrappers
- Depends on: Server Actions, API routes, client contexts
- Used by: Browser, user interactions

**Business Logic Layer:**
- Purpose: Profile management, trade calculations, bot orchestration
- Location: `src/lib/` (server-side functions), `src/context/` (client-side state)
- Contains: Trade stats computation, profile CRUD, bot command queueing, data aggregation
- Depends on: File system, external APIs (News, Economic Calendar)
- Used by: Page components, API routes

**Data Access Layer:**
- Purpose: Persist and retrieve application state
- Location: `src/lib/profiles.ts`, `src/lib/data.ts`, `src/lib/bot-data.ts`
- Contains: Atomic read/write operations, caching, file path management
- Depends on: Node.js `fs`, `path`
- Used by: Business Logic layer

**Integration Layer:**
- Purpose: Communicate with external systems
- Location: `src/app/api/bridge/`, `src/lib/auth.ts`
- Contains: REST endpoints, Flask bridge HTTP calls, bot command routing
- Depends on: Bot fleet endpoints, external APIs
- Used by: Frontend via fetch, Bridge/Bot fleet via HTTP POST

## Data Flow

### Primary Request Path: Trade Entry & Dashboard Load

1. User navigates to `/dashboard` (`src/app/dashboard/page.tsx`)
2. Server-side page component calls:
   - `ensureSeedData()` — Initialize test data if needed
   - `getProfiles()` — Read `data/profiles.json` via `src/lib/profiles.ts`
   - `getActiveProfile()` — Get current working profile
   - `getProfileTrades(profileId)` — Read `data/trades-${profileId}.json`
   - `computeStats(trades)` — Calculate P&L, win rate, drawdown in `src/lib/data.ts`
3. Dashboard renders with stats, equity chart, recent trades
4. Client-side `BotStatusProvider` polls `/api/bridge/status` every 5 seconds
5. Trade data updates via `BotStatusContext` when new trades arrive

### Bot Command Execution Flow

1. User clicks "Execute Trade" in Bridge UI (`src/components/bridge/TradeExecutorPanel.tsx`)
2. Calls `POST /api/bridge/command` with payload:
   ```json
   { "bridgeId": "bot-id", "command": "execute_trade", "payload": {...} }
   ```
3. Server-side endpoint (`src/app/api/bridge/command/route.ts`):
   - Validates origin (`isSameOriginRequest`)
   - Retrieves bot config from `data/bots.json`
   - Queues command in `data/bot-commands-${botId}.json`
   - Logs to `data/bot-log-${botId}.json`
   - Attempts direct Flask call to `${bridge.url}/command`
   - Returns `{ delivered: true/false, commandId, result? }`
4. If Bridge unreachable, command queued; Bridge polls periodically to fetch pending commands

### Profile Creation

1. User submits form on `/setup` or Profile Modal
2. Calls server action `createProfileAction()` (`src/lib/actions.ts`)
3. Action creates `Profile` object with ID, name, broker, startCapital
4. Calls `createProfile()` → `saveProfiles()` → atomically writes `data/profiles.json`
5. Also creates empty files: `data/trades-${id}.json`, `data/strategies-${id}.json`
6. Sets active profile, redirects to `/dashboard`

### Trade Import from MT5

1. User uploads CSV/MT5 file on Journal page
2. Calls `importTradesAction()` → parses via `src/lib/parsers/mt5.ts`
3. Converts rows to `Trade[]` objects with calculated PnL
4. Appends to `data/trades-${profileId}.json` via `saveProfileTrades()`
5. Invalidates page cache, re-fetches dashboard

**State Management:**
- **Server-side state** — Profiles, trades, bot configs stored in `data/*.json`
- **Client-side transient state** — UI theme, trading lock status in `localStorage`
- **Real-time state** — Bot status (connection, heartbeat) cached with 2–5 second TTL
- **No database** — Entire system is file-based for simplicity and portability

## Key Abstractions

**Profile:**
- Purpose: Segregate trades and settings by trading account
- Examples: `src/types/profile.ts`, `src/lib/profiles.ts`
- Pattern: Multi-tenant user context; active profile selected via `getActiveProfile()`

**Trade:**
- Purpose: Record single transaction with entry, exit, P&L, metadata
- Examples: `src/types/trade.ts`
- Pattern: Immutable records; status = open/closed/cancelled

**Bot (Bridge Instance):**
- Purpose: Represent a running MT5 bridge or bot instance
- Examples: `src/types/bot.ts`, `src/lib/bot-data.ts`
- Pattern: Config stored in `bots.json`; status from Flask heartbeat; commands queued in per-bot file

**TradeStats:**
- Purpose: Precomputed P&L, win rate, drawdown
- Pattern: Computed on-demand from closed trades; cached by trade count + last ID

## Entry Points

**Web App:**
- Location: `src/app/layout.tsx`
- Triggers: Browser navigation to `/`
- Responsibilities: Root layout, providers (Theme, TradingLock, BotStatus), global CSS

**Dashboard Page:**
- Location: `src/app/dashboard/page.tsx`
- Triggers: User navigates to `/dashboard` or root redirect
- Responsibilities: Fetch active profile, compute stats, render dashboard widgets

**API Routes:**
- Locations: `src/app/api/**/*.ts` (28 routes)
- Triggers: Frontend fetch calls, Bridge HTTP POSTs, external webhooks
- Responsibilities: CRUD operations, Bridge integration, data export

**Server Actions:**
- Location: `src/lib/actions.ts`
- Triggers: Form submissions, client-side mutations
- Responsibilities: Validate input, mutate files, revalidate cache

## Architectural Constraints

- **Threading:** Single-threaded Node.js event loop; no worker threads
- **Global state:** `_botsCache`, `_statsCache` module-level objects in `src/lib/bot-data.ts` and `src/lib/data.ts`; invalidated manually
- **Circular imports:** Minimal risk due to clear dependency flow: Components → Actions/API → Lib (data, profiles, bots) → none
- **File system constraints:** All reads are `cache()`d by React (server-side); writes use atomic temp+rename
- **Real-time limits:** Bot status polling every 5s; no WebSocket or Server-Sent Events
- **Storage location:** Hardcoded `process.cwd() + '/data'` and `process.cwd() + '/seed'`
- **Concurrency:** No lock mechanism; assumes single-user or browser-only access (no multi-process)

## Anti-Patterns

### Module-Level State Mutation Without Invalidation

**What happens:** `_botsCache` and `_statsCache` in `src/lib/bot-data.ts` and `src/lib/data.ts` persist between requests, but manual invalidation is required (set to `null`) in every mutation.

**Why it's wrong:** Stale cache can serve old data if a mutation forgets to invalidate; React's `cache()` helper only resets per-request, not across mutations.

**Do this instead:** Always call `_botsCache = null; _botsWithStatusCache = null` after `saveBots()`, `_statsCache = null` after `saveTrades()`. See `src/lib/bot-data.ts:66` for correct pattern.

### Implicit Type Coercion in FormData Parsing

**What happens:** `src/lib/actions.ts:29–31` casts FormData values directly: `formData.get('startCapital') as string` then `parseFloat()` without null checks.

**Why it's wrong:** If form field is missing, `get()` returns null; `as string` doesn't prevent runtime errors.

**Do this instead:** Validate before casting:
```typescript
const capital = formData.get('startCapital')
if (!capital || typeof capital !== 'string') throw new Error('Invalid startCapital')
const parsed = parseFloat(capital)
```

### Bot Command Delivery Fallback Without Confirmation

**What happens:** `src/app/api/bridge/command/route.ts:81–83` catches all network errors and returns `{ queued: true }` without retry.

**Why it's wrong:** Command is queued but Bridge may never fetch it if permanently offline; user doesn't know if order actually executed.

**Do this instead:** Implement command ACK polling or retry with exponential backoff; surface "queued, not delivered" warning to user.

## Error Handling

**Strategy:** Try-catch with fallback defaults; no global error boundary for API.

**Patterns:**
- File read errors return empty array/null: `try { JSON.parse(...) } catch { return [] }`
- API errors return NextResponse with status codes (400, 403, 404, 502)
- Server Action errors throw and are caught by Next.js page boundary
- Bridge communication failures logged but don't block UI

## Cross-Cutting Concerns

**Logging:** 
- Bridge/Bot logs via `addBridgeLogEntry()` in `src/lib/bot-data.ts`
- Stored in `data/bot-log-${botId}.json` (capped at 100 entries per `BOT_MAX_LOG_ENTRIES`)
- UI displays in `/app/bridge/log` and `/app/bots/logs`

**Validation:** 
- Bot command validation in `src/app/api/bridge/command/route.ts:20–40`
- Trade data validation during import in `src/lib/parsers/mt5.ts`
- Form validation in modals (client-side via React Hook Form pattern)

**Authentication:** 
- Same-origin check: `isSameOriginRequest()` in `src/lib/auth.ts`
- Bot API key validation: `isValidApiKey()` (timing-safe comparison)
- Session: None; relies on browser same-origin policy

---

*Architecture analysis: 2026-06-09*
