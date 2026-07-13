# Daily Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Neue Seite `/checklist` mit goldenem, eigenständigem Sidebar-Eintrag: tägliche Selbstreflexions-Checkliste (Checkbox- und Skala-Punkte), Streak-/Freeze-Mechanik und dauerhaft freischaltbare Streak-/Lifetime-Badges — motivierend im WoW-Quest-Stil, ohne jemals zu bewerten, *ob* getradet wurde.

**Architecture:** Neue Typen in `src/types/checklist.ts`, reine Datums-Hilfsfunktion in `src/lib/checklist-date.ts` (client-sicher, kein `fs`), Persistenz + Streak-/Badge-Logik in `src/lib/checklist.ts` (zwei neue JSON-Dateien pro Profil: `checklist-{profileId}.json` Config, `checklist-log-{profileId}.json` Log). Neue Server Actions in `src/lib/actions.ts`. Neue Seite `src/app/checklist/page.tsx` (Server Component) mit `ChecklistClient.tsx` (Ersteinrichtung + Tagesformular + Badge-Galerie) und den Modals `ChecklistModal.tsx` (Punkte-Editor) und `FreezeDayModal.tsx`. `Sidebar.tsx` bekommt einen goldenen Eintrag mit Streak-Chip, gespeist über eine neue `/api/checklist/streak`-Route.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Server Actions, `framer-motion` (Modal-Animation), `lucide-react` (Icons), `nanoid` (IDs) — alles bereits vorhandene Dependencies, keine neuen Packages nötig.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-13-daily-checklist-design.md` (Approved).
- **Es gibt keine automatisierte Testsuite in diesem Projekt** (kein Jest/Vitest, kein `npm test`). Verifikation läuft ausschließlich über: (1) den automatischen `tsc --noEmit`-Hook (`.claude/hooks/ts-check.py`), der nach jedem Datei-Edit läuft und bei Fehlern blockiert, (2) direkte API-Aufrufe via `.claude\skills\run-alphatrack\driver.mjs api ...`, (3) Browser-Verifikation via `driver.mjs screenshot`/`check`. Schritte, die in einer klassischen TDD-Vorlage Unit-Tests wären, sind durch Punkt (2)/(3) ersetzt — Verifikation der Streak-/Badge-Logik erfolgt gebündelt in Task 9 gegen echte Log-Dateien, nicht isoliert pro Funktion.
- Alle Schreibzugriffe auf `data/*.json` **atomar** (`.tmp`-Datei schreiben, dann `fs.renameSync`) — folgt exakt dem Muster in `src/lib/profiles.ts`/`src/lib/strategies.ts`.
- Neue Dateien pro Profil: `data/checklist-{profileId}.json` (Config), `data/checklist-log-{profileId}.json` (Log). Beide müssen bei `deleteProfile()` (`src/lib/profiles.ts`) mit aufgeräumt werden.
- UI-Sprache durchgängig Deutsch, CSS ausschließlich über bestehende `var(--...)`-Variablen; goldener/amber Akzent nutzt den bereits im Code vorhandenen Ton `#f59e0b` (siehe `Sidebar.tsx:281`, dort schon für den "getrennt"-Zustand der MT5-Verbindung verwendet).
- Kein Kalender-/Verlaufs-View über vergangene Checklist-Tage, kein Freeze-Kontingent-Limit, keine Verknüpfung mit Alpha Score oder Trade-Gewinn/Verlust-Streaks — bewusst außerhalb des Scopes (siehe Spec).

---

### Task 1: Typen (`src/types/checklist.ts`)

**Files:**
- Create: `src/types/checklist.ts`

**Interfaces:**
- Consumes: nichts.
- Produces: `ChecklistItemType`, `ChecklistItem`, `ChecklistConfig`, `ChecklistDayEntry`, `ChecklistLog`, `ChecklistBadgeKind`, `ChecklistBadgeDefinition`, `CHECKLIST_BADGES`, `DEFAULT_CHECKLIST_ITEMS` — werden von Task 2 (Datenlogik), Task 3 (Actions) und allen UI-Tasks importiert.

- [ ] **Step 1: Datei schreiben**

```typescript
export type ChecklistItemType = 'boolean' | 'scale'

export interface ChecklistItem {
  id: string
  label: string
  type: ChecklistItemType
  order: number
  createdAt: string
}

export interface ChecklistConfig {
  profileId: string
  items: ChecklistItem[]
  createdAt: string
}

export interface ChecklistDayEntry {
  date: string // "YYYY-MM-DD", lokales Datum
  values: Record<string, boolean | number>
  completed: boolean
  freeze?: boolean
}

export interface ChecklistLog {
  profileId: string
  entries: ChecklistDayEntry[]
  unlockedBadges: Record<string, string> // badgeId -> ISO-Datum der Freischaltung
}

export type ChecklistBadgeKind = 'streak' | 'lifetime'

export interface ChecklistBadgeDefinition {
  id: string
  kind: ChecklistBadgeKind
  threshold: number
  name: string
}

export const CHECKLIST_BADGES: ChecklistBadgeDefinition[] = [
  { id: 'streak-3',     kind: 'streak',   threshold: 3,   name: 'Guter Start' },
  { id: 'streak-7',     kind: 'streak',   threshold: 7,   name: 'Eine Woche Disziplin' },
  { id: 'streak-30',    kind: 'streak',   threshold: 30,  name: 'Eiserner Wille' },
  { id: 'streak-100',   kind: 'streak',   threshold: 100, name: 'Trading-Mönch' },
  { id: 'streak-365',   kind: 'streak',   threshold: 365, name: 'Meister der Routine' },
  { id: 'lifetime-50',  kind: 'lifetime', threshold: 50,  name: 'Halbes Hundert' },
  { id: 'lifetime-200', kind: 'lifetime', threshold: 200, name: 'Routinier' },
  { id: 'lifetime-500', kind: 'lifetime', threshold: 500, name: 'Veteran' },
]

export const DEFAULT_CHECKLIST_ITEMS: { label: string; type: ChecklistItemType }[] = [
  { label: 'Bin ich mental in der Verfassung, um heute zu handeln?', type: 'scale' },
  { label: 'Habe ich meinen Trading-Plan / mein Setup vor dem ersten Trade überprüft?', type: 'boolean' },
  { label: 'Habe ich heute eine bewusste Entscheidung getroffen — auch wenn sie war, nicht zu traden?', type: 'boolean' },
  { label: 'Habe ich mein Risiko pro Trade innerhalb meiner Regeln gehalten?', type: 'boolean' },
  { label: 'Habe ich Trades aus Emotion (FOMO, Rache, Langeweile) vermieden?', type: 'boolean' },
  { label: 'Wie war meine Erholung/Schlafqualität vor dem Handelstag?', type: 'scale' },
]
```

- [ ] **Step 2: TypeScript-Check abwarten**

Der `.claude/hooks/ts-check.py`-Hook läuft automatisch nach dem Schreiben der Datei. Erwartung: keine Fehler.

- [ ] **Step 3: Commit**

```bash
git add src/types/checklist.ts
git commit -m "feat: add Daily Checklist types, badge definitions and default items"
```

---

### Task 2: Datums-Helper + Persistenz- und Streak-Logik (`src/lib/checklist-date.ts`, `src/lib/checklist.ts`)

**Files:**
- Create: `src/lib/checklist-date.ts`
- Create: `src/lib/checklist.ts`
- Modify: `src/lib/profiles.ts:74-78` (Cleanup-Liste in `deleteProfile()`)

**Interfaces:**
- Consumes: `ChecklistConfig`, `ChecklistItem`, `ChecklistDayEntry`, `ChecklistLog`, `CHECKLIST_BADGES`, `DEFAULT_CHECKLIST_ITEMS` aus `@/types/checklist` (Task 1).
- Produces:
  - `toLocalDateStr(d?: Date): string` (aus `checklist-date.ts`, **kein** `fs`-Import — sicher für Client-Komponenten in Task 4/6)
  - `getChecklistConfig(profileId: string): ChecklistConfig | null`
  - `saveChecklistConfig(config: ChecklistConfig): void`
  - `createDefaultChecklistConfig(profileId: string): ChecklistConfig`
  - `getChecklistLog(profileId: string): ChecklistLog`
  - `saveChecklistLog(log: ChecklistLog): void`
  - `saveDayEntry(profileId: string, date: string, values: Record<string, boolean | number>): ChecklistLog`
  - `setFreezeDay(profileId: string, date: string): ChecklistLog`
  - `calcChecklistStreak(log: ChecklistLog, today?: Date): number`
  - `calcChecklistLifetime(log: ChecklistLog): number`

  Diese Signaturen werden von Task 3 (Server Actions), Task 4 (Page/Client) und Task 8 (Sidebar-API-Route) importiert.

- [ ] **Step 1: `src/lib/checklist-date.ts` schreiben**

Reine Funktion ohne `fs`/`path`-Import, damit sie sowohl in Server-Code als auch in Client-Komponenten importiert werden kann (im Gegensatz zu `checklist.ts`, das `fs` nutzt und daher niemals in eine `'use client'`-Datei importiert werden darf).

```typescript
export function toLocalDateStr(d: Date = new Date()): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
```

- [ ] **Step 2: `src/lib/checklist.ts` schreiben**

```typescript
import path from 'path'
import fs from 'fs'
import { nanoid } from 'nanoid'
import {
  ChecklistConfig,
  ChecklistLog,
  ChecklistDayEntry,
  CHECKLIST_BADGES,
  DEFAULT_CHECKLIST_ITEMS,
} from '@/types/checklist'
import { toLocalDateStr } from '@/lib/checklist-date'

const DATA_DIR = path.join(process.cwd(), 'data')

function getConfigFilePath(profileId: string): string {
  return path.join(DATA_DIR, `checklist-${profileId}.json`)
}

function getLogFilePath(profileId: string): string {
  return path.join(DATA_DIR, `checklist-log-${profileId}.json`)
}

function atomicWrite(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const tmp = filePath + '.tmp'
  fs.writeFileSync(tmp, content, 'utf-8')
  fs.renameSync(tmp, filePath)
}

export function getChecklistConfig(profileId: string): ChecklistConfig | null {
  try {
    const raw = fs.readFileSync(getConfigFilePath(profileId), 'utf-8')
    return JSON.parse(raw) as ChecklistConfig
  } catch {
    return null
  }
}

export function saveChecklistConfig(config: ChecklistConfig): void {
  atomicWrite(getConfigFilePath(config.profileId), JSON.stringify(config, null, 2))
}

export function createDefaultChecklistConfig(profileId: string): ChecklistConfig {
  const now = new Date().toISOString()
  return {
    profileId,
    items: DEFAULT_CHECKLIST_ITEMS.map((item, index) => ({
      ...item,
      id: nanoid(10),
      order: index,
      createdAt: now,
    })),
    createdAt: now,
  }
}

export function getChecklistLog(profileId: string): ChecklistLog {
  try {
    const raw = fs.readFileSync(getLogFilePath(profileId), 'utf-8')
    return JSON.parse(raw) as ChecklistLog
  } catch {
    return { profileId, entries: [], unlockedBadges: {} }
  }
}

export function saveChecklistLog(log: ChecklistLog): void {
  atomicWrite(getLogFilePath(log.profileId), JSON.stringify(log, null, 2))
}

export function calcChecklistStreak(log: ChecklistLog, today: Date = new Date()): number {
  const entryByDate = new Map(log.entries.map(e => [e.date, e]))
  let streak = 0
  const cursor = new Date(today)
  for (;;) {
    const entry = entryByDate.get(toLocalDateStr(cursor))
    if (entry && (entry.completed || entry.freeze)) {
      streak++
      cursor.setDate(cursor.getDate() - 1)
    } else {
      break
    }
  }
  return streak
}

export function calcChecklistLifetime(log: ChecklistLog): number {
  return log.entries.filter(e => e.completed).length
}

function checkAndUnlockBadges(log: ChecklistLog): void {
  const streak = calcChecklistStreak(log)
  const lifetime = calcChecklistLifetime(log)
  const now = new Date().toISOString()
  for (const badge of CHECKLIST_BADGES) {
    if (log.unlockedBadges[badge.id]) continue
    const value = badge.kind === 'streak' ? streak : lifetime
    if (value >= badge.threshold) {
      log.unlockedBadges[badge.id] = now
    }
  }
}

function upsertEntry(log: ChecklistLog, entry: ChecklistDayEntry): ChecklistLog {
  const entries = log.entries.filter(e => e.date !== entry.date)
  entries.push(entry)
  return { ...log, entries }
}

export function saveDayEntry(
  profileId: string,
  date: string,
  values: Record<string, boolean | number>,
): ChecklistLog {
  const config = getChecklistConfig(profileId)
  const completed = config !== null && config.items.every(item => values[item.id] !== undefined)
  const log = upsertEntry(getChecklistLog(profileId), { date, values, completed })
  checkAndUnlockBadges(log)
  saveChecklistLog(log)
  return log
}

export function setFreezeDay(profileId: string, date: string): ChecklistLog {
  const log = upsertEntry(getChecklistLog(profileId), { date, values: {}, completed: false, freeze: true })
  checkAndUnlockBadges(log)
  saveChecklistLog(log)
  return log
}
```

- [ ] **Step 3: `deleteProfile()` in `src/lib/profiles.ts` um Checklist-Dateien erweitern**

In `src/lib/profiles.ts:74-78` die bestehende `filesToDelete`-Liste erweitern:

```typescript
  const filesToDelete = [
    getTradeFilePath(profileId),
    path.join(DATA_DIR, `strategies-${profileId}.json`),
    path.join(DATA_DIR, `bot-trades-${profileId}.json`),
    path.join(DATA_DIR, `checklist-${profileId}.json`),
    path.join(DATA_DIR, `checklist-log-${profileId}.json`),
  ]
```

- [ ] **Step 4: TypeScript-Check abwarten**

Hook läuft automatisch nach jedem Edit/Write. Erwartung: keine Fehler.

- [ ] **Step 5: Commit**

```bash
git add src/lib/checklist-date.ts src/lib/checklist.ts src/lib/profiles.ts
git commit -m "feat: add Daily Checklist persistence, streak and badge logic"
```

---

### Task 3: Server Actions (`src/lib/actions.ts`)

**Files:**
- Modify: `src/lib/actions.ts` (neue Sektion am Ende der Datei, analog zur bestehenden "Strategy Actions"-Sektion ab Zeile 307)

**Interfaces:**
- Consumes: `getActiveProfileId` (bereits importiert), `ChecklistItem`, `ChecklistItemType`, `ChecklistConfig` aus `@/types/checklist`, `getChecklistConfig`, `saveChecklistConfig`, `saveDayEntry`, `setFreezeDay` aus `@/lib/checklist` (Task 2).
- Produces: `saveChecklistConfigAction(formData: FormData): Promise<void>`, `saveChecklistEntryAction(formData: FormData): Promise<void>`, `setChecklistFreezeAction(formData: FormData): Promise<void>` — werden von Task 4, 5, 6 importiert.

- [ ] **Step 1: Imports ergänzen**

Am Anfang von `src/lib/actions.ts`, direkt nach der bestehenden `Strategy`-Import-Zeile (Zeile 10):

```typescript
import { ChecklistItem, ChecklistItemType, ChecklistConfig } from '@/types/checklist'
import { getChecklistConfig, saveChecklistConfig, saveDayEntry, setFreezeDay } from '@/lib/checklist'
```

- [ ] **Step 2: Actions am Dateiende ergänzen**

Nach der bestehenden `deleteStrategyAction` (Ende der Datei) neue Sektion anfügen:

```typescript

// --- Checklist Actions ---

function parseChecklistItems(raw: string, existingItems: ChecklistItem[]): ChecklistItem[] {
  const existingById = new Map(existingItems.map(i => [i.id, i]))
  const parsed = JSON.parse(raw) as { id?: string; label: string; type: ChecklistItemType }[]
  return parsed.map((item, index) => {
    const existing = item.id ? existingById.get(item.id) : undefined
    return {
      id: existing?.id ?? nanoid(10),
      label: item.label,
      type: item.type,
      order: index,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    }
  })
}

export async function saveChecklistConfigAction(formData: FormData) {
  const activeId = getActiveProfileId()
  if (!activeId) redirect('/setup')

  const existing = getChecklistConfig(activeId)
  const items = parseChecklistItems(formData.get('items') as string, existing?.items ?? [])
  const config: ChecklistConfig = {
    profileId: activeId,
    items,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  }
  saveChecklistConfig(config)
  revalidatePath('/checklist')
}

export async function saveChecklistEntryAction(formData: FormData) {
  const activeId = getActiveProfileId()
  if (!activeId) redirect('/setup')

  const date = formData.get('date') as string
  const values = JSON.parse(formData.get('values') as string) as Record<string, boolean | number>
  saveDayEntry(activeId, date, values)
  revalidatePath('/checklist')
}

export async function setChecklistFreezeAction(formData: FormData) {
  const activeId = getActiveProfileId()
  if (!activeId) redirect('/setup')

  const date = formData.get('date') as string
  setFreezeDay(activeId, date)
  revalidatePath('/checklist')
}
```

Hinweis: `nanoid`, `revalidatePath` und `redirect` sind in `actions.ts` bereits importiert (siehe Zeilen 1-5) und müssen nicht erneut importiert werden.

- [ ] **Step 3: TypeScript-Check abwarten**

Hook läuft automatisch. Erwartung: keine Fehler.

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions.ts
git commit -m "feat: add Daily Checklist server actions"
```

---

### Task 4: Checklist-Seite, Item-Editor-UI und Tagesformular

**Files:**
- Create: `src/app/checklist/page.tsx`
- Create: `src/components/checklist/ChecklistItemEditor.tsx`
- Create: `src/components/checklist/ChecklistClient.tsx`

**Interfaces:**
- Consumes: `getProfiles`, `getActiveProfile` (`@/lib/profiles`), `getChecklistConfig`, `getChecklistLog`, `calcChecklistStreak`, `calcChecklistLifetime` (`@/lib/checklist`, Task 2), `DEFAULT_CHECKLIST_ITEMS`, `ChecklistConfig`, `ChecklistLog` (`@/types/checklist`, Task 1), `saveChecklistConfigAction`, `saveChecklistEntryAction` (`@/lib/actions`, Task 3), `toLocalDateStr` (`@/lib/checklist-date`, Task 2), `Sidebar` (`@/components/layout/Sidebar`).
- Produces:
  - `export interface EditableItem { id?: string; label: string; type: ChecklistItemType }` + `ChecklistItemEditor({ items, onChange }: { items: EditableItem[]; onChange: (items: EditableItem[]) => void })` — wird von Task 5 (`ChecklistModal`) wiederverwendet.
  - `ChecklistClient` Props: `{ config: ChecklistConfig | null; log: ChecklistLog; streak: number; lifetime: number; defaultItems: { label: string; type: ChecklistItemType }[] }` — Task 5, 6, 7 erweitern diese Komponente um Editor-/Freeze-Button und Badge-Galerie.

- [ ] **Step 1: `src/components/checklist/ChecklistItemEditor.tsx` schreiben**

```tsx
'use client'

import { Plus, Trash2 } from 'lucide-react'
import { ChecklistItemType } from '@/types/checklist'

export interface EditableItem {
  id?: string
  label: string
  type: ChecklistItemType
}

interface Props {
  items: EditableItem[]
  onChange: (items: EditableItem[]) => void
}

export default function ChecklistItemEditor({ items, onChange }: Props) {
  function updateLabel(index: number, label: string) {
    onChange(items.map((it, i) => (i === index ? { ...it, label } : it)))
  }

  function toggleType(index: number) {
    onChange(items.map((it, i) =>
      i === index ? { ...it, type: it.type === 'boolean' ? 'scale' : 'boolean' } : it
    ))
  }

  function addItem() {
    onChange([...items, { label: '', type: 'boolean' }])
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index))
  }

  const inputStyle = {
    background: 'var(--surface-3)',
    border: '1px solid var(--border)',
    color: 'var(--text-1)',
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, index) => (
        <div key={item.id ?? index} className="flex items-center gap-2">
          <input
            type="text"
            value={item.label}
            onChange={e => updateLabel(index, e.target.value)}
            placeholder={`Punkt ${index + 1}`}
            className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
            style={inputStyle}
          />
          <button
            type="button"
            onClick={() => toggleType(index)}
            className="px-2 py-1.5 rounded-md text-xs font-medium cursor-pointer shrink-0"
            style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
          >
            {item.type === 'scale' ? 'Skala 1-5' : 'Checkbox'}
          </button>
          <button
            type="button"
            onClick={() => removeItem(index)}
            className="w-7 h-7 flex items-center justify-center rounded-md cursor-pointer shrink-0"
            style={{ color: 'var(--text-3)', background: 'var(--surface-2)' }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium cursor-pointer self-start"
        style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent)' }}
      >
        <Plus size={11} />
        Punkt hinzufügen
      </button>
    </div>
  )
}
```

- [ ] **Step 2: `src/components/checklist/ChecklistClient.tsx` schreiben**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { ChecklistConfig, ChecklistLog, ChecklistItemType } from '@/types/checklist'
import { saveChecklistConfigAction, saveChecklistEntryAction } from '@/lib/actions'
import { toLocalDateStr } from '@/lib/checklist-date'
import ChecklistItemEditor, { EditableItem } from './ChecklistItemEditor'

interface Props {
  config: ChecklistConfig | null
  log: ChecklistLog
  streak: number
  lifetime: number
  defaultItems: { label: string; type: ChecklistItemType }[]
}

export default function ChecklistClient({ config, log, streak, lifetime, defaultItems }: Props) {
  const [isPending, startTransition] = useTransition()
  const [setupItems, setSetupItems] = useState<EditableItem[]>(() => defaultItems.map(i => ({ ...i })))
  const today = toLocalDateStr()
  const todayEntry = log.entries.find(e => e.date === today)
  const [values, setValues] = useState<Record<string, boolean | number>>(todayEntry?.values ?? {})

  if (!config) {
    function activate() {
      const fd = new FormData()
      fd.set('items', JSON.stringify(setupItems))
      startTransition(async () => { await saveChecklistConfigAction(fd) })
    }

    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm" style={{ color: 'var(--text-2)' }}>
          Richte deine tägliche Checkliste ein. Passe die vorgeschlagenen Punkte an oder übernimm sie so — du kannst sie jederzeit später ändern.
        </p>
        <ChecklistItemEditor items={setupItems} onChange={setSetupItems} />
        <button
          type="button"
          onClick={activate}
          disabled={isPending}
          className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer self-start"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          Checkliste aktivieren
        </button>
      </div>
    )
  }

  function saveValue(itemId: string, value: boolean | number) {
    const next = { ...values, [itemId]: value }
    setValues(next)
    const fd = new FormData()
    fd.set('date', today)
    fd.set('values', JSON.stringify(next))
    startTransition(async () => { await saveChecklistEntryAction(fd) })
  }

  const sortedItems = [...config.items].sort((a, b) => a.order - b.order)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <span style={{ color: 'var(--text-1)', fontWeight: 700 }}>🔥 {streak} {streak === 1 ? 'Tag' : 'Tage'} Streak</span>
        <span style={{ color: 'var(--text-3)' }}>{lifetime} Tage insgesamt</span>
      </div>

      <div className="flex flex-col gap-2">
        {sortedItems.map(item => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-3 p-3 rounded-lg"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <span style={{ color: 'var(--text-1)' }}>{item.label}</span>
            {item.type === 'boolean' ? (
              <div className="flex gap-1 shrink-0">
                {[{ v: true, label: 'Ja' }, { v: false, label: 'Nein' }].map(opt => (
                  <button
                    key={String(opt.v)}
                    type="button"
                    onClick={() => saveValue(item.id, opt.v)}
                    style={{
                      padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      background: values[item.id] === opt.v ? 'var(--accent)' : 'var(--surface-2)',
                      color: values[item.id] === opt.v ? '#fff' : 'var(--text-2)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex gap-1 shrink-0">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => saveValue(item.id, n)}
                    style={{
                      width: 28, height: 28, borderRadius: 6, cursor: 'pointer',
                      background: values[item.id] === n ? 'var(--accent)' : 'var(--surface-2)',
                      color: values[item.id] === n ? '#fff' : 'var(--text-2)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Hinweis (Hooks-Reihenfolge):** `useState` für `values` wird bewusst **vor** dem frühen `return` im Ersteinrichtungs-Zweig aufgerufen (React Hooks müssen bei jedem Render in gleicher Reihenfolge laufen — ein `useState` erst nach einem bedingten `return` wäre ein Regelverstoß).

- [ ] **Step 3: `src/app/checklist/page.tsx` schreiben**

```tsx
export const dynamic = 'force-dynamic'

import { getProfiles, getActiveProfile } from '@/lib/profiles'
import { getChecklistConfig, getChecklistLog, calcChecklistStreak, calcChecklistLifetime } from '@/lib/checklist'
import { DEFAULT_CHECKLIST_ITEMS } from '@/types/checklist'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import ChecklistClient from '@/components/checklist/ChecklistClient'

export default function ChecklistPage() {
  const profiles = getProfiles()
  if (profiles.length === 0) redirect('/setup')
  const activeProfile = getActiveProfile()
  if (!activeProfile) redirect('/setup')

  const config = getChecklistConfig(activeProfile.id)
  const log = getChecklistLog(activeProfile.id)
  const streak = calcChecklistStreak(log)
  const lifetime = calcChecklistLifetime(log)

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar profiles={profiles} activeProfile={activeProfile} />
      <main className="flex-1 p-4 md:p-6 max-w-full overflow-hidden">
        <div className="mb-5">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>
            Daily Checklist
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>
            {activeProfile.name} - Tägliche Selbstreflexion
          </p>
        </div>

        <ChecklistClient
          config={config}
          log={log}
          streak={streak}
          lifetime={lifetime}
          defaultItems={DEFAULT_CHECKLIST_ITEMS}
        />
      </main>
    </div>
  )
}
```

- [ ] **Step 4: TypeScript-Check abwarten**

Hook läuft automatisch nach jedem Datei-Edit. Erwartung: keine Fehler.

- [ ] **Step 5: Browser-Verifikation (Ersteinrichtung)**

Voraussetzung: Dev-Server läuft (`npm run dev`, siehe `.claude\skills\run-alphatrack\SKILL.md` für Details, insbesondere den Windows-`Start-Process npm`-Gotcha).

```powershell
node ".claude\skills\run-alphatrack\driver.mjs" check /checklist
```

Erwartung: `Status: 200`.

```powershell
node ".claude\skills\run-alphatrack\driver.mjs" screenshot checklist-setup.png /checklist
```

Screenshot mit `Read` ansehen: Ersteinrichtungs-Ansicht mit den 6 Default-Punkten (2× "Skala 1-5", 4× "Checkbox") und Button "Checkliste aktivieren" muss sichtbar sein.

- [ ] **Step 6: Commit**

```bash
git add src/app/checklist/page.tsx src/components/checklist/ChecklistItemEditor.tsx src/components/checklist/ChecklistClient.tsx
git commit -m "feat: add Daily Checklist page with setup flow and daily form"
```

---

### Task 5: Editor-Modal für bestehende Checklist-Punkte

**Files:**
- Create: `src/components/checklist/ChecklistModal.tsx`
- Modify: `src/components/checklist/ChecklistClient.tsx`

**Interfaces:**
- Consumes: `ChecklistItemEditor`, `EditableItem` (Task 4), `saveChecklistConfigAction` (Task 3), `ChecklistConfig` (Task 1).
- Produces: `ChecklistModal({ config, onClose }: { config: ChecklistConfig; onClose: () => void })` — wird in diesem Task in `ChecklistClient` verdrahtet.

- [ ] **Step 1: `src/components/checklist/ChecklistModal.tsx` schreiben**

```tsx
'use client'

import { useEffect, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { X, Loader2 } from 'lucide-react'
import { ChecklistConfig } from '@/types/checklist'
import { saveChecklistConfigAction } from '@/lib/actions'
import ChecklistItemEditor, { EditableItem } from './ChecklistItemEditor'

interface Props {
  config: ChecklistConfig
  onClose: () => void
}

export default function ChecklistModal({ config, onClose }: Props) {
  const [mounted, setMounted] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [items, setItems] = useState<EditableItem[]>(
    config.items.map(i => ({ id: i.id, label: i.label, type: i.type }))
  )

  useEffect(() => {
    setMounted(true)
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])
  if (!mounted) return null

  function handleSave() {
    const fd = new FormData()
    fd.set('items', JSON.stringify(items.filter(i => i.label.trim())))
    startTransition(async () => {
      await saveChecklistConfigAction(fd)
      onClose()
    })
  }

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.8)', zIndex: 9999 }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.18 }}
        onClick={e => e.stopPropagation()}
        className="relative w-full my-auto"
        style={{ maxWidth: 520 }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 rounded-t-xl"
          style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
        >
          <h2 className="text-base font-bold" style={{ color: 'var(--text-1)' }}>
            Checklist-Punkte bearbeiten
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer"
            style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}
          >
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4 rounded-b-xl" style={{ background: 'var(--surface)' }}>
          <ChecklistItemEditor items={items} onChange={setItems} />

          <div
            className="flex items-center justify-end gap-2 mt-4 pt-3.5"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
              style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
            >
              Abbrechen
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold cursor-pointer"
              style={{
                background: isPending ? 'var(--accent-bg)' : 'var(--accent)',
                color: isPending ? 'var(--accent)' : '#fff',
                border: '1px solid var(--accent)',
              }}
            >
              {isPending && <Loader2 size={14} className="animate-spin" />}
              Speichern
            </button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  )
}
```

- [ ] **Step 2: `ChecklistClient.tsx` um Editor-Button erweitern**

In `src/components/checklist/ChecklistClient.tsx` den Import ergänzen:

```tsx
import ChecklistModal from './ChecklistModal'
import { SlidersHorizontal } from 'lucide-react'
```

Direkt nach der Zeile `const [values, setValues] = useState<Record<string, boolean | number>>(todayEntry?.values ?? {})` ergänzen:

```tsx
  const [showEditor, setShowEditor] = useState(false)
```

Den Header-Block (aktuell nur Streak/Lifetime) um den Button erweitern — die bestehende Zeile

```tsx
      <div className="flex items-center gap-4">
        <span style={{ color: 'var(--text-1)', fontWeight: 700 }}>🔥 {streak} {streak === 1 ? 'Tag' : 'Tage'} Streak</span>
        <span style={{ color: 'var(--text-3)' }}>{lifetime} Tage insgesamt</span>
      </div>
```

ersetzen durch:

```tsx
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <span style={{ color: 'var(--text-1)', fontWeight: 700 }}>🔥 {streak} {streak === 1 ? 'Tag' : 'Tage'} Streak</span>
          <span style={{ color: 'var(--text-3)' }}>{lifetime} Tage insgesamt</span>
        </div>
        <button
          type="button"
          onClick={() => setShowEditor(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
          style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
        >
          <SlidersHorizontal size={13} />
          Punkte bearbeiten
        </button>
      </div>
```

Am Ende der Komponente (vor dem schließenden `</div>` des äußersten Containers) das Modal bedingt rendern:

```tsx
      {showEditor && <ChecklistModal config={config} onClose={() => setShowEditor(false)} />}
```

- [ ] **Step 3: TypeScript-Check abwarten**

Hook läuft automatisch. Erwartung: keine Fehler.

- [ ] **Step 4: Browser-Verifikation**

Dev-Server muss laufen und mindestens ein Profil mit aktivierter Checkliste haben (aus Task 4, Step 5 — dort wurde "Checkliste aktivieren" noch nicht geklickt; jetzt klicken, um die Config zu erzeugen, dann fortfahren):

```powershell
node ".claude\skills\run-alphatrack\driver.mjs" screenshot checklist-editor.png /checklist
```

Screenshot ansehen: Button "Punkte bearbeiten" muss sichtbar sein. Klick-Interaktion (Modal öffnen/Punkt hinzufügen/speichern) manuell im Browser oder per Playwright-MCP-Tools nachvollziehen — Modal muss sich öffnen, neuer Punkt hinzufügbar, Speichern schließt Modal und aktualisiert die Liste.

- [ ] **Step 5: Commit**

```bash
git add src/components/checklist/ChecklistModal.tsx src/components/checklist/ChecklistClient.tsx
git commit -m "feat: add Daily Checklist item editor modal"
```

---

### Task 6: Freeze-Tag-Modal

**Files:**
- Create: `src/components/checklist/FreezeDayModal.tsx`
- Modify: `src/components/checklist/ChecklistClient.tsx`

**Interfaces:**
- Consumes: `setChecklistFreezeAction` (Task 3), `toLocalDateStr` (Task 2).
- Produces: `FreezeDayModal({ onClose }: { onClose: () => void })` — wird in diesem Task in `ChecklistClient` verdrahtet.

- [ ] **Step 1: `src/components/checklist/FreezeDayModal.tsx` schreiben**

```tsx
'use client'

import { useEffect, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { X, Loader2 } from 'lucide-react'
import { setChecklistFreezeAction } from '@/lib/actions'
import { toLocalDateStr } from '@/lib/checklist-date'

interface Props {
  onClose: () => void
}

export default function FreezeDayModal({ onClose }: Props) {
  const [mounted, setMounted] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [date, setDate] = useState(toLocalDateStr())

  useEffect(() => {
    setMounted(true)
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])
  if (!mounted) return null

  function confirmFreeze() {
    const fd = new FormData()
    fd.set('date', date)
    startTransition(async () => {
      await setChecklistFreezeAction(fd)
      onClose()
    })
  }

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', zIndex: 9999 }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.18 }}
        onClick={e => e.stopPropagation()}
        className="relative w-full rounded-xl"
        style={{ maxWidth: 360, background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-base font-bold" style={{ color: 'var(--text-1)' }}>Freeze einlegen</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer"
            style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}
          >
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>
            Markiere einen Tag als Pause — er zählt für den Streak als gehalten, ohne dass echte Werte eingetragen werden. Funktioniert für Vergangenheit, heute und Zukunft.
          </p>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
          />
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
            style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
          >
            Abbrechen
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={confirmFreeze}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold cursor-pointer"
            style={{
              background: isPending ? 'var(--accent-bg)' : 'var(--accent)',
              color: isPending ? 'var(--accent)' : '#fff',
              border: '1px solid var(--accent)',
            }}
          >
            {isPending && <Loader2 size={14} className="animate-spin" />}
            Freeze setzen
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  )
}
```

- [ ] **Step 2: `ChecklistClient.tsx` um Freeze-Button erweitern**

Import ergänzen:

```tsx
import FreezeDayModal from './FreezeDayModal'
import { Snowflake } from 'lucide-react'
```

State direkt neben `showEditor` ergänzen:

```tsx
  const [showFreeze, setShowFreeze] = useState(false)
```

Im Header-`<div>` (aus Task 5, Step 2) den Freeze-Button neben "Punkte bearbeiten" ergänzen — die Zeile mit dem "Punkte bearbeiten"-Button bleibt, direkt danach:

```tsx
        <button
          type="button"
          onClick={() => setShowFreeze(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
          style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
        >
          <Snowflake size={13} />
          Freeze einlegen
        </button>
```

Am Ende der Komponente neben dem `ChecklistModal`-Rendering ergänzen:

```tsx
      {showFreeze && <FreezeDayModal onClose={() => setShowFreeze(false)} />}
```

- [ ] **Step 3: TypeScript-Check abwarten**

Hook läuft automatisch. Erwartung: keine Fehler.

- [ ] **Step 4: Browser-Verifikation**

```powershell
node ".claude\skills\run-alphatrack\driver.mjs" screenshot checklist-freeze.png /checklist
```

Screenshot ansehen: Button "Freeze einlegen" sichtbar. Modal-Öffnen/Datumsauswahl/Bestätigen manuell nachvollziehen; nach Bestätigung prüfen, dass `data/checklist-log-{profileId}.json` einen neuen Eintrag mit `"freeze": true` für das gewählte Datum enthält (Datei direkt lesen).

- [ ] **Step 5: Commit**

```bash
git add src/components/checklist/FreezeDayModal.tsx src/components/checklist/ChecklistClient.tsx
git commit -m "feat: add Daily Checklist freeze-day modal"
```

---

### Task 7: Badge-Galerie

**Files:**
- Create: `src/components/checklist/BadgeGallery.tsx`
- Modify: `src/components/checklist/ChecklistClient.tsx`

**Interfaces:**
- Consumes: `CHECKLIST_BADGES` aus `@/types/checklist` (Task 1).
- Produces: `BadgeGallery({ unlockedBadges, streak, lifetime }: { unlockedBadges: Record<string, string>; streak: number; lifetime: number })` — wird in diesem Task in `ChecklistClient` gerendert.

- [ ] **Step 1: `src/components/checklist/BadgeGallery.tsx` schreiben**

```tsx
import { CHECKLIST_BADGES } from '@/types/checklist'

interface Props {
  unlockedBadges: Record<string, string>
  streak: number
  lifetime: number
}

export default function BadgeGallery({ unlockedBadges, streak, lifetime }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {CHECKLIST_BADGES.map(badge => {
        const unlockedAt = unlockedBadges[badge.id]
        const current = badge.kind === 'streak' ? streak : lifetime
        const progress = Math.min(100, Math.round((current / badge.threshold) * 100))

        return (
          <div
            key={badge.id}
            className="flex flex-col gap-1.5 p-3 rounded-lg"
            style={{
              background: unlockedAt ? 'rgba(245,158,11,0.08)' : 'var(--surface-2)',
              border: unlockedAt ? '1px solid rgba(245,158,11,0.3)' : '1px solid var(--border)',
              opacity: unlockedAt ? 1 : 0.6,
            }}
          >
            <span style={{ color: unlockedAt ? '#f59e0b' : 'var(--text-1)', fontWeight: 700, fontSize: 13 }}>
              {badge.name}
            </span>
            <span style={{ color: 'var(--text-3)', fontSize: 11 }}>
              {badge.kind === 'streak' ? `${badge.threshold} Tage Streak` : `${badge.threshold} Tage insgesamt`}
            </span>
            {unlockedAt ? (
              <span style={{ color: 'var(--text-3)', fontSize: 10 }}>
                Freigeschaltet am {new Date(unlockedAt).toLocaleDateString('de-DE')}
              </span>
            ) : (
              <div style={{ height: 4, borderRadius: 2, background: 'var(--surface-3)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent)' }} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: `ChecklistClient.tsx` um Badge-Galerie erweitern**

Import ergänzen:

```tsx
import BadgeGallery from './BadgeGallery'
```

Am Ende des daily-form-Zweigs (nach der `<div>` mit den Checklist-Punkten, vor dem Modal-Rendering) ergänzen:

```tsx
      <div>
        <h2 className="text-sm font-bold mb-2" style={{ color: 'var(--text-1)' }}>Achievements</h2>
        <BadgeGallery unlockedBadges={log.unlockedBadges} streak={streak} lifetime={lifetime} />
      </div>
```

- [ ] **Step 3: TypeScript-Check abwarten**

Hook läuft automatisch. Erwartung: keine Fehler.

- [ ] **Step 4: Browser-Verifikation**

```powershell
node ".claude\skills\run-alphatrack\driver.mjs" screenshot checklist-badges.png /checklist
```

Screenshot ansehen: 8 Badge-Kacheln sichtbar, alle gesperrt (grau, Fortschrittsbalken bei 0%), da noch keine Log-Einträge existieren.

- [ ] **Step 5: Commit**

```bash
git add src/components/checklist/BadgeGallery.tsx src/components/checklist/ChecklistClient.tsx
git commit -m "feat: add Daily Checklist badge gallery"
```

---

### Task 8: Sidebar-Integration (goldener Eintrag + Streak-Chip)

**Files:**
- Create: `src/app/api/checklist/streak/route.ts`
- Modify: `src/components/layout/Sidebar.tsx`

**Interfaces:**
- Consumes: `getActiveProfileId` (`@/lib/profiles`), `getChecklistLog`, `calcChecklistStreak` (`@/lib/checklist`, Task 2).
- Produces: `GET /api/checklist/streak` → `{ streak: number }`.

- [ ] **Step 1: `src/app/api/checklist/streak/route.ts` schreiben**

```typescript
import { NextResponse } from 'next/server'
import { getActiveProfileId } from '@/lib/profiles'
import { getChecklistLog, calcChecklistStreak } from '@/lib/checklist'

export async function GET() {
  const profileId = getActiveProfileId()
  if (!profileId) return NextResponse.json({ streak: 0 })

  const log = getChecklistLog(profileId)
  return NextResponse.json({ streak: calcChecklistStreak(log) })
}
```

- [ ] **Step 2: Icon-Import in `Sidebar.tsx` ergänzen**

In `src/components/layout/Sidebar.tsx:5-10` den bestehenden `lucide-react`-Import um `ListChecks` erweitern:

```typescript
import {
  LayoutDashboard, BookOpen, BarChart2, Settings, Menu, X, Target,
  CalendarDays, Bot, Activity, ScrollText, SlidersHorizontal,
  Sparkles, ShieldCheck, ShieldOff, Network, Cpu, ListChecks,
  Eye, EyeOff, ChevronLeft, ChevronRight,
} from 'lucide-react'
```

- [ ] **Step 3: Streak-State + Fetch in `SidebarInner` ergänzen**

In `src/components/layout/Sidebar.tsx` innerhalb von `SidebarInner` (nach der bestehenden `useState`-Deklaration für `balanceVisible`, vor der `bridgeBot`-Zeile) ergänzen:

```tsx
  const [checklistStreak, setChecklistStreak] = useState(0)
  useEffect(() => {
    fetch('/api/checklist/streak')
      .then(r => r.json())
      .then(d => setChecklistStreak(d.streak ?? 0))
      .catch(() => {})
  }, [pathname])
```

`useEffect` muss zum bestehenden `import { useState } from 'react'`-Import (Zeile 12) ergänzt werden:

```typescript
import { useState, useEffect } from 'react'
```

- [ ] **Step 4: Goldenen Nav-Eintrag rendern**

In `src/components/layout/Sidebar.tsx` innerhalb des `<nav>`-Blocks (Zeile ~253-265), **direkt vor** `<SectionDivider label="Übersicht" collapsed={collapsed} />` ergänzen:

```tsx
        <Link
          href="/checklist"
          onClick={onNav}
          title={collapsed ? 'Daily Checklist' : undefined}
          className="flex items-center gap-2.5 px-2.5 py-2.5 mb-1 rounded-lg text-sm font-bold transition-all"
          style={{
            background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.3)',
            color: '#f59e0b',
            justifyContent: collapsed ? 'center' : 'space-between',
          }}
        >
          <span className="flex items-center gap-2">
            <ListChecks size={15} strokeWidth={2.5} />
            {!collapsed && 'Daily Checklist'}
          </span>
          {!collapsed && checklistStreak > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700 }}>🔥 {checklistStreak}</span>
          )}
        </Link>

```

- [ ] **Step 5: TypeScript-Check abwarten**

Hook läuft automatisch nach jedem Edit. Erwartung: keine Fehler.

- [ ] **Step 6: Browser-Verifikation**

```powershell
node ".claude\skills\run-alphatrack\driver.mjs" api /api/checklist/streak
```

Erwartung: `{"streak":0}` (noch kein Log-Eintrag vorhanden).

```powershell
node ".claude\skills\run-alphatrack\driver.mjs" screenshot dashboard-sidebar.png /dashboard
```

Screenshot ansehen: Goldener "Daily Checklist"-Eintrag muss ganz oben in der Sidebar sichtbar sein, vor der "Übersicht"-Sektion.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/checklist/streak/route.ts src/components/layout/Sidebar.tsx
git commit -m "feat: add golden Daily Checklist sidebar entry with streak indicator"
```

---

### Task 9: End-to-End-Verifikation (Streak, Freeze, Badges)

**Files:**
- Keine Code-Änderungen — reine Verifikation der in Task 1-8 gebauten Funktionalität gegen echte Daten.

**Interfaces:**
- Consumes: alle vorherigen Tasks.
- Produces: nichts (Verifikations-Task).

Dieser Task ersetzt die in einer klassischen TDD-Vorlage isolierten Unit-Tests für `calcChecklistStreak`/`calcChecklistLifetime`/Badge-Unlock — da keine Testsuite existiert, wird die Logik direkt gegen reale JSON-Dateien und über den Browser verifiziert (gleiches Vorgehen wie in `docs/superpowers/plans/2026-07-11-trade-chart-entry-exit-markers.md`, Task 2/3).

- [ ] **Step 1: Aktives Profil ermitteln**

```powershell
node ".claude\skills\run-alphatrack\driver.mjs" api /api/profiles
```

Profil-`id` aus der Antwort notieren (im Folgenden `<PROFILE_ID>`).

- [ ] **Step 2: Fixture-Log für einen 7-Tage-Streak anlegen**

`data/checklist-log-<PROFILE_ID>.json` mit `Read` öffnen, um die von der App erzeugten `unlockedBadges`/vorhandenen Einträge zu sehen, dann mit `Write` überschreiben (Item-IDs aus `data/checklist-<PROFILE_ID>.json` übernehmen — mit `Read` prüfen, welche `id`s die 6 Default-Punkte haben). Für alle 6 Item-IDs `true`/`3` als Platzhalterwerte setzen, `completed: true`, Datum = heute und die 6 Tage davor (lokale Daten, `toLocalDateStr`-Format `YYYY-MM-DD`):

```json
{
  "profileId": "<PROFILE_ID>",
  "entries": [
    { "date": "<heute-6>", "values": { "<item1>": true, "<item2>": true, "<item3>": true, "<item4>": true, "<item5>": true, "<item6>": 3 }, "completed": true },
    { "date": "<heute-5>", "values": { "<item1>": true, "<item2>": true, "<item3>": true, "<item4>": true, "<item5>": true, "<item6>": 3 }, "completed": true },
    { "date": "<heute-4>", "values": { "<item1>": true, "<item2>": true, "<item3>": true, "<item4>": true, "<item5>": true, "<item6>": 3 }, "completed": true },
    { "date": "<heute-3>", "values": { "<item1>": true, "<item2>": true, "<item3>": true, "<item4>": true, "<item5>": true, "<item6>": 3 }, "completed": true },
    { "date": "<heute-2>", "values": { "<item1>": true, "<item2>": true, "<item3>": true, "<item4>": true, "<item5>": true, "<item6>": 3 }, "completed": true },
    { "date": "<heute-1>", "values": { "<item1>": true, "<item2>": true, "<item3>": true, "<item4>": true, "<item5>": true, "<item6>": 3 }, "completed": true },
    { "date": "<heute>", "values": { "<item1>": true, "<item2>": true, "<item3>": true, "<item4>": true, "<item5>": true, "<item6>": 3 }, "completed": true }
  ],
  "unlockedBadges": {}
}
```

- [ ] **Step 3: Streak-API und Sidebar-Chip prüfen**

```powershell
node ".claude\skills\run-alphatrack\driver.mjs" api /api/checklist/streak
```

Erwartung: `{"streak":7}`.

```powershell
node ".claude\skills\run-alphatrack\driver.mjs" screenshot dashboard-streak7.png /dashboard
```

Screenshot ansehen: Sidebar zeigt "🔥 7" neben "Daily Checklist".

- [ ] **Step 4: Badge-Freischaltung durch Neuspeichern eines Tages auslösen**

Über die UI (Browser öffnen auf `/checklist`) einen beliebigen Wert des heutigen Tages erneut setzen (z.B. Skala-Punkt anklicken) — das triggert `saveDayEntry` → `checkAndUnlockBadges`, wodurch `streak-3` und `streak-7` in `unlockedBadges` eingetragen werden sollten.

```powershell
node ".claude\skills\run-alphatrack\driver.mjs" screenshot checklist-unlocked.png /checklist
```

Screenshot ansehen: Badges "Guter Start" (3 Tage) und "Eine Woche Disziplin" (7 Tage) müssen jetzt als freigeschaltet (goldener Rahmen, Freischalt-Datum statt Fortschrittsbalken) angezeigt werden; die übrigen 6 Badges bleiben gesperrt mit Fortschrittsbalken.

`data/checklist-log-<PROFILE_ID>.json` mit `Read` erneut prüfen: `unlockedBadges` muss jetzt `streak-3` und `streak-7` mit einem ISO-Datum enthalten.

- [ ] **Step 5: Streak-Bruch durch Lücke simulieren**

In derselben Log-Datei den Eintrag für `<heute-3>` (3 Tage zurück) entfernen (simuliert einen verpassten Tag ohne Freeze), Datei speichern.

```powershell
node ".claude\skills\run-alphatrack\driver.mjs" api /api/checklist/streak
```

Erwartung: `{"streak":3}` (nur noch die letzten 3 zusammenhängenden Tage zählen, die Lücke bei `<heute-3>` beendet die Rückwärts-Zählung).

`data/checklist-log-<PROFILE_ID>.json` mit `Read` prüfen: `unlockedBadges` enthält weiterhin `streak-7` (einmal freigeschaltete Achievements bleiben erhalten, auch wenn der aktuelle Streak jetzt unter 7 liegt) — das bestätigt die im Spec-Self-Review korrigierte Persistenz-Logik.

- [ ] **Step 6: Freeze-Tag über die UI setzen und Streak-Erhalt prüfen**

Über die UI auf `/checklist` den Button "Freeze einlegen" nutzen, um `<heute-3>` (dieselbe Lücke aus Step 5) als Freeze zu markieren.

```powershell
node ".claude\skills\run-alphatrack\driver.mjs" api /api/checklist/streak
```

Erwartung: `{"streak":7}` (die Lücke ist durch den Freeze geschlossen, die Rückwärts-Zählung läuft wieder bis `<heute-6>` durch).

- [ ] **Step 7: Aufräumen**

Alle in diesem Task erzeugten Screenshot-Dateien (`checklist-setup.png`, `checklist-editor.png`, `checklist-freeze.png`, `checklist-badges.png`, `dashboard-sidebar.png`, `dashboard-streak7.png`, `checklist-unlocked.png`) aus `.claude\skills\run-alphatrack\` löschen, da sie nur temporäre Verifikationsartefakte sind:

```powershell
Remove-Item ".claude\skills\run-alphatrack\*.png" -ErrorAction SilentlyContinue
```

Die Fixture-Daten in `data/checklist-log-<PROFILE_ID>.json` können stehen bleiben (reale Nutzdaten des Test-Profils) oder auf Wunsch des Nutzers zurückgesetzt werden — keine Code-Änderung, kein Commit in diesem Task nötig.
