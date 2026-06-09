<!-- GSD:project-start source:PROJECT.md -->

## Project

**AlphaTrack — TODO Abarbeitung**

AlphaTrack ist ein Trading-Journal und Bot-Management-System für MetaTrader 5. Bots und die Bridge verbinden sich via HTTP-Protokoll; Trades werden in JSON-Dateien gespeichert und im Frontend angezeigt. Dieses Projekt arbeitet alle offenen TODO-Punkte ab: Datenkorrektheit (Trade-Zuordnung, Status), Auto-Discovery von Bridge/Bots, UI-Fixes und Seitenbereinigung.

**Core Value:** Jeder Trade muss eindeutig einer Quelle (Bridge-Trade-Executor oder einem bestimmten Bot) zugeordnet sein — ohne korrekte Trade-Attribution sind alle Statistiken, P&L-Anzeigen und Bot-Performance-Daten wertlos.

### Constraints

- **Tech Stack**: Next.js 15 + TypeScript — kein Wechsel des Frameworks
- **Storage**: JSON-Dateien in `data/` — kein Datenbankwechsel
- **Trade-Quelle**: Nur über die Bridge — keine direkt eingetippten Trades
- **Scope**: Ausschließlich die Punkte aus TODO.md

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- TypeScript 5 - Frontend (React), backend (API routes), types and utilities
- JavaScript - Node runtime for build scripts
- CSS/Tailwind - Styling (via Tailwind CSS 4 with PostCSS)

## Runtime

- Node.js 20 Alpine (specified in Dockerfile)
- Production: Node.js 20 Alpine with multi-stage build
- npm 10+ (package-lock.json v3 lockfile)
- Lockfile: present (`package-lock.json`)

## Frameworks

- Next.js 15.5.15 - Full-stack web framework
- React 19.1.0 - Component framework
- React DOM 19.1.0 - DOM rendering
- Tailwind CSS 4 - Utility-first CSS framework
- @tailwindcss/postcss 4 - PostCSS plugin for Tailwind
- Framer Motion 12.38.0 - Smooth animations and transitions
- next-themes 0.4.6 - Dark/light mode support
- Not detected
- TypeScript 5 - Type checking
- @types/node 20 - Node.js type definitions
- @types/react 19 - React type definitions
- @types/react-dom 19 - React DOM type definitions

## Key Dependencies

- @anthropic-ai/sdk 0.92.0 - Claude AI integration for market analysis
- lucide-react 1.11.0 - Icon library for UI elements
- recharts 3.8.1 - Charting library for performance visualization
- nanoid 5.1.9 - Generating unique IDs (trades, bots, etc.)
- html2canvas 1.4.1 - Screenshot generation for export
- jszip 3.10.1 - ZIP archive creation for export/import
- @types/jszip 3.4.0 - JSZip type definitions

## Configuration

- Configuration via environment variables in `.env.local` (local) or Docker `env_file`
- Supported API keys:
- Environment files: `.env.local` present, `.env.example` provided (gitignored)
- `tsconfig.json` - TypeScript compilation (strict mode, ES2017 target)
- `next.config.ts` - Next.js configuration
- Tailwind CSS 4 integration via PostCSS (no explicit postcss.config.js, auto-configured)

## Platform Requirements

- Node.js 20+
- npm 10+
- Windows/Linux/macOS compatible
- Docker with Node.js 20 Alpine base image
- Port 3000 (configurable to 3002 in docker-compose.yml)
- Volume mount: `/app/data` for persistent data (profiles, bots, trades, logs)
- Health check: HTTP GET to `/` every 30s

## Docker Deployment

- Base: `node:20-alpine`
- Working directory: `/app`
- Environment: `NODE_ENV=production`, `PORT=3000`, `HOSTNAME=0.0.0.0`
- Entrypoint: `/docker-entrypoint.sh` (custom startup script)
- Exposed: Port 3000
- Service: `alphatrack`
- Port mapping: `3002:3000`
- Restart policy: `unless-stopped`
- Health check: 30s interval, 10s timeout, 3 retries

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- React components: PascalCase (`ProfileSetupForm.tsx`, `WinRateCard.tsx`, `TradeRow.tsx`)
- Utility/library files: camelCase (`actions.ts`, `profiles.ts`, `strategies.ts`)
- API routes: match Next.js pattern (`route.ts` in `app/api/[path]/`)
- Parser files: camelCase describing what they parse (`mt5.ts`, `api-keys.ts`)
- Hook files: usePrefix pattern (`useAccentTheme.ts`, `useTradingLock()` exported from context)
- Type definition files: singular noun (`profile.ts`, `trade.ts`, `strategy.ts`, `news.ts`)
- Server actions: camelCase with `Action` suffix (`createProfileAction()`, `deleteTradeAction()`, `switchProfileAction()`)
- Regular functions: camelCase (`getProfiles()`, `createProfile()`, `updateProfile()`, `parseMT5Html()`)
- React hooks: usePrefix camelCase (`useAccentTheme()`, `useTradingLock()`)
- Component render functions: PascalCase (React components)
- Helper functions: camelCase, internal to module when possible
- Event handlers: `handleX` pattern (`handleCreateProfile()`, `handleDelete()`, `handleImportFile4()`)
- State: camelCase (`isUnlocked`, `isLong`, `pnlPositive`, `hasPnl`)
- Constants: UPPER_SNAKE_CASE (`STORAGE_KEY`, `DATA_DIR`, `ALLOWED_IMAGE_EXTS`, `PROFILE_COLORS`)
- Storage keys: camelCase with suffix indicating type (`alphatrack-accent-theme`, `alphatrack-trading-unlocked`)
- Boolean flags: `is*`, `has*`, `should*` prefix (`isUnlocked`, `hasPnl`, `shouldRender`)
- Type aliases: PascalCase (`TradeDirection`, `TradeStatus`, `ProfileType`, `Currency`, `AccentTheme`)
- Interfaces: PascalCase with optional `I` prefix (not used consistently in codebase; prefer without prefix) (`Profile`, `Trade`, `Strategy`, `Deposit`)
- Generic type parameters: single uppercase letters (`Props` for component props)

