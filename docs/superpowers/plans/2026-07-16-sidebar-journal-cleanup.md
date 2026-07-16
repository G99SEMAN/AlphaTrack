# Sidebar-Umbau + Journal-Aufräumung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sidebar-Navigation neu sortieren, das Journal-Filter-UI aufräumen (Status-Filter reduzieren, Bot-Filter hinzufügen), Bot-Tag-Farben konsistent machen und das veraltete Bot-Import-Feature entfernen.

**Architecture:** Reine Client-Component-Änderungen in `src/components/layout/Sidebar.tsx` und `src/components/journal/*`, eine neue kleine Client-Component `BotFilterDropdown.tsx`, eine kleine Server-Component-Anpassung in `src/app/journal/page.tsx`, plus Entfernen einer verwaisten Server Action aus `src/lib/actions.ts`. Keine Datenmodell- oder API-Änderungen.

**Tech Stack:** Next.js 15 App Router, React Client Components, TypeScript, lucide-react Icons, kein CSS-Framework (inline `style`-Objekte + Tailwind-Utilities für Layout, wie im Rest der Codebase üblich).

## Global Constraints

- Es gibt **keine automatisierten Tests** in diesem Projekt (kein Jest/Vitest/Playwright-Testsuite). Verifikation läuft über: (1) den automatischen TypeScript-Check-Hook (`npx tsc --noEmit`, läuft nach jedem Edit/Write an `.ts`/`.tsx`-Dateien), (2) manuelle Browser-Verifikation über den `run-alphatrack`-Skill (`.claude/skills/run-alphatrack/driver.mjs`). Jeder Task ersetzt den üblichen "Write failing test"-Schritt durch einen konkreten Browser-Verifikationsschritt.
- Alle UI-Texte auf Deutsch, konsistent mit bestehender Codebase.
- Farb-/Style-Konventionen exakt aus bestehenden Komponenten übernehmen (siehe `src/components/dashboard/DayModal.tsx` für Bot-Farb-Badges, `src/components/dashboard/DateRangePicker.tsx` für Dropdown-Pattern mit Outside-Click-Handling).
- Der Dev-Server läuft für die Browser-Verifikation bereits lokal auf `http://localhost:3000` (Standard-Annahme des `run-alphatrack`-Skills). Falls nicht: `driver.mjs` wie in dessen `SKILL.md` beschrieben selbst starten.
- Spec-Referenz: `docs/superpowers/specs/2026-07-16-sidebar-journal-cleanup-design.md`

---

### Task 1: Sidebar-Navigation neu sortieren

**Files:**
- Modify: `src/components/layout/Sidebar.tsx:20-37`

**Interfaces:**
- Keine neuen Interfaces. Reine Neusortierung zweier bestehender `const`-Arrays (`UEBERSICHT_NAV`, `BRIDGE_BOTS_NAV`), Struktur (`{ href, label, icon }`) bleibt unverändert. Alle referenzierten Icons (`Activity`, `Target`, `Sparkles`, `BarChart2`, etc.) sind bereits im bestehenden Import-Block (Zeilen 5-10) importiert.

- [ ] **Step 1: Nav-Arrays neu sortieren**

In `src/components/layout/Sidebar.tsx`, ersetze:

```tsx
const UEBERSICHT_NAV = [
  { href: '/dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/journal',     label: 'Trades',       icon: BookOpen },
  { href: '/statistiken', label: 'Statistiken',  icon: BarChart2 },
  { href: '/kalender',    label: 'Kalender',     icon: CalendarDays },
  { href: '/netzwerk',    label: 'Netzwerk',     icon: Network },
]

const BRIDGE_BOTS_NAV = [
  { href: '/bridge',            label: 'Bridge',        icon: Cpu },
  { href: '/bridge/log',        label: 'Bridge Log',    icon: ScrollText },
  { href: '/bots',              label: 'Bots',          icon: Bot },
  { href: '/bots/settings',     label: 'Bot Settings',  icon: SlidersHorizontal },
  { href: '/strategien',        label: 'Strategien',    icon: Target },
  { href: '/bots/performance',  label: 'Performance',   icon: BarChart2 },
  { href: '/bridge/trades',     label: 'Live Trades',   icon: Activity },
  { href: '/bridge/analyse',    label: 'Trade Analyzer',icon: Sparkles },
]
```

