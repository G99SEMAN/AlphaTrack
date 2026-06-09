# Codebase Structure

**Analysis Date:** 2026-06-09

## Directory Layout

```
AlphaTrack/
├── .claude/                      # Claude configuration
│   └── skills/trading-bot/       # Trading bot skill definitions
├── .planning/codebase/           # Planning documents (generated)
├── bots/                         # Python bot implementations
│   ├── ai-trading/               # AI/ML bot
│   ├── breakoutv1/               # Breakout strategy bot
│   ├── scalping/                 # Scalping bot
│   ├── testbot1/                 # Timer-based test bot
│   └── scaffold/                 # Bot template
├── bridge/                       # Python MT5 Bridge (Flask server)
├── data/                         # Persistent application state (JSON)
│   ├── profiles.json             # Trading profiles
│   ├── trades.json               # Global trades (legacy)
│   ├── trades-${profileId}.json  # Per-profile trades
│   ├── strategies-${profileId}.json # Per-profile strategies
│   ├── bots.json                 # Bot/Bridge registry
│   ├── bot-status-${botId}.json  # Bot status snapshot
│   ├── bot-log-${botId}.json     # Bot logs
│   ├── bot-commands-${botId}.json# Queued commands
│   ├── active.json               # Current profile ID
│   └── bot-trades-${profileId}.json # Trades via bot
├── docs/                         # Documentation
├── launcher/                     # Launcher scripts
├── public/                       # Static assets
│   ├── icons/                    # App icons
│   ├── logo/                     # Branding
│   └── screenshots/              # Sample images
├── scripts/                      # Utility scripts
│   ├── windows/                  # Windows batch/PS scripts
│   └── linux/                    # Linux shell scripts
├── seed/                         # Test data (copied to data/ on first run)
├── src/                          # Next.js application source
│   ├── app/                      # Next.js app directory (routing)
│   │   ├── page.tsx              # Root (redirects to /dashboard)
│   │   ├── layout.tsx            # Root layout with providers
│   │   ├── globals.css           # Global styles (Tailwind)
│   │   ├── analyse/              # Trade analysis page
│   │   ├── api/                  # API routes (REST endpoints)
│   │   │   ├── bridge/           # Bridge control endpoints
│   │   │   ├── bots/             # Bot CRUD endpoints
│   │   │   ├── profiles/         # Profile CRUD
│   │   │   ├── trades/           # Trade CRUD
│   │   │   ├── einstellungen/    # Settings (export/import)
│   │   │   ├── news/             # News API
│   │   │   ├── wirtschaftskalender/ # Economic calendar
│   │   │   ├── analyse/          # Analysis history
│   │   │   └── screenshots/      # Screenshot serving
│   │   ├── bots/                 # Bot management pages
│   │   │   ├── page.tsx          # Bot list/dashboard
│   │   │   ├── [id]/             # Individual bot detail
│   │   │   ├── logs/             # Bot logs viewer
│   │   │   ├── settings/         # Bot settings
│   │   │   ├── performance/      # Bot performance charts
│   │   │   └── tpc/              # Time-Price-Correlation
│   │   ├── bridge/               # Bridge (MT5 connection) pages
│   │   │   ├── page.tsx          # Bridge dashboard
│   │   │   ├── log/              # Bridge command log
│   │   │   ├── settings/         # Bridge settings
│   │   │   ├── trades/           # Live trades from Bridge
│   │   │   └── analyse/          # Trade analyzer
│   │   ├── dashboard/            # Main dashboard page
│   │   ├── einstellungen/        # Settings page (German: "settings")
│   │   ├── journal/              # Trade journal page
│   │   ├── kalender/             # Economic calendar page
│   │   ├── netzwerk/             # Network/community page
│   │   ├── setup/                # Initial profile setup
│   │   ├── statistiken/          # Statistics page
│   │   ├── strategien/           # Strategies page
│   │   └── tpc/                  # Time-Price-Correlation analysis
│   ├── components/               # Reusable React components (77 files)
│   │   ├── layout/               # Layout wrappers
│   │   │   ├── Sidebar.tsx       # Main navigation sidebar
│   │   │   ├── BottomNav.tsx     # Mobile bottom nav
│   │   │   ├── SplashScreen.tsx  # Loading splash
│   │   │   └── ThemeToggle.tsx   # Dark/light mode toggle
│   │   ├── dashboard/            # Dashboard widgets
│   │   │   ├── PnLCard.tsx       # Profit/loss card
│   │   │   ├── EquityChart.tsx   # Equity curve chart
│   │   │   ├── DashboardWinRate.tsx # Win rate display
│   │   │   └── [other cards]
│   │   ├── journal/              # Trade journal components
│   │   │   ├── TradeModal.tsx    # Add/edit trade form
│   │   │   ├── ImportModal.tsx   # CSV import dialog
│   │   │   └── TradeShareModal.tsx # Share trade UI
│   │   ├── bots/                 # Bot management components
│   │   │   ├── BotControls.tsx   # Start/stop/pause buttons
│   │   │   ├── AddBotModal.tsx   # Add new bot form
│   │   │   └── BotKpiRow.tsx     # Bot stats row
│   │   ├── bridge/               # Bridge control components
│   │   │   ├── BridgeDashboardWidget.tsx # Status widget
│   │   │   ├── TradeExecutorPanel.tsx # Trade order UI
│   │   │   ├── LiveTradeFeed.tsx # Real-time trade stream
│   │   │   └── BridgeLogPanel.tsx # Command log display
│   │   ├── analyse/              # Analysis components
│   │   │   ├── AnalyseClient.tsx # Analysis viewer
│   │   │   ├── TradingViewWidget.tsx # Chart embedding
│   │   │   └── AnalysisResult.tsx # Result display
│   │   ├── profile/              # Profile management
│   │   │   ├── ProfileSwitcher.tsx # Switch between profiles
│   │   │   ├── ProfileSetupForm.tsx # Create profile form
│   │   │   ├── ProfileEditModal.tsx # Edit profile dialog
│   │   │   └── ProfileSetupModal.tsx # Setup modal
│   │   ├── statistiken/          # Statistics widgets
│   │   ├── strategien/           # Strategy display
│   │   ├── wirtschaftskalender/  # Economic calendar widgets
│   │   ├── news/                 # News feed
│   │   ├── rechner/              # Calculators (lot size, etc.)
│   │   ├── bot/                  # Bot detail components
│   │   └── einstellungen/        # Settings components
│   ├── context/                  # React Context providers
│   │   ├── TradingLockContext.tsx # Trading mode lock (unlock to edit)
│   │   └── BotStatusContext.tsx  # Real-time bot status polling
│   ├── hooks/                    # Custom React hooks
│   │   ├── useAccentTheme.ts     # Accent color theme hook
│   │   └── useStatsSettings.ts   # Stats filter settings
│   ├── lib/                      # Server-side utilities
│   │   ├── profiles.ts           # Profile CRUD (cache, atomic write)
│   │   ├── data.ts               # Trade CRUD & stats computation
│   │   ├── bot-data.ts           # Bot config, status, logs, commands
│   │   ├── actions.ts            # Server Actions (mutations)
│   │   ├── strategies.ts         # Strategy CRUD
│   │   ├── seed.ts               # Initialize test data
│   │   ├── auth.ts               # API key & same-origin validation
│   │   ├── news.ts               # News API client
│   │   ├── wirtschaftskalender.ts # Economic calendar fetcher
│   │   ├── analyse-data.ts       # Analysis computation
│   │   ├── api-keys.ts           # API key management
│   │   ├── currency.ts           # Currency helpers
│   │   ├── statsExtended.ts      # Extended statistics
│   │   ├── fs-utils.ts           # File system utilities
│   │   ├── parsers/              # Data parsers
│   │   │   └── mt5.ts            # MT5 CSV parser
│   ├── types/                    # TypeScript interfaces
│   │   ├── trade.ts              # Trade, TradeStats
│   │   ├── profile.ts            # Profile, Deposit
│   │   ├── bot.ts                # BotEntry, BotStatus, BotCommand
│   │   ├── strategy.ts           # Strategy definition
│   │   ├── news.ts               # News article
│   │   └── wirtschaftskalender.ts # Economic calendar event
│   └── data/                     # Static data (seed data)
├── .env.local                    # Environment variables (git-ignored)
├── next.config.js                # Next.js configuration
├── tsconfig.json                 # TypeScript configuration
├── tailwind.config.ts            # Tailwind CSS configuration
├── postcss.config.js             # PostCSS configuration
├── package.json                  # Dependencies & scripts
├── package-lock.json             # Lock file
└── README.md                     # Project documentation
```