## Code Style

- No formal linter/prettier configured (none found in package.json or config files)
- 2-space indentation observed throughout
- Semicolons used consistently
- Single quotes for strings (`'use client'`, `'utf-8'`)
- Template literals for dynamic strings (`` `${var}` ``)
- Trailing commas in multi-line objects/arrays observed
- No ESLint or Prettier detected in configuration
- No pre-commit hooks defined
- TypeScript strict mode enabled (`"strict": true` in `tsconfig.json`)
- TypeScript targets ES2017 with `noEmit: true` (type-checking only)

## Import Organization

- `@/*` maps to `./src/*` (configured in `tsconfig.json`)
- All imports from src use `@/` prefix (no relative paths from src)
- Components and utilities discovered via `@/` alias consistently

## Error Handling

- Try-catch blocks with error logging to console
- Console.error() for errors: `console.error('[Context] Error:', err)`
- Console.warn() for warnings: `console.warn('[Kalender] ANTHROPIC_API_KEY fehlt')`
- Tagged logs with module name in brackets: `[AlphaTrack]`, `[Kalender]`, `[Context]`
- Silent catch blocks when error can be ignored: `try { fs.unlinkSync() } catch { /* ignorieren */ }`
- Error messages returned in NextResponse.json() for API routes
- Confirmation dialogs before destructive actions: `if (!confirm(...)) return`
- German error messages: `'Profil konnte nicht gespeichert werden. Bitte versuche es erneut.'`
- Includes context in error logs: `'[Kalender] Claude API Fehler:', e`
- Type checking in error handlers: `e instanceof Error ? e.message : String(e)`

## Logging

- `console.error()` for unexpected errors with context prefix: `console.error('[ModuleName]', message, error)`
- `console.warn()` for non-fatal issues: `console.warn('[ModuleName]', message)`
- No debug logs in production code (performance-critical sections avoid logging)
- Errors logged at the point of catch, not propagated up the call stack
- Error context includes module name in brackets for filtering
- `console.error('Analyse-Fehler:', err)` in route handlers
- `console.error('Export-Fehler:', err)` in export/import operations
- `console.error('[AlphaTrack] Screenshot löschen fehlgeschlagen:', err)` in file operations
- `console.warn('[Kalender] ANTHROPIC_API_KEY fehlt')` for missing config

## Comments

- Code is self-documenting (type annotations, clear function/variable names)
- No JSDoc comments found in codebase — methods are short and intent is clear
- Comments used sparingly for non-obvious logic
- Section separators used in large files: `// --- Profile Actions ---`
- German comments mixed with code (language of interface is German, code comments follow)
- Not used — codebase relies on TypeScript types for documentation
- Function parameters and returns are typed directly
- React component props documented via interface definitions

## Function Design

- Largest functions: 842 lines (`ProfileSetupForm.tsx` component)
- Typical utility function: 30-100 lines
- API routes: 5-20 lines (very lightweight)
- Components: 50-300 lines for complex components, 10-50 for simple ones
- Exceeding 500 lines should be refactored
- Props interface pattern for components: `interface Props { ... }`
- Named parameters preferred over positional for functions with >2 args
- FormData used for form submissions (Next.js Server Actions pattern)
- Destructuring in function signatures: `function Component({ children, className }: Props)`
- Components return JSX (React.ReactNode)
- Server actions return void or use redirect()/revalidatePath()
- API routes return NextResponse.json()
- Utility functions return typed values (arrays, objects, primitives)
- Optional fields use `?:` in types, return null/undefined when not found
- Arrays return empty array `[]` when no data (not null)

## Module Design

- Named exports for utility functions: `export function getProfiles()`
- Default export for React components: `export default function Component()`
- Multiple context hooks exported from context modules: `export function useTradingLock() { ... }`
- Type exports at top of file: `export type TradeDirection = 'long' | 'short'`
- Constants exported for reuse: `export const PROFILE_COLORS = [...]`
- Not used — imports are direct from source files
- Each component in its own file with `export default`
- Types imported individually from type files
- `src/lib/*` — utility, data persistence, calculations (no React)
- `src/types/*` — TypeScript interfaces and type definitions
- `src/components/*` — React components organized by feature
- `src/context/*` — Context providers and custom hooks
- `src/hooks/*` — Standalone custom hooks
- `src/app/*` — Next.js App Router pages and API routes

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