durch:

```tsx
const UEBERSICHT_NAV = [
  { href: '/dashboard',      label: 'Dashboard',      icon: LayoutDashboard },
  { href: '/journal',        label: 'Trades',         icon: BookOpen },
  { href: '/bridge/trades',  label: 'Live Trades',    icon: Activity },
  { href: '/strategien',     label: 'Strategien',     icon: Target },
  { href: '/bridge/analyse', label: 'Trade Analyzer', icon: Sparkles },
  { href: '/statistiken',    label: 'Statistiken',    icon: BarChart2 },
  { href: '/kalender',       label: 'Kalender',       icon: CalendarDays },
  { href: '/netzwerk',       label: 'Netzwerk',       icon: Network },
]

const BRIDGE_BOTS_NAV = [
  { href: '/bridge',            label: 'Bridge',        icon: Cpu },
  { href: '/bridge/log',        label: 'Bridge Log',    icon: ScrollText },
  { href: '/bots',              label: 'Bots',          icon: Bot },
  { href: '/bots/settings',     label: 'Bot Settings',  icon: SlidersHorizontal },
  { href: '/bots/performance',  label: 'Performance',   icon: BarChart2 },
]
```

- [ ] **Step 2: TypeScript-Check abwarten**

Der automatische Hook läuft nach dem Edit. Erwartet: keine Fehler (reine Array-Neusortierung, keine Typänderung).

- [ ] **Step 3: Browser-Verifikation**

```powershell
node ".claude\skills\run-alphatrack\driver.mjs" screenshot sidebar-check.png /dashboard
```

Mit `Read` ansehen. Erwartet: Sidebar zeigt unter "Übersicht" die Reihenfolge Dashboard, Trades, Live Trades, Strategien, Trade Analyzer, Statistiken, Kalender, Netzwerk; unter "Bridge & Bots" nur noch Bridge, Bridge Log, Bots, Bot Settings, Performance.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "refactor: Live Trades, Strategien und Trade Analyzer in Übersicht-Sektion verschieben"
```

---

### Task 2: Bot-Import-Feature entfernen

**Files:**
- Delete: `src/components/journal/BotImportModal.tsx`
- Modify: `src/components/journal/JournalClient.tsx` (Imports, Props, State, Action-Buttons, Modals)
- Modify: `src/app/journal/page.tsx:35-43` (kein `profiles`-Prop mehr an `JournalClient`)
- Modify: `src/lib/actions.ts:383-411` (verwaiste `importBotTradesAction` entfernen)

**Interfaces:**
- `JournalClient`-Props verlieren `profiles?: Profile[]` (war ausschließlich für `BotImportModal` da, sonst nirgends in der Komponente referenziert — verifiziert per Grep).
- Keine anderen Komponenten importieren `BotImportModal` oder `importBotTradesAction` (verifiziert: einzige Referenzen sind `BotImportModal.tsx` selbst und dessen Nutzung in `JournalClient.tsx`).

- [ ] **Step 1: BotImportModal.tsx löschen**

```bash
git rm src/components/journal/BotImportModal.tsx
```

- [ ] **Step 2: Imports in JournalClient.tsx bereinigen**

Ersetze:

```tsx
import { Plus, Search, SlidersHorizontal, TrendingUp, TrendingDown, BookOpen, Upload, Bot } from 'lucide-react'
import { Trade } from '@/types/trade'
import { Strategy } from '@/types/strategy'
import { Profile } from '@/types/profile'
import { BotEntry } from '@/types/bot'
import { resolveBotLabel } from '@/lib/bot-source'
import TradeRow from './TradeRow'
import TradeModal from './TradeModal'
import ImportModal from './ImportModal'
import BotImportModal from './BotImportModal'
```

durch:

```tsx
import { Plus, Search, SlidersHorizontal, TrendingUp, TrendingDown, BookOpen, Upload } from 'lucide-react'
import { Trade } from '@/types/trade'
import { Strategy } from '@/types/strategy'
import { BotEntry } from '@/types/bot'
import { resolveBotLabel } from '@/lib/bot-source'
import TradeRow from './TradeRow'
import TradeModal from './TradeModal'
import ImportModal from './ImportModal'
```

- [ ] **Step 3: Props-Interface und Destructure bereinigen**

Ersetze:

```tsx
interface Props {
  trades: Trade[]
  strategies: Strategy[]
  currency: string
  startCapital: number
  broker?: string
  profiles?: Profile[]
  bots?: BotEntry[]
}
```

durch:

```tsx
interface Props {
  trades: Trade[]
  strategies: Strategy[]
  currency: string
  startCapital: number
  broker?: string
  bots?: BotEntry[]
}
```

Ersetze:

```tsx
export default function JournalClient({ trades: initialTrades, strategies, currency, startCapital, broker, profiles = [], bots = [] }: Props) {
  const [trades, setTrades] = useState<Trade[]>(initialTrades)
  const [showModal, setShowModal] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showBotImport, setShowBotImport] = useState(false)
  const [search, setSearch] = useState('')
