# Coding Conventions

**Analysis Date:** 2026-06-09

## Naming Patterns

**Files:**
- React components: PascalCase (`ProfileSetupForm.tsx`, `WinRateCard.tsx`, `TradeRow.tsx`)
- Utility/library files: camelCase (`actions.ts`, `profiles.ts`, `strategies.ts`)
- API routes: match Next.js pattern (`route.ts` in `app/api/[path]/`)
- Parser files: camelCase describing what they parse (`mt5.ts`, `api-keys.ts`)
- Hook files: usePrefix pattern (`useAccentTheme.ts`, `useTradingLock()` exported from context)
- Type definition files: singular noun (`profile.ts`, `trade.ts`, `strategy.ts`, `news.ts`)

**Functions:**
- Server actions: camelCase with `Action` suffix (`createProfileAction()`, `deleteTradeAction()`, `switchProfileAction()`)
- Regular functions: camelCase (`getProfiles()`, `createProfile()`, `updateProfile()`, `parseMT5Html()`)
- React hooks: usePrefix camelCase (`useAccentTheme()`, `useTradingLock()`)
- Component render functions: PascalCase (React components)
- Helper functions: camelCase, internal to module when possible
- Event handlers: `handleX` pattern (`handleCreateProfile()`, `handleDelete()`, `handleImportFile4()`)

**Variables:**
- State: camelCase (`isUnlocked`, `isLong`, `pnlPositive`, `hasPnl`)
- Constants: UPPER_SNAKE_CASE (`STORAGE_KEY`, `DATA_DIR`, `ALLOWED_IMAGE_EXTS`, `PROFILE_COLORS`)
- Storage keys: camelCase with suffix indicating type (`alphatrack-accent-theme`, `alphatrack-trading-unlocked`)
- Boolean flags: `is*`, `has*`, `should*` prefix (`isUnlocked`, `hasPnl`, `shouldRender`)

**Types:**
- Type aliases: PascalCase (`TradeDirection`, `TradeStatus`, `ProfileType`, `Currency`, `AccentTheme`)
- Interfaces: PascalCase with optional `I` prefix (not used consistently in codebase; prefer without prefix) (`Profile`, `Trade`, `Strategy`, `Deposit`)
- Generic type parameters: single uppercase letters (`Props` for component props)

## Code Style

**Formatting:**
- No formal linter/prettier configured (none found in package.json or config files)
- 2-space indentation observed throughout
- Semicolons used consistently
- Single quotes for strings (`'use client'`, `'utf-8'`)
- Template literals for dynamic strings (`` `${var}` ``)
- Trailing commas in multi-line objects/arrays observed

**Linting:**
- No ESLint or Prettier detected in configuration
- No pre-commit hooks defined
- TypeScript strict mode enabled (`"strict": true` in `tsconfig.json`)
- TypeScript targets ES2017 with `noEmit: true` (type-checking only)

## Import Organization

**Order:**
1. External libraries (Next.js, React, third-party packages)
2. Internal types (`@/types/*`)
3. Internal utilities/libraries (`@/lib/*`)
4. Internal components (`@/components/*`)
5. Internal context (`@/context/*`)
6. Node.js built-ins (fs, path) — used in server code

**Path Aliases:**
- `@/*` maps to `./src/*` (configured in `tsconfig.json`)
- All imports from src use `@/` prefix (no relative paths from src)
- Components and utilities discovered via `@/` alias consistently

**Example from `src/lib/actions.ts`:**
```typescript
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { nanoid } from 'nanoid'
import fs from 'fs'
import path from 'path'
import { Profile, Deposit } from '@/types/profile'
import { Trade } from '@/types/trade'
import { Strategy, Timeframe } from '@/types/strategy'
import { createProfile, updateProfile } from '@/lib/profiles'
```

## Error Handling

**Patterns:**
- Try-catch blocks with error logging to console
- Console.error() for errors: `console.error('[Context] Error:', err)`
- Console.warn() for warnings: `console.warn('[Kalender] ANTHROPIC_API_KEY fehlt')`
- Tagged logs with module name in brackets: `[AlphaTrack]`, `[Kalender]`, `[Context]`
- Silent catch blocks when error can be ignored: `try { fs.unlinkSync() } catch { /* ignorieren */ }`
- Error messages returned in NextResponse.json() for API routes
- Confirmation dialogs before destructive actions: `if (!confirm(...)) return`

