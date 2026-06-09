# Technology Stack

**Analysis Date:** 2026-06-09

## Languages

**Primary:**
- TypeScript 5 - Frontend (React), backend (API routes), types and utilities
- JavaScript - Node runtime for build scripts

**Secondary:**
- CSS/Tailwind - Styling (via Tailwind CSS 4 with PostCSS)

## Runtime

**Environment:**
- Node.js 20 Alpine (specified in Dockerfile)
- Production: Node.js 20 Alpine with multi-stage build

**Package Manager:**
- npm 10+ (package-lock.json v3 lockfile)
- Lockfile: present (`package-lock.json`)

## Frameworks

**Core:**
- Next.js 15.5.15 - Full-stack web framework
  - Location: Primary framework in `package.json`
  - App Router: Used for routing, API routes, and layouts
  - Server actions: Enabled with 10MB body size limit
  - Output: Standalone optimized for Docker deployment

**UI & Components:**
- React 19.1.0 - Component framework
- React DOM 19.1.0 - DOM rendering

**Styling:**
- Tailwind CSS 4 - Utility-first CSS framework
- @tailwindcss/postcss 4 - PostCSS plugin for Tailwind

**Animation:**
- Framer Motion 12.38.0 - Smooth animations and transitions

**Theming:**
- next-themes 0.4.6 - Dark/light mode support

**Testing:**
- Not detected

**Build/Dev:**
- TypeScript 5 - Type checking
- @types/node 20 - Node.js type definitions
- @types/react 19 - React type definitions
- @types/react-dom 19 - React DOM type definitions

## Key Dependencies

**Critical:**
- @anthropic-ai/sdk 0.92.0 - Claude AI integration for market analysis
  - Used in `/src/app/api/analyse/route.ts` for trading analysis
  - Why it matters: Core analysis engine powered by Claude

**UI Components:**
- lucide-react 1.11.0 - Icon library for UI elements
- recharts 3.8.1 - Charting library for performance visualization

**Utilities:**
- nanoid 5.1.9 - Generating unique IDs (trades, bots, etc.)
- html2canvas 1.4.1 - Screenshot generation for export
- jszip 3.10.1 - ZIP archive creation for export/import
- @types/jszip 3.4.0 - JSZip type definitions

## Configuration

**Environment:**
- Configuration via environment variables in `.env.local` (local) or Docker `env_file`
- Supported API keys:
  - `ANTHROPIC_API_KEY` - Claude API key for analysis
  - `BOT_API_KEY` - Secure bridge communication
- Environment files: `.env.local` present, `.env.example` provided (gitignored)

**Build:**
- `tsconfig.json` - TypeScript compilation (strict mode, ES2017 target)
  - Path alias: `@/*` maps to `./src/*`
- `next.config.ts` - Next.js configuration
  - Server actions with 10MB body limit
  - Package optimizations for lucide-react, recharts, framer-motion
  - Disabled dev indicators and powered-by header
  - Compression enabled
  - Standalone output for Docker

**PostCSS:**
- Tailwind CSS 4 integration via PostCSS (no explicit postcss.config.js, auto-configured)

## Platform Requirements

**Development:**
- Node.js 20+
- npm 10+
- Windows/Linux/macOS compatible

**Production:**
- Docker with Node.js 20 Alpine base image
- Port 3000 (configurable to 3002 in docker-compose.yml)
- Volume mount: `/app/data` for persistent data (profiles, bots, trades, logs)
- Health check: HTTP GET to `/` every 30s

## Docker Deployment

**Multi-stage build:**
1. `deps` stage: Install dependencies
2. `builder` stage: Build Next.js application
3. `runner` stage: Production-optimized runtime

**Image:**
- Base: `node:20-alpine`
- Working directory: `/app`
- Environment: `NODE_ENV=production`, `PORT=3000`, `HOSTNAME=0.0.0.0`
- Entrypoint: `/docker-entrypoint.sh` (custom startup script)
- Exposed: Port 3000

**Docker Compose (development):**
- Service: `alphatrack`
- Port mapping: `3002:3000`
- Restart policy: `unless-stopped`
- Health check: 30s interval, 10s timeout, 3 retries

---

*Stack analysis: 2026-06-09*