```

durch:

```tsx
export default function JournalClient({ trades: initialTrades, strategies, currency, startCapital, broker, bots = [] }: Props) {
  const [trades, setTrades] = useState<Trade[]>(initialTrades)
  const [showModal, setShowModal] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [search, setSearch] = useState('')
```

- [ ] **Step 4: "Via Bot"-Button entfernen**

Ersetze:

```tsx
            {/* Action-Buttons rechtsbündig */}
            <div className="flex items-center gap-1.5 ml-auto">
              {bots.length > 0 && (
                <button
                  onClick={() => setShowBotImport(true)}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                  style={{
                    background: 'rgba(59,130,246,0.08)',
                    color: '#3b82f6',
                    border: '1px solid rgba(59,130,246,0.3)',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(59,130,246,0.15)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(59,130,246,0.08)' }}
                >
                  <Bot size={13} />
                  <span className="hidden sm:inline">Via Bot</span>
                </button>
              )}
              <button
                onClick={() => setShowImport(true)}
```

durch:

```tsx
            {/* Action-Buttons rechtsbündig */}
            <div className="flex items-center gap-1.5 ml-auto">
              <button
                onClick={() => setShowImport(true)}
```

- [ ] **Step 5: BotImportModal-Rendering entfernen**

Ersetze:

```tsx
      <AnimatePresence>
        {showImport && (
          <ImportModal
            onClose={() => { setShowImport(false); void fetchTrades() }}
            existingExternalIds={new Set(trades.map(t => t.externalId).filter(Boolean) as string[])}
            profileStartCapital={startCapital}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showBotImport && bots.length > 0 && (
          <BotImportModal
            bots={bots}
            profiles={profiles}
            existingExternalIdsByProfile={Object.fromEntries(
              profiles.map(p => [p.id, new Set(trades.map(t => t.externalId).filter(Boolean) as string[])])
            )}
            onClose={() => { setShowBotImport(false); void fetchTrades() }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
```

durch:

```tsx
      <AnimatePresence>
        {showImport && (
          <ImportModal
            onClose={() => { setShowImport(false); void fetchTrades() }}
            existingExternalIds={new Set(trades.map(t => t.externalId).filter(Boolean) as string[])}
            profileStartCapital={startCapital}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
```

- [ ] **Step 6: `profiles`-Prop aus der Journal-Page entfernen**

In `src/app/journal/page.tsx`, ersetze:

```tsx
        <JournalClient
          trades={trades}
          strategies={strategies}
          currency={activeProfile.currency}
          startCapital={activeProfile.startCapital}
          broker={activeProfile.broker}
          profiles={profiles}
          bots={bots}
        />
```

durch:

```tsx
        <JournalClient
          trades={trades}
          strategies={strategies}
          currency={activeProfile.currency}
          startCapital={activeProfile.startCapital}
          broker={activeProfile.broker}
          bots={bots}
        />
```

(`profiles` bleibt als Variable erhalten, da `<Sidebar profiles={profiles} .../>` sie weiterhin braucht.)

- [ ] **Step 7: Verwaiste Server Action entfernen**

In `src/lib/actions.ts`, ersetze:

```tsx
export async function importBotTradesAction(
  profileId: string,
  incoming: Omit<Trade, 'id'>[],
  newStartCapital?: number,
): Promise<{ imported: number; skipped: number }> {
  const profiles = getProfiles()
  const profile = profiles.find(p => p.id === profileId)
  if (!profile) return { imported: 0, skipped: 0 }

  if (newStartCapital !== undefined && newStartCapital !== profile.startCapital) {
    updateProfile({ ...profile, startCapital: newStartCapital })
  }

  const existing = getProfileTrades(profileId)
  const existingExternalIds = new Set(
    existing.map(t => t.externalId).filter(Boolean)
  )

  const toAdd = incoming.filter(
    t => !t.externalId || !existingExternalIds.has(t.externalId)
  )

  const withIds: Trade[] = toAdd.map(t => ({ ...t, id: nanoid(10) }))
  saveProfileTrades(profileId, [...existing, ...withIds])
  revalidatePath('/journal')
  revalidatePath('/dashboard')

  return { imported: withIds.length, skipped: incoming.length - withIds.length }
}

export async function importBridgeHistoryAction(): Promise<
```

durch:

```tsx
export async function importBridgeHistoryAction(): Promise<
```

- [ ] **Step 8: TypeScript-Check abwarten**

Automatischer Hook läuft nach jedem Edit. Erwartet: keine Fehler. Falls `getProfiles`/`updateProfile` in `actions.ts` jetzt unbenutzt sind, wird `tsc --noEmit` das NICHT als Fehler melden (kein `noUnusedLocals` in `tsconfig.json`) — trotzdem kurz per Grep prüfen:

```bash
grep -n "getProfiles\|updateProfile" src/lib/actions.ts | head -20
```

Falls beide Funktionen noch an anderer Stelle in der Datei verwendet werden (erwartet, da `actions.ts` viele Server Actions bündelt), keine weitere Änderung nötig.

- [ ] **Step 9: Browser-Verifikation**

```powershell
node ".claude\skills\run-alphatrack\driver.mjs" screenshot journal-check.png /journal
```

Mit `Read` ansehen. Erwartet: kein "Via Bot"-Button mehr in der Toolbar, regulärer "Import"-Button weiterhin vorhanden, Seite lädt ohne Fehler.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor: Bot-Import-Feature entfernen (Trades werden automatisch per Bridge synchronisiert)"
```

---

### Task 3: Status-Filter auf "Alle" / "Abgebrochen" reduzieren

**Files:**
- Modify: `src/components/journal/JournalClient.tsx` (Status-Filter-Button-Zeile)

**Interfaces:**
- `FilterStatus` Union-Type bleibt unverändert (`'all' | 'open' | 'closed' | 'cancelled'`) — nur die gerenderten Buttons werden reduziert. Kein Einfluss auf die Filterlogik in `filtered` (dort bleibt `if (filterStatus !== 'all' && t.status !== filterStatus) return false` unverändert, da `filterStatus` durch die UI ohnehin nie mehr auf `'open'`/`'closed'` gesetzt werden kann).

- [ ] **Step 1: Button-Array reduzieren**

Ersetze:

```tsx
            {/* Status-Filter */}
            {(['all', 'open', 'closed', 'cancelled'] as FilterStatus[]).map(s => (
              <button
                key={s}
                onClick={() => { setFilterStatus(s); resetPage() }}
                className="px-2 py-1 rounded-md text-xs font-medium cursor-pointer transition-all"
                style={{
                  background: filterStatus === s ? 'var(--accent-bg)' : 'transparent',
                  color: filterStatus === s ? 'var(--accent)' : 'var(--text-3)',
                  border: `1px solid ${filterStatus === s ? 'var(--accent)' : 'transparent'}`,
                }}
              >
                {s === 'all' ? 'Alle' : s === 'open' ? 'Offen' : s === 'closed' ? 'Geschl.' : 'Abgebr.'}
              </button>
            ))}
```

durch:

```tsx
            {/* Status-Filter */}
            {(['all', 'cancelled'] as FilterStatus[]).map(s => (
              <button
                key={s}
                onClick={() => { setFilterStatus(s); resetPage() }}
                className="px-2 py-1 rounded-md text-xs font-medium cursor-pointer transition-all"
                style={{
                  background: filterStatus === s ? 'var(--accent-bg)' : 'transparent',
                  color: filterStatus === s ? 'var(--accent)' : 'var(--text-3)',
                  border: `1px solid ${filterStatus === s ? 'var(--accent)' : 'transparent'}`,
                }}
              >
                {s === 'all' ? 'Alle' : 'Abgebr.'}
              </button>
            ))}
```

- [ ] **Step 2: TypeScript-Check abwarten**

Erwartet: keine Fehler.

- [ ] **Step 3: Browser-Verifikation**

```powershell
node ".claude\skills\run-alphatrack\driver.mjs" screenshot status-filter-check.png /journal
```

Mit `Read` ansehen. Erwartet: Status-Filterzeile zeigt nur noch "Alle" und "Abgebr.", keine "Offen"/"Geschl."-Buttons mehr. Bestehende offene/geschlossene Trades sind weiterhin über "Alle" sichtbar und weiterhin am Status-Badge in der Tabelle erkennbar.

- [ ] **Step 4: Commit**

```bash
git add src/components/journal/JournalClient.tsx
git commit -m "refactor: Status-Filter im Journal auf Alle/Abgebrochen reduzieren"
```

---

### Task 4: Bot-Tag-Farben im Journal konsistent machen

**Files:**
- Modify: `src/app/journal/page.tsx:19` (Bot-Liste auf `type === 'bot'` filtern)
- Modify: `src/components/journal/JournalClient.tsx` (Import + `resolveSourceColor`-Helper + Prop-Übergabe an `TradeRow`)
- Modify: `src/components/journal/TradeRow.tsx` (`botColor`-Prop, Badge-Styling)

**Interfaces:**
- `getBotColor(botId: string | null | undefined, bots: BotEntry[]): string` aus `src/lib/bot-colors.ts` (bereits vorhanden, unverändert) — gibt bei fehlender `botId` `'#6b7280'` zurück, sonst eine Farbe aus `BOT_COLORS` basierend auf dem Index von `botId` in `bots`.
- `TradeRow` bekommt einen neuen Pflicht-Prop `botColor: string` (Konsument: JournalClient berechnet ihn über `resolveSourceColor(trade)` und übergibt ihn).
- Damit der Farb-Index für denselben Bot überall gleich ist, muss die an `JournalClient` übergebene `bots`-Liste exakt dieselbe Quelle/Reihenfolge wie in `src/app/dashboard/page.tsx` und `src/app/bridge/trades/page.tsx` verwenden: `getAllBotsWithStatus().map(({ bot }) => bot).filter(bot => bot.type === 'bot')`. `getAllBotsWithStatus()` iteriert intern über `getBots()` in derselben Reihenfolge, daher ist ein einfaches `getBots().filter(bot => bot.type === 'bot')` in `journal/page.tsx` ausreichend und index-äquivalent zu den anderen Seiten.

- [ ] **Step 1: Bot-Liste in journal/page.tsx filtern**

In `src/app/journal/page.tsx`, ersetze:

```tsx
  const bots = getBots()
```

durch:

```tsx
  const bots = getBots().filter(bot => bot.type === 'bot')
```

- [ ] **Step 2: `getBotColor`-Import und `resolveSourceColor`-Helper in JournalClient.tsx ergänzen**

Ersetze:

```tsx
import { resolveBotLabel } from '@/lib/bot-source'
import TradeRow from './TradeRow'
```

durch:

```tsx
import { resolveBotLabel } from '@/lib/bot-source'
import { getBotColor } from '@/lib/bot-colors'
import TradeRow from './TradeRow'
```

Ersetze:

```tsx
  function resolveSourceLabel(trade: Trade): string | undefined {
    return resolveBotLabel(trade.sourceId, bots)
  }
```

durch:

```tsx
  function resolveSourceLabel(trade: Trade): string | undefined {
    return resolveBotLabel(trade.sourceId, bots)
  }

  function resolveSourceColor(trade: Trade): string {
    return getBotColor(trade.botId, bots)
  }
```

- [ ] **Step 3: `botColor`-Prop an TradeRow übergeben**

Ersetze:

```tsx
            {paginated.map(trade => (
              <TradeRow key={trade.id} trade={trade} strategies={strategies} broker={broker} currency={currency} startCapital={startCapital} onRefresh={fetchTrades} sourceLabel={resolveSourceLabel(trade)} />
            ))}
```

durch:

```tsx
            {paginated.map(trade => (
              <TradeRow key={trade.id} trade={trade} strategies={strategies} broker={broker} currency={currency} startCapital={startCapital} onRefresh={fetchTrades} sourceLabel={resolveSourceLabel(trade)} botColor={resolveSourceColor(trade)} />
            ))}
```

- [ ] **Step 4: TradeRow.tsx Props-Interface erweitern**

Ersetze:

```tsx
interface Props {
  trade: Trade
  strategies: Strategy[]
  broker?: string
  currency?: string
  startCapital?: number
  onRefresh?: () => void
  sourceLabel?: string
}
```

durch:

```tsx
interface Props {
  trade: Trade
  strategies: Strategy[]
  broker?: string
  currency?: string
  startCapital?: number
  onRefresh?: () => void
  sourceLabel?: string
  botColor: string
}
```

- [ ] **Step 5: Funktionssignatur und Badge-Styling in TradeRow.tsx anpassen**

Ersetze:

```tsx
export default function TradeRow({ trade, strategies, broker, currency, startCapital, onRefresh, sourceLabel }: Props) {
```

durch:

```tsx
export default function TradeRow({ trade, strategies, broker, currency, startCapital, onRefresh, sourceLabel, botColor }: Props) {
```

Ersetze:

```tsx
            {sourceLabel && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold shrink-0 max-w-32 truncate"
                style={{ background: 'rgba(59,130,246,0.12)', color: 'var(--accent)', border: '1px solid rgba(59,130,246,0.25)' }}
                title={`Quelle: ${sourceLabel}`}
              >
                <Bot size={10} className="shrink-0" />
                {sourceLabel}
              </span>
            )}
```

durch:

```tsx
            {sourceLabel && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold shrink-0 max-w-32 truncate"
                style={{ background: `${botColor}18`, color: botColor, border: `1px solid ${botColor}66` }}
                title={`Quelle: ${sourceLabel}`}
              >
                <Bot size={10} className="shrink-0" />
                {sourceLabel}
              </span>
            )}
```

- [ ] **Step 6: TypeScript-Check abwarten**

Erwartet: keine Fehler. `botColor` ist jetzt ein Pflicht-Prop von `TradeRow` — falls `TradeRow` an anderer Stelle im Code noch ohne `botColor` verwendet wird, meldet der Hook einen Fehler dafür. Per Grep prüfen, dass `TradeRow` nur in `JournalClient.tsx` verwendet wird:

```bash
grep -rn "<TradeRow" src/
```

Erwartet: einziger Treffer in `src/components/journal/JournalClient.tsx`.

- [ ] **Step 7: Browser-Verifikation**

```powershell
node ".claude\skills\run-alphatrack\driver.mjs" screenshot bot-color-check.png /journal
node ".claude\skills\run-alphatrack\driver.mjs" screenshot dashboard-color-check.png /dashboard
```

Beide Screenshots mit `Read` vergleichen. Erwartet: Für Trades mit demselben Bot zeigen Journal-Tabelle und Dashboard/Kalender dieselbe Badge-Farbe (Bot-Tag-Punkt und Textfarbe stimmen überein). Trades ohne Bot-Zuordnung (Trade Executor / Manuell/MT5) zeigen einen neutralen grauen Tag (`#6b7280`).

- [ ] **Step 8: Commit**

```bash
git add src/app/journal/page.tsx src/components/journal/JournalClient.tsx src/components/journal/TradeRow.tsx
git commit -m "fix: Bot-Tag-Farben im Journal konsistent mit Dashboard/Kalender/Bridge-Trades"
```

---

### Task 5: Bot-Filter-Dropdown im Journal

**Files:**
- Create: `src/components/journal/BotFilterDropdown.tsx`
- Modify: `src/components/journal/JournalClient.tsx` (Import, State, Filterlogik, Toolbar-Rendering)

**Interfaces:**
- Neue Komponente `BotFilterDropdown`:
  ```tsx
  export const MANUAL_FILTER_VALUE = 'manual'

  interface Props {
    bots: BotEntry[]
    selected: Set<string>
    onChange: (next: Set<string>) => void
  }

  export default function BotFilterDropdown({ bots, selected, onChange }: Props)
  ```
- Konsumiert: `BotEntry` aus `@/types/bot`, `getBotColor` aus `@/lib/bot-colors` (für die Farbpunkte neben jedem Bot-Namen — dieselbe Funktion/Liste wie in Task 4, damit Dropdown-Farben mit den Tag-Farben in der Tabelle übereinstimmen).
- Produziert: `selectedBots: Set<string>`-State in `JournalClient`, das ein zusätzliches Filterprädikat in der `filtered`-`useMemo` speist. Werte im Set sind entweder eine `BotEntry.id` oder der Marker `MANUAL_FILTER_VALUE`.

- [ ] **Step 1: BotFilterDropdown.tsx erstellen**

```tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Bot } from 'lucide-react'
import { BotEntry } from '@/types/bot'
import { getBotColor } from '@/lib/bot-colors'

export const MANUAL_FILTER_VALUE = 'manual'

interface Props {
  bots: BotEntry[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
}

export default function BotFilterDropdown({ bots, selected, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const total = bots.length + 1
  const allSelected = selected.size === total

  function toggle(value: string) {
    const next = new Set(selected)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    onChange(next)
  }

  function label(): string {
    if (allSelected) return 'Alle Bots'
    if (selected.size === 0) return 'Keine Bots'
    return `${selected.size} ausgewählt`
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium cursor-pointer transition-all"
        style={{
          background: open || !allSelected ? 'var(--accent-bg)' : 'transparent',
          color: open || !allSelected ? 'var(--accent)' : 'var(--text-3)',
          border: `1px solid ${open || !allSelected ? 'var(--accent)' : 'transparent'}`,
        }}
      >
        <Bot size={11} />
        {label()}
        <ChevronDown size={11} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
          minWidth: 180, overflow: 'hidden', padding: 4,
        }}>
          {bots.map(bot => {
            const color = getBotColor(bot.id, bots)
            const checked = selected.has(bot.id)
            return (
              <label
                key={bot.id}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all"
                style={{ color: 'var(--text-1)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLLabelElement).style.background = 'var(--surface-2)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLLabelElement).style.background = 'transparent' }}
              >
                <input type="checkbox" checked={checked} onChange={() => toggle(bot.id)} style={{ accentColor: color }} />
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span className="truncate">{bot.name}</span>
              </label>
            )
          })}
          <label
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all"
            style={{
              color: 'var(--text-1)',
              borderTop: bots.length > 0 ? '1px solid var(--border)' : undefined,
              marginTop: bots.length > 0 ? 4 : 0,
              paddingTop: bots.length > 0 ? 8 : undefined,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLLabelElement).style.background = 'var(--surface-2)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLLabelElement).style.background = 'transparent' }}
          >
            <input type="checkbox" checked={selected.has(MANUAL_FILTER_VALUE)} onChange={() => toggle(MANUAL_FILTER_VALUE)} />
            <span className="truncate">Manuell</span>
          </label>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Import in JournalClient.tsx ergänzen**

Ersetze:

```tsx
import TradeRow from './TradeRow'
import TradeModal from './TradeModal'
import ImportModal from './ImportModal'
```

durch:

```tsx
import TradeRow from './TradeRow'
import TradeModal from './TradeModal'
import ImportModal from './ImportModal'
import BotFilterDropdown, { MANUAL_FILTER_VALUE } from './BotFilterDropdown'
```

- [ ] **Step 3: `selectedBots`-State ergänzen**

Ersetze:

```tsx
  const [filterDir, setFilterDir] = useState<FilterDir>('all')
  const [sortKey, setSortKey] = useState<SortKey>('date')
```

durch:

```tsx
  const [filterDir, setFilterDir] = useState<FilterDir>('all')
  const [selectedBots, setSelectedBots] = useState<Set<string>>(
    () => new Set([...bots.map(b => b.id), MANUAL_FILTER_VALUE])
  )
  const [sortKey, setSortKey] = useState<SortKey>('date')
```

- [ ] **Step 4: Filterprädikat in `filtered` ergänzen**

Ersetze:

```tsx
  const filtered = useMemo(() => trades
    .filter(t => {
      if (filterStatus !== 'all' && t.status !== filterStatus) return false
      if (filterDir !== 'all' && t.type !== filterDir) return false
      if (search) {
```

durch:

```tsx
  const filtered = useMemo(() => trades
    .filter(t => {
      if (filterStatus !== 'all' && t.status !== filterStatus) return false
      if (filterDir !== 'all' && t.type !== filterDir) return false
      if (t.botId) {
        if (!selectedBots.has(t.botId)) return false
      } else if (!selectedBots.has(MANUAL_FILTER_VALUE)) {
        return false
      }
      if (search) {
```

Ersetze die Dependency-Liste:

```tsx
    [trades, filterStatus, filterDir, search, sortKey, sortAsc]
```

durch:

```tsx
    [trades, filterStatus, filterDir, selectedBots, search, sortKey, sortAsc]
```

- [ ] **Step 5: Dropdown in der Toolbar rendern**

Ersetze:

```tsx
                {val === 'long' && <TrendingUp size={10} />}
                {val === 'short' && <TrendingDown size={10} />}
                {label}
              </button>
            ))}

            {/* Action-Buttons rechtsbündig */}
```

durch:

```tsx
                {val === 'long' && <TrendingUp size={10} />}
                {val === 'short' && <TrendingDown size={10} />}
                {label}
              </button>
            ))}

            {bots.length > 0 && (
              <>
                {/* Trennlinie */}
                <span style={{ width: 1, height: 14, background: 'var(--border)', margin: '0 2px', flexShrink: 0 }} />

                {/* Bot-Filter */}
                <BotFilterDropdown
                  bots={bots}
                  selected={selectedBots}
                  onChange={next => { setSelectedBots(next); resetPage() }}
                />
              </>
            )}

            {/* Action-Buttons rechtsbündig */}
```

- [ ] **Step 6: TypeScript-Check abwarten**

Erwartet: keine Fehler.

- [ ] **Step 7: Browser-Verifikation**

```powershell
node ".claude\skills\run-alphatrack\driver.mjs" screenshot bot-filter-check.png /journal
```

Mit `Read` ansehen. Erwartet: Bot-Filter-Dropdown erscheint in der Toolbar (nur wenn mindestens ein Bot registriert ist), zeigt "Alle Bots" im Standardzustand. Manuell im Browser öffnen und einen Bot abwählen prüfen, dass die Trade-Liste entsprechend gefiltert wird (falls kein separater Screenshot-Test dafür möglich ist, den Code-Pfad durch Lesen der `filtered`-Logik nochmal gegenlesen — die Kernaussage: ein Trade mit `botId` verschwindet aus der Liste, sobald sein Bot abgewählt wird, taucht bei erneuter Auswahl wieder auf).

- [ ] **Step 8: Commit**

```bash
git add src/components/journal/BotFilterDropdown.tsx src/components/journal/JournalClient.tsx
git commit -m "feat: Bot-Filter-Dropdown im Journal hinzufügen"
```

---

## Self-Review Notizen

- **Spec-Abdeckung:** Sidebar-Umbau → Task 1. Status-Filter reduzieren → Task 3. Bot-Filter-Dropdown mit "Manuell"-Sammel-Eintrag → Task 5. Bot-Tag-Farben konsistent (index-basiert, `TradeRow` bisher unbunt) → Task 4. Bot-Import entfernen (Modal, Button, State, Server Action, `profiles`-Prop) → Task 2. Alle vier Spec-Abschnitte sind abgedeckt.
- **Reihenfolge:** Task 2 vor Task 3/4/5, da es Code aus `JournalClient.tsx` entfernt, den spätere Tasks sonst mit-anfassen müssten. Task 4 vor Task 5, da Task 5 dieselbe gefilterte `bots`-Liste (Task 4, Step 1) für die Dropdown-Optionen und deren Farben voraussetzt.
- **Typkonsistenz geprüft:** `botColor` heißt in `JournalClient` (`resolveSourceColor`), im `TradeRow`-Prop (`botColor`) und in `BotFilterDropdown` (lokale `color`-Variable via `getBotColor`) konsistent. `MANUAL_FILTER_VALUE` wird aus `BotFilterDropdown.tsx` exportiert und in `JournalClient.tsx` für State-Initialisierung und Filterprädikat importiert — derselbe String-Wert überall.