**Error Message Style:**
- German error messages: `'Profil konnte nicht gespeichert werden. Bitte versuche es erneut.'`
- Includes context in error logs: `'[Kalender] Claude API Fehler:', e`
- Type checking in error handlers: `e instanceof Error ? e.message : String(e)`

**Examples:**
```typescript
// From src/app/api/wirtschaftskalender/erklaerung/route.ts
try {
  const explanation = await fetchFromClaude(title, country)
  cache[title] = explanation
  saveCache(cache)
  return NextResponse.json({ explanation, source: 'ai' })
} catch (e) {
  console.error('[Kalender] Claude API Fehler:', e)
  const msg = e instanceof Error ? e.message : String(e)
  return NextResponse.json({ explanation: null, error: `API-Fehler: ${msg}` })
}

// Silent failure
try { fs.unlinkSync(tradeFile) } catch { /* ignorieren */ }
```

## Logging

**Framework:** Native `console` (no logging library)

**Patterns:**
- `console.error()` for unexpected errors with context prefix: `console.error('[ModuleName]', message, error)`
- `console.warn()` for non-fatal issues: `console.warn('[ModuleName]', message)`
- No debug logs in production code (performance-critical sections avoid logging)
- Errors logged at the point of catch, not propagated up the call stack
- Error context includes module name in brackets for filtering

**Observed Usage:**
- `console.error('Analyse-Fehler:', err)` in route handlers
- `console.error('Export-Fehler:', err)` in export/import operations
- `console.error('[AlphaTrack] Screenshot löschen fehlgeschlagen:', err)` in file operations
- `console.warn('[Kalender] ANTHROPIC_API_KEY fehlt')` for missing config

## Comments

**When to Comment:**
- Code is self-documenting (type annotations, clear function/variable names)
- No JSDoc comments found in codebase — methods are short and intent is clear
- Comments used sparingly for non-obvious logic
- Section separators used in large files: `// --- Profile Actions ---`
- German comments mixed with code (language of interface is German, code comments follow)

**JSDoc/TSDoc:**
- Not used — codebase relies on TypeScript types for documentation
- Function parameters and returns are typed directly
- React component props documented via interface definitions

## Function Design

**Size:**
- Largest functions: 842 lines (`ProfileSetupForm.tsx` component)
- Typical utility function: 30-100 lines
- API routes: 5-20 lines (very lightweight)
- Components: 50-300 lines for complex components, 10-50 for simple ones
- Exceeding 500 lines should be refactored

**Parameters:**
- Props interface pattern for components: `interface Props { ... }`
- Named parameters preferred over positional for functions with >2 args
- FormData used for form submissions (Next.js Server Actions pattern)
- Destructuring in function signatures: `function Component({ children, className }: Props)`

**Return Values:**
- Components return JSX (React.ReactNode)
- Server actions return void or use redirect()/revalidatePath()
- API routes return NextResponse.json()
- Utility functions return typed values (arrays, objects, primitives)
- Optional fields use `?:` in types, return null/undefined when not found
- Arrays return empty array `[]` when no data (not null)

**Example from `src/lib/profiles.ts`:**
```typescript
export const getProfiles = cache(function getProfiles(): Profile[] {
  try {
    const raw = fs.readFileSync(PROFILES_FILE, 'utf-8')
    return JSON.parse(raw) as Profile[]
  } catch {
    return []  // Empty array on error, not null
  }
})

export function updateProfile(updated: Profile): void {
  const profiles = getProfiles().map(p => p.id === updated.id ? updated : p)
  saveProfiles(profiles)
}
```

## Module Design

**Exports:**
- Named exports for utility functions: `export function getProfiles()`
- Default export for React components: `export default function Component()`
- Multiple context hooks exported from context modules: `export function useTradingLock() { ... }`
- Type exports at top of file: `export type TradeDirection = 'long' | 'short'`
- Constants exported for reuse: `export const PROFILE_COLORS = [...]`

**Barrel Files:**
- Not used — imports are direct from source files
- Each component in its own file with `export default`
- Types imported individually from type files

**Module Organization:**
- `src/lib/*` — utility, data persistence, calculations (no React)
- `src/types/*` — TypeScript interfaces and type definitions
- `src/components/*` — React components organized by feature
- `src/context/*` — Context providers and custom hooks
- `src/hooks/*` — Standalone custom hooks
- `src/app/*` — Next.js App Router pages and API routes

---

*Convention analysis: 2026-06-09*