## Directory Purposes

**`src/app/`** — Next.js App Router pages and API routes
- Server-side rendering, routing structure follows file system
- Page components are mostly async Server Components
- API routes handle REST endpoints for backend operations

**`src/components/`** — Reusable UI components (77 files)
- Organized by feature: layout, dashboard, journal, bots, bridge, etc.
- Mix of client and server components; most marked `'use client'`
- Layout components used in root and page-level layouts

**`src/lib/`** — Core business logic and data access
- Profile, trade, and bot CRUD operations
- Server Actions for mutations
- Statistics computation (P&L, win rate, drawdown)
- External API clients (news, economic calendar)
- Parsers for data import (MT5 CSV)

**`src/context/`** — Global React context providers
- `TradingLockContext` — prevent accidental edits when trading
- `BotStatusContext` — real-time polling of bot/bridge status

**`src/types/`** — TypeScript interfaces
- Trade, Profile, Bot, Strategy, News entities
- Type-safe API communication

**`data/`** — Persistent application state (JSON files)
- Created at runtime; includes production and test data
- All reads cached by Next.js `cache()` helper
- All writes use atomic temp-file-then-rename pattern
- Per-profile isolation: trades, strategies, bot data

**`bridge/` & `bots/`** — External Python services
- Bridge: MT5 connection, Flask server for bot commands
- Bots: Individual trading algorithm implementations
- Communicate via REST API (command queueing, status polling)

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx` — Root layout with Theme, TradingLock, BotStatus providers
- `src/app/page.tsx` — Redirect to `/dashboard`
- `src/app/dashboard/page.tsx` — Main dashboard (landing after login)

**Configuration:**
- `tsconfig.json` — TS compiler options; path alias `@/*` → `src/*`
- `tailwind.config.ts` — Tailwind CSS theming
- `next.config.js` — Next.js build/runtime config
- `package.json` — Dependencies (React 19, Next 15, Tailwind 4)

**Core Logic:**
- `src/lib/profiles.ts` — Profile creation/switching/deletion
- `src/lib/data.ts` — Trade CRUD and stats computation
- `src/lib/bot-data.ts` — Bot configuration, status, command queueing
- `src/lib/actions.ts` — Server Actions for all mutations

**Testing & Seeding:**
- `src/lib/seed.ts` — Copies demo data from `seed/` to `data/` on first run
- `seed/profiles.json` — Demo profiles for new users

**API Routes:**
- `src/app/api/trades/route.ts` — GET active profile trades
- `src/app/api/profiles/route.ts` — GET all non-demo profiles
- `src/app/api/bridge/command/route.ts` — POST bot command
- `src/app/api/bridge/status/route.ts` — GET bot/bridge status
- `src/app/api/einstellungen/export/route.ts` — Export entire workspace

## Naming Conventions

**Files:**
- Page components: `page.tsx` in feature directories
- Modal/form components: `*Modal.tsx`, `*Form.tsx`
- Layout components: `*Layout.tsx` or `Layout.tsx`
- Utility functions: camelCase `*.ts`
- API routes: Segment-based `[id]/route.ts`

**Directories:**
- Feature pages: `/src/app/[feature-name]/`
- Component feature groups: `/src/components/[feature-name]/`
- Data access layer: `/src/lib/`
- Domain types: `/src/types/[entity].ts`

**TypeScript:**
- Interfaces: `PascalCase` (e.g., `Profile`, `Trade`, `BotStatus`)
- Functions: `camelCase` (e.g., `getProfiles()`, `computeStats()`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `DATA_DIR`, `BOTS_CACHE_TTL_MS`)
- Type unions: `PascalCase` (e.g., `TradeDirection = 'long' | 'short'`)

**React Component Props:**
- Suffix pattern: `Props` interface (e.g., `interface SidebarProps { ... }`)
- Event handlers: `on*` (e.g., `onNav`, `onClick`)
- Render props: `render*` (e.g., `renderContent`)

## Where to Add New Code

**New Feature (e.g., "Risk Calculator"):**
- Page: `src/app/risiko-rechner/page.tsx`
- Components: `src/components/rechner/RiskoCalculator.tsx`
- Server logic: Add function to `src/lib/actions.ts` or new `src/lib/risk.ts`
- Types: Add interface to `src/types/trade.ts` or new `src/types/risk.ts`
- API endpoints: `src/app/api/risiko/route.ts` if needed

**New API Endpoint:**
- File: `src/app/api/[feature]/[sub]/route.ts`
- Pattern: Follow `src/app/api/bridge/command/route.ts`
- Validation: Check auth with `isSameOriginRequest()` or `isValidApiKey()`
- Logging: Use `addBridgeLogEntry()` for audit trail
- Errors: Return `NextResponse.json()` with proper status codes

**New Component:**
- File: `src/components/[feature]/[ComponentName].tsx`
- Client state: Use hooks, add to `src/context/` if global
- Server data: Pass as props from page component
- Styling: Use Tailwind CSS classes and CSS variables (e.g., `var(--accent)`)

**New Utility Function:**
- File: `src/lib/[entity].ts` or add to existing module
- Pattern: Match existing function signatures (e.g., `getX()`, `saveX()`)
- Caching: Use React's `cache()` helper if server-side data
- Atomicity: Always use `atomicWrite()` for file updates

**New Trade Statistic:**
- File: Add to `computeStats()` in `src/lib/data.ts`
- Return type: Add field to `TradeStats` interface in `src/types/trade.ts`
- Dashboard display: Add card to `src/app/dashboard/page.tsx`

## Special Directories

**`data/`:**
- Purpose: Runtime-generated JSON state
- Generated: Yes (first run copies from `seed/`)
- Committed: No (git-ignored)
- Location: `process.cwd() + '/data'` (project root)
- Files: Atomic writes with temp file pattern

**`seed/`:**
- Purpose: Demo data for new installations
- Generated: No (checked in)
- Committed: Yes
- Contents: Demo profiles, trades, strategies for test users

**`.next/`:**
- Purpose: Next.js build artifacts
- Generated: Yes (build time)
- Committed: No
- Managed by: Next.js automatically

**`public/`:**
- Purpose: Static assets served at root URL
- Generated: No (manual)
- Committed: Yes
- Paths: Icons → `/icons/`, logos → `/logo/`

**`.planning/codebase/`:**
- Purpose: Generated codebase analysis documents
- Generated: Yes (GSD mapping)
- Committed: Yes
- Files: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, STACK.md, INTEGRATIONS.md, CONCERNS.md

---

*Structure analysis: 2026-06-09*