```text

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

- **File-based persistence** — JSON files in `data/` directory for all state (profiles, trades, bots)
- **React Server Components** — Next.js 15 leverages async components; some pages render server-side
- **Client Context Providers** — `TradingLockProvider` and `BotStatusProvider` manage global UI state
- **Atomic writes** — All file operations use temp files + rename for crash safety
- **Polling-based updates** — Bot status fetched every 5 seconds via client-side `BotStatusContext`
- **Server Actions** — Mutations (create profile, add trade) use Next.js `'use server'` actions

## Layers

- Purpose: Render UI, handle user interactions, display data
- Location: `src/app/`, `src/components/`
- Contains: Page components (Server Components), client components, layout wrappers
- Depends on: Server Actions, API routes, client contexts
- Used by: Browser, user interactions
- Purpose: Profile management, trade calculations, bot orchestration
- Location: `src/lib/` (server-side functions), `src/context/` (client-side state)
- Contains: Trade stats computation, profile CRUD, bot command queueing, data aggregation
- Depends on: File system, external APIs (News, Economic Calendar)
- Used by: Page components, API routes
- Purpose: Persist and retrieve application state
- Location: `src/lib/profiles.ts`, `src/lib/data.ts`, `src/lib/bot-data.ts`
- Contains: Atomic read/write operations, caching, file path management
- Depends on: Node.js `fs`, `path`
- Used by: Business Logic layer
- Purpose: Communicate with external systems
- Location: `src/app/api/bridge/`, `src/lib/auth.ts`
- Contains: REST endpoints, Flask bridge HTTP calls, bot command routing
- Depends on: Bot fleet endpoints, external APIs
- Used by: Frontend via fetch, Bridge/Bot fleet via HTTP POST

## Data Flow

### Primary Request Path: Trade Entry & Dashboard Load

### Bot Command Execution Flow

### Profile Creation

### Trade Import from MT5

- **Server-side state** — Profiles, trades, bot configs stored in `data/*.json`
- **Client-side transient state** — UI theme, trading lock status in `localStorage`
- **Real-time state** — Bot status (connection, heartbeat) cached with 2–5 second TTL
- **No database** — Entire system is file-based for simplicity and portability

## Key Abstractions

- Purpose: Segregate trades and settings by trading account
- Examples: `src/types/profile.ts`, `src/lib/profiles.ts`
- Pattern: Multi-tenant user context; active profile selected via `getActiveProfile()`
- Purpose: Record single transaction with entry, exit, P&L, metadata
- Examples: `src/types/trade.ts`
- Pattern: Immutable records; status = open/closed/cancelled
- Purpose: Represent a running MT5 bridge or bot instance
- Examples: `src/types/bot.ts`, `src/lib/bot-data.ts`
- Pattern: Config stored in `bots.json`; status from Flask heartbeat; commands queued in per-bot file
- Purpose: Precomputed P&L, win rate, drawdown
- Pattern: Computed on-demand from closed trades; cached by trade count + last ID

## Entry Points

- Location: `src/app/layout.tsx`
- Triggers: Browser navigation to `/`
- Responsibilities: Root layout, providers (Theme, TradingLock, BotStatus), global CSS
- Location: `src/app/dashboard/page.tsx`
- Triggers: User navigates to `/dashboard` or root redirect
- Responsibilities: Fetch active profile, compute stats, render dashboard widgets
- Locations: `src/app/api/**/*.ts` (28 routes)
- Triggers: Frontend fetch calls, Bridge HTTP POSTs, external webhooks
- Responsibilities: CRUD operations, Bridge integration, data export
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

### Implicit Type Coercion in FormData Parsing

```typescript

```

### Bot Command Delivery Fallback Without Confirmation

## Error Handling

- File read errors return empty array/null: `try { JSON.parse(...) } catch { return [] }`
- API errors return NextResponse with status codes (400, 403, 404, 502)
- Server Action errors throw and are caught by Next.js page boundary
- Bridge communication failures logged but don't block UI

## Cross-Cutting Concerns

- Bridge/Bot logs via `addBridgeLogEntry()` in `src/lib/bot-data.ts`
- Stored in `data/bot-log-${botId}.json` (capped at 100 entries per `BOT_MAX_LOG_ENTRIES`)
- UI displays in `/app/bridge/log` and `/app/bots/logs`
- Bot command validation in `src/app/api/bridge/command/route.ts:20–40`
- Trade data validation during import in `src/lib/parsers/mt5.ts`
- Form validation in modals (client-side via React Hook Form pattern)
- Same-origin check: `isSameOriginRequest()` in `src/lib/auth.ts`
- Bot API key validation: `isValidApiKey()` (timing-safe comparison)
- Session: None; relies on browser same-origin policy

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

| Skill | Description | Path |
|-------|-------------|------|
| trading-bot |  | `.claude/skills/trading-bot/SKILL.md` |
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
