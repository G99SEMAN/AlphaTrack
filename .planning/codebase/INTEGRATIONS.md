# External Integrations

**Analysis Date:** 2026-06-09

## APIs & External Services

**AI Analysis:**
- Anthropic Claude API - Market analysis and trading recommendations
  - SDK: `@anthropic-ai/sdk` 0.92.0
  - Auth: `ANTHROPIC_API_KEY` environment variable
  - Endpoint: `/src/app/api/analyse/route.ts`
  - Purpose: Analyzes OHLC candle data and provides trading bias, entry zones, stop loss, take profit levels

**Market Data:**
- Tradays Economic Calendar API - Forex economic events calendar
  - Endpoint: `https://www.tradays.com/de/economic-calendar/widget/content`
  - Headers: `X-Requested-With: XMLHttpRequest`, `Referer` set to tradays.com
  - Caching: 30 minutes (Next.js `revalidate: 1800`)
  - Location: `/src/lib/wirtschaftskalender.ts`
  - Purpose: Fetches economic calendar events for USD, EUR, GBP, JPY, CHF, AUD, CAD, NZD

**News Feeds (RSS):**
- Reuters Business News - `https://feeds.reuters.com/reuters/businessNews`
- MarketWatch - `https://feeds.marketwatch.com/marketwatch/topstories/`
- Yahoo Finance - `https://finance.yahoo.com/news/rssindex`
- CNBC - `https://search.cnbc.com/rs/search/combinedcsearch.xml?partnerId=wrss01&id=10000664`
  - Caching: 15 minutes (Next.js `revalidate: 900`)
  - Location: `/src/lib/news.ts`
  - Purpose: Financial news aggregation with categorization (monetary-policy, earnings, geopolitical, commodities, crypto)
  - Timeout: 7 seconds per feed

## Data Storage

**Databases:**
- Not detected - No external database provider used

**File Storage:**
- Local filesystem only
  - Data directory: `/data` (mounted as volume in Docker)
  - Persistent files:
    - `bots.json` - Bot registry
    - `profiles.json` - Trading profiles
    - `active.json` - Active profile tracking
    - `bot-status-{botId}.json` - Bot connection status
    - `bot-log-{botId}.json` - Bot logs (max 100 entries per bot)
    - `bot-commands-{botId}.json` - Pending bot commands
    - `bot-trades-{profileId}.json` - Trades executed by bots
    - `trades-{profileId}.json` - Manual profile trades
    - `strategies-{profileId}.json` - Trading strategies per profile
    - `api-keys.json` - Persisted API keys (imported from NAS)
    - `analyse-history.json` - Market analysis history
    - `bot-events-{botId}.json` - Bot events

**File Upload/Handling:**
- Screenshots stored in `/data/screenshots/` directory
  - Generated via html2canvas for export
  - Served via API route: `/api/screenshots/[filename]/route.ts`
- Export/Import via ZIP archives (jszip)
  - Location: `/src/app/api/einstellungen/export/route.ts` and `/src/app/api/einstellungen/import/route.ts`

**Caching:**
- In-memory caching for bot data (5-second TTL for bot list, 2-second for bot status)
- Next.js cache for API results (revalidate parameter on fetch)
- No external cache service

## Authentication & Identity

**Auth Provider:**
- Custom implementation (API key-based)

**Authentication Approach:**
- Bridge/Bot communication:
  - Header-based API key validation: `x-bot-api-key`
  - Location: `/src/lib/auth.ts`
  - Function: `isValidApiKey()` - timing-safe comparison using Node.js crypto
  - Key storage: `BOT_API_KEY` environment variable
  
- API key management:
  - Allowed keys: `ANTHROPIC_API_KEY`, `BOT_API_KEY`
  - Source: Priority to environment variables, fallback to `/data/api-keys.json`
  - Location: `/src/lib/api-keys.ts`
  - Safe reload: 30-second cache TTL

- Same-origin validation:
  - Function: `isSameOriginRequest()` - validates `Origin` header matches `Host`
  - Used for bridge command routes
  - Location: `/src/lib/auth.ts`

## Monitoring & Observability

**Error Tracking:**
- Not detected

**Logs:**
- File-based logging
  - Location: `/data/bot-log-{botId}.json` (JSON log entries)
  - Bridge logs: `/data/bot-log-bridge.json`
  - Max 100 entries per log file (older entries pruned)
  - Log entry format: `{ timestamp, message, level }`
  - Location code: `/src/lib/bot-data.ts` - `addBridgeLogEntry()`, `getBridgeLog()`

**Monitoring:**
- Heartbeat-based connection tracking
  - Threshold: 45 seconds = "connected", 120 seconds = "warning", >120 seconds = "offline"
  - Location: `/src/lib/bot-data.ts` - `getConnectionState()`

## CI/CD & Deployment

**Hosting:**
- Docker-based (self-hosted or Docker Compose)
- Docker image: Node.js 20 Alpine multi-stage build
- Port: 3000 (exposed as 3002 in docker-compose.yml)

**CI Pipeline:**
- Not detected - No GitHub Actions or external CI configured

**Build Commands:**
```bash
npm run dev    # Development server
npm run build  # Next.js build
npm start      # Production server
```

## Environment Configuration

**Required env vars:**
- `ANTHROPIC_API_KEY` - Claude API key (required for market analysis)
- `BOT_API_KEY` - Security token for bot/bridge communication (optional but recommended)

**Optional env vars:**
- `NODE_ENV` - Set to `production` in Docker
- `PORT` - Server port (default 3000)
- `HOSTNAME` - Server hostname (default `0.0.0.0`)

**Secrets location:**
- `.env.local` - Local development secrets (gitignored)
- `data/api-keys.json` - Persistent API keys (gitignored, imported from NAS/export)
- Environment file passed to Docker via `env_file: .env.local` in docker-compose.yml

## Webhooks & Callbacks

**Incoming:**
- None detected - No external webhook receivers configured

**Outgoing:**
- None detected - No external webhooks triggered

**Bridge Protocol:**
- Internal HTTP endpoints (bot ↔ bridge communication)
  - Discovery: `/bridge/discover/route.ts` - Scans local network for bridges
  - Heartbeat: `/bridge/heartbeat/route.ts` - Bot status tracking
  - Commands: `/bridge/command/route.ts` - Trade execution requests
  - Config: `/bridge/config/route.ts` - Bot configuration
  - Trades: `/bridge/trades/route.ts` - Trade synchronization
  - Candles: `/candles` endpoint (on bot/bridge server) - OHLC data for analysis

## Data Flow

**Trade Execution:**
1. User initiates trade via UI
2. Request sent to `/api/bridge/command`
3. Route forwards to bot bridge at `${bot.url}/command`
4. Response logged and stored locally
5. Trades synchronized via `/api/bridge/trades`

**Market Analysis:**
1. User selects currency pair and timeframe
2. Request to `/api/analyse`
3. Fetches candles from bot/bridge at `${bot.url}/candles`
4. Sends OHLC data to Claude API for analysis
5. Returns trading bias, entry/exit levels
6. Results cached in `analyse-history.json`

**Economic Calendar:**
1. `/api/wirtschaftskalender` requested
2. Attempts to fetch from connected bridge `/calendar`
3. Fallback: Fetches from Tradays API
4. Events filtered for forex-relevant currencies
5. Cached for 30 minutes

---

*Integration audit: 2026-06-09*
