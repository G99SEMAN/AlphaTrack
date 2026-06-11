# Phase 3: Bot-Verbesserungen - Pattern Map

**Mapped:** 2026-06-11
**Files analyzed:** 6 neue/geänderte Dateien
**Analogs found:** 6 / 6

---

## File Classification

| Neue/Geänderte Datei | Role | Data Flow | Closest Analog | Match Quality |
|----------------------|------|-----------|----------------|---------------|
| `src/app/api/bots/[id]/stats/route.ts` | API route | request-response | `src/app/api/bots/[id]/log/route.ts` | exact |
| `src/app/api/bridge/command/route.ts` | API route | request-response | selbst (Erweiterung) | exact |
| `src/app/api/bridge/heartbeat/route.ts` | API route | request-response | selbst (Erweiterung) | exact |
| `src/types/bot.ts` | type definition | — | selbst (Erweiterung) | exact |
| `src/app/bots/BotsClient.tsx` | client component | request-response | selbst (Umbau) | exact |
| `src/app/bots/settings/BotsSettingsClient.tsx` | client component | request-response | selbst (Umbau) | exact |

---

## Pattern Assignments

### `src/app/api/bots/[id]/stats/route.ts` (API route, request-response) — NEU

**Analog:** `src/app/api/bots/[id]/log/route.ts`

**Imports pattern** (log/route.ts Zeilen 1–7):
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getBotById } from '@/lib/bot-data'
// Zusätzlich für Stats:
import { getProfileTrades } from '@/lib/profiles'
import { getProfiles } from '@/lib/profiles'
```

**Core pattern** (log/route.ts Zeilen 9–15 als Vorlage):
```typescript
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const bot = getBotById(id)
  if (!bot) return NextResponse.json({ error: 'Bot nicht gefunden' }, { status: 404 })
  // Stats-Logik:
  const trades = getProfileTrades(bot.profileId)
  const botTrades = trades.filter(t => t.sourceId === id)
  const openCount = botTrades.filter(t => t.status === 'open').length
  const tradeCount = botTrades.length
  const closedWithPnl = botTrades.filter(t => t.status === 'closed' && t.pnl !== undefined)
  const realizedPnl = closedWithPnl.length > 0
    ? closedWithPnl.reduce((sum, t) => sum + (t.pnl ?? 0), 0)
    : null   // null = keine geschlossenen Trades (D-06: "-" anzeigen, nicht "0.00")
  const profile = getProfiles().find(p => p.id === bot.profileId)
  return NextResponse.json({ openCount, tradeCount, realizedPnl, currency: profile?.currency ?? 'EUR' })
}
```

**Error handling pattern** (log/route.ts Zeilen 27–28):
```typescript
// JSON-Parse-Fehler:
return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
// Bot nicht gefunden:
return NextResponse.json({ error: 'Bot nicht gefunden' }, { status: 404 })
```

**Kritischer Hinweis (Pitfall 1 aus RESEARCH.md):**
`getProfileTrades(bot.profileId)` aus `src/lib/profiles.ts` verwenden — NICHT `getTrades()` aus `src/lib/data.ts`.
`data.ts` liest `data/trades.json` (hardcodiert), `profiles.ts` liest `data/trades-{profileId}.json` (korrekt).

---

### `src/app/api/bridge/command/route.ts` (API route, request-response) — ÄNDERN

**Analog:** selbst (bestehende Datei erweitern)

**Imports pattern** (Zeilen 1–4) — Import `SetParametersPayload` hinzufügen:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { addBotCommand, pruneOldCommands, addBridgeLogEntry, getBotById } from '@/lib/bot-data'
import { BotCommandType, TradeOrderPayload, ClosePositionPayload, SetParametersPayload } from '@/types/bot'
import { isSameOriginRequest } from '@/lib/auth'
```

**VALID_COMMANDS erweitern** (Zeile 6):
```typescript
// Vorher:
const VALID_COMMANDS: BotCommandType[] = ['start', 'stop', 'pause', 'resume', 'execute_trade', 'close_position', 'restart']
// Nachher:
const VALID_COMMANDS: BotCommandType[] = ['start', 'stop', 'pause', 'resume', 'execute_trade', 'close_position', 'restart', 'set_parameters']
```

**Body-Typ erweitern** (Zeile 13):
```typescript
let body: { bridgeId: string; command: BotCommandType; payload?: TradeOrderPayload | ClosePositionPayload | SetParametersPayload }
```

**Validierungsblock hinzufügen** (nach Zeile 40, nach dem close_position-Block):
```typescript
if (command === 'set_parameters') {
  const p = payload as SetParametersPayload | undefined
  if (!p?.parameters || typeof p.parameters !== 'object' || Array.isArray(p.parameters)) {
    return NextResponse.json({ error: 'set_parameters requires parameters object' }, { status: 400 })
  }
}
```

**Hinweis (Pitfall 4 aus RESEARCH.md):**
`addBotCommand(bridgeId, command)` bleibt unverändert — Payload wird direkt via `flaskBody.payload = payload` an Flask weitergeleitet (Zeilen 59–60). Keine Änderung an `addBotCommand` nötig.

---

### `src/app/api/bridge/heartbeat/route.ts` (API route, request-response) — ÄNDERN

**Analog:** selbst (bestehende Datei erweitern)

**Body-Typ erweitern** (Zeile 36) — `parameters` ist Teil von `BotStatus` nach Typ-Erweiterung, kein Extra-Handling nötig:
```typescript
// Zeile 36 — body-Typ: BotStatus bekommt parameters? aus src/types/bot.ts
let body: { bridgeId: string; status: BotStatus & { openTicketIds?: number[] }; profileId?: string }
// Keine weitere Änderung nötig — saveBotStatus(resolvedId, { ...status, lastHeartbeat: ... })
// speichert bereits das gesamte status-Objekt inkl. parameters (Zeile 61)
```

**Kernaussage:** Die Heartbeat-Route muss NICHT manuell geändert werden, wenn `BotStatus` in `src/types/bot.ts` das optionale `parameters?`-Feld bekommt. `saveBotStatus` auf Zeile 61 persistiert `{ ...status, lastHeartbeat: ... }` — `parameters` wird automatisch mitgespeichert.

**Auth-Pattern** (Zeilen 32–34) — unverändert übernehmen:
```typescript
if (!isValidApiKey(req)) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

---

### `src/types/bot.ts` (type definition) — ÄNDERN

**Analog:** selbst (bestehende Datei erweitern)

**BotCommandType erweitern** (Zeile 5):
```typescript
// Vorher:
export type BotCommandType = 'start' | 'stop' | 'pause' | 'resume' | 'execute_trade' | 'close_position' | 'restart'
// Nachher:
export type BotCommandType = 'start' | 'stop' | 'pause' | 'resume' | 'execute_trade' | 'close_position' | 'restart' | 'set_parameters'
```

**BotStatus erweitern** (nach Zeile 52, nach `currency?`):
```typescript
export interface BotStatus {
  state: BotState
  lastHeartbeat: string
  bridgeVersion: string
  mt5Connected: boolean
  activeSymbols: string[]
  openPositions: number
  tradesSync: number
  uptime: number
  balance?: number
  currency?: string
  parameters?: Record<string, string | number | boolean>  // NEU — D-07, D-08
}
```

**Neuer Payload-Typ hinzufügen** (nach `ClosePositionPayload`, Zeile 9 — analog zu `TradeOrderPayload`):
```typescript
export interface SetParametersPayload {
  parameters: Record<string, string | number | boolean>
}
```

**Neues Stats-Interface** (inline in route.ts oder hier):
```typescript
export interface BotStats {
  openCount: number
  tradeCount: number
  realizedPnl: number | null  // null = keine geschlossenen Trades (D-06)
  currency: string
}
```

---

### `src/app/bots/BotsClient.tsx` (client component, request-response) — ÄNDERN

**Analog:** selbst (bestehende Datei umbauen)

**Imports erweitern** (Zeilen 1–9) — `useEffect` ist bereits importiert; `BotStats` hinzufügen:
```typescript
import { useState, useCallback, useEffect } from 'react'
import { BotWithStatus, ConnectionState, BotState, BotStats } from '@/types/bot'
import { currencySymbol } from '@/lib/currency'
```

**Stat-Komponente erweitern** (Zeilen 201–208) — `valueColor`-Prop hinzufügen:
```typescript
// Vorher:
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl px-3 py-2" style={{ background: 'var(--bg)' }}>
      <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-3)' }}>{label}</p>
      <p className="text-sm font-bold truncate" style={{ color: 'var(--text-1)' }}>{value}</p>
    </div>
  )
}
// Nachher (valueColor optional hinzufügen):
function Stat({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="rounded-xl px-3 py-2" style={{ background: 'var(--bg)' }}>
      <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-3)' }}>{label}</p>
      <p className="text-sm font-bold truncate" style={{ color: valueColor ?? 'var(--text-1)' }}>{value}</p>
    </div>
  )
}
```

**Stats-Polling State + useEffect** (nach dem `refresh`-useEffect, Zeilen 82–85 als Muster):
```typescript
const [stats, setStats] = useState<Record<string, BotStats>>({})

useEffect(() => {
  async function fetchStats() {
    const results = await Promise.allSettled(
      bots.map(async ({ bot }) => {
        const res = await fetch(`/api/bots/${bot.id}/stats`)
        if (!res.ok) return null
        return { id: bot.id, data: await res.json() as BotStats }
      })
    )
    const next: Record<string, BotStats> = {}
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        next[r.value.id] = r.value.data
      }
    }
    setStats(next)
  }
  fetchStats()
  const id = setInterval(fetchStats, 8000)
  return () => clearInterval(id)
}, [bots])
```

**P&L-Formatierungs-Helfer** (inline in Komponente, konsistent mit Journal-Farben):
```typescript
function formatPnl(realizedPnl: number | null, currency: string): { value: string; color: string } {
  if (realizedPnl === null) return { value: '-', color: 'var(--text-3)' }
  if (realizedPnl > 0) return { value: `+${realizedPnl.toFixed(2)} ${currencySymbol(currency)}`, color: 'var(--green)' }
  if (realizedPnl < 0) return { value: `${realizedPnl.toFixed(2)} ${currencySymbol(currency)}`, color: '#ef4444' }
  return { value: `+0.00 ${currencySymbol(currency)}`, color: 'var(--text-1)' }
}
```

**Stats-Grid umbauen** (Zeilen 164–172 — Balance ersetzen, Trades hinzufügen):
```typescript
// Vorher (3 Stats: Balance, Positionen, Uptime):
<div className="grid grid-cols-2 gap-2">
  <Stat label="Balance" value={...} />
  <Stat label="Positionen" value={status?.openPositions?.toString() ?? '-'} />
  <Stat label="Uptime" value={...} />
</div>

// Nachher (4 Stats: P&L, Positionen, Trades, Uptime):
const botStats = stats[bot.id]
const pnl = formatPnl(botStats?.realizedPnl ?? null, botStats?.currency ?? profile?.currency ?? 'EUR')
<div className="grid grid-cols-2 gap-2">
  <Stat label="P&L" value={pnl.value} valueColor={pnl.color} />
  <Stat label="Positionen" value={botStats?.openCount?.toString() ?? '-'} />
  <Stat label="Trades" value={botStats?.tradeCount?.toString() ?? '-'} />
  <Stat label="Uptime" value={status?.uptime ? formatUptime(status.uptime) : '-'} />
</div>
```

**Hinweis (Pitfall 3 aus RESEARCH.md):** `stats` als `Record<string, BotStats>` führen. Beim Rendern nur `stats[bot.id]` lesen — verschwundene Bots hinterlassen veraltete Einträge, die aber nie gerendert werden (kein Bot in der Liste = kein Render).

---

### `src/app/bots/settings/BotsSettingsClient.tsx` (client component, request-response) — ÄNDERN

**Analog:** selbst (bestehende Datei umbauen)

**Imports bereinigen** (Zeilen 1–7):
```typescript
// Vorher:
import { Pencil, Trash2, Check, X, AnimatePresence } from 'framer-motion/lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, Pencil, Trash2, Check, X, ExternalLink, Wifi, WifiOff } from 'lucide-react'

// Nachher (Pencil, Trash2, X entfernen; AnimatePresence entfernen; Check behalten für Parameter-senden-Button):
import { useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Bot, Check, ExternalLink, Wifi, WifiOff } from 'lucide-react'
import { BotWithStatus } from '@/types/bot'
import { Profile } from '@/types/profile'
```

**State bereinigen** (Zeilen 23–26) — editing, saving, deleting, error komplett entfernen:
```typescript
// Vorher:
const [editing, setEditing] = useState<EditState | null>(null)
const [saving, setSaving] = useState(false)
const [deleting, setDeleting] = useState<string | null>(null)
const [error, setError] = useState<string | null>(null)

// Nachher — nur Parameter-Draft-State pro Bot:
const [drafts, setDrafts] = useState<Record<string, Record<string, string | number | boolean>>>({})
const [sending, setSending] = useState<string | null>(null)  // botId während Send
```

**filterBots erweitern** (Zeile 21) — D-14: offline Bots ausblenden:
```typescript
// Vorher:
const filterBots = (list: BotWithStatus[]) => list.filter(b => b.bot.type === 'bot')
// Nachher:
const filterBots = (list: BotWithStatus[]) =>
  list.filter(b => b.bot.type === 'bot' && b.status?.connectionState !== 'offline')
```

**startEdit / saveEdit / deleteBot entfernen** (Zeilen 38–79) — vollständig löschen.

**Parameter-senden-Funktion** (neu, Muster aus command/route.ts fetch-Pattern):
```typescript
async function sendParameters(botId: string) {
  const parameters = drafts[botId]
  if (!parameters) return
  setSending(botId)
  try {
    const res = await fetch('/api/bridge/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bridgeId: botId, command: 'set_parameters', payload: { parameters } }),
    })
    if (!res.ok) {
      const data = await res.json()
      console.error('[BotsSettings] Parameter senden fehlgeschlagen:', data.error)
    }
  } catch (err) {
    console.error('[BotsSettings] Netzwerkfehler:', err)
  } finally {
    setSending(null)
  }
}
```

**View-Branch (isEditing-Branch entfernen)** — `AnimatePresence` entfernen, nur noch eine View:
```typescript
// Vorher: AnimatePresence mit isEditing ? <edit-view> : <view-view>
// Nachher: Direkt <motion.div key="view"> ohne AnimatePresence-Wrapper
<motion.div key={bot.id} layout
  className="rounded-2xl p-4 flex flex-col gap-4"
  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

  {/* Bot-Info read-only (D-13) */}
  <div className="flex items-center gap-4 flex-wrap">
    <span className="shrink-0 rounded-full block"
      style={{ width: 8, height: 8, background: dotColor, boxShadow: `0 0 5px ${dotColor}` }} />
    <div className="flex-1 min-w-0">
      <p className="font-bold text-sm" style={{ color: 'var(--text-1)' }}>{bot.name}</p>
      <p className="text-[11px] font-mono truncate mt-0.5" style={{ color: 'var(--text-3)' }}>{bot.url}</p>
    </div>
    {/* Verbindungsstatus (kein Pencil, kein Trash) */}
    <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-3)' }}>
      {conn === 'connected'
        ? <><Wifi size={11} style={{ color: 'var(--green)' }} /> Online</>
        : <><WifiOff size={11} style={{ color: '#ef4444' }} /> Offline</>}
    </span>
  </div>

  {/* Parameter-Editor (D-10, D-11) */}
  {renderParameterEditor(bot.id, status?.parameters)}
</motion.div>
```

**Parameter-Editor-Render-Funktion** (Typ-Inferenz per D-10):
```typescript
function renderParameterEditor(
  botId: string,
  parameters: Record<string, string | number | boolean> | undefined
) {
  if (!parameters || Object.keys(parameters).length === 0) {
    return (
      <p className="text-xs" style={{ color: 'var(--text-3)' }}>
        Dieser Bot unterstützt keine konfigurierbaren Parameter.
      </p>
    )
  }
  const draft = drafts[botId] ?? parameters
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
        Parameter
      </p>
      {Object.entries(draft).map(([key, value]) => (
        <div key={key} className="flex items-center gap-3">
          <label className="text-xs font-semibold w-32 shrink-0" style={{ color: 'var(--text-2)' }}>{key}</label>
          {typeof value === 'boolean' ? (
            // Toggle (D-10)
            <button role="switch" aria-checked={value} aria-label={key}
              onClick={() => setDrafts(prev => ({ ...prev, [botId]: { ...(prev[botId] ?? parameters), [key]: !value } }))}
              className="relative shrink-0 rounded-full cursor-pointer transition-colors"
              style={{ width: 44, height: 24, background: value ? 'var(--green)' : 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <span className="absolute top-0.5 rounded-full transition-transform"
                style={{ width: 20, height: 20, background: '#fff', transform: value ? 'translateX(22px)' : 'translateX(2px)' }} />
            </button>
          ) : (
            // Number oder String (D-10)
            <input
              type={typeof value === 'number' ? 'number' : 'text'}
              value={value as string | number}
              onChange={e => {
                const next = typeof value === 'number' ? parseFloat(e.target.value) : e.target.value
                setDrafts(prev => ({ ...prev, [botId]: { ...(prev[botId] ?? parameters), [key]: next } }))
              }}
              className="flex-1 px-3 py-1.5 rounded-xl text-sm outline-none"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
            />
          )}
        </div>
      ))}
      {/* Pro-Bot-Button (D-15) */}
      <button
        onClick={() => sendParameters(botId)}
        disabled={sending === botId}
        className="self-start flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
        style={{ background: 'var(--accent)', color: '#fff' }}>
        <Check size={12} /> {sending === botId ? 'Wird gesendet...' : 'Parameter senden'}
      </button>
    </div>
  )
}
```

---

## Shared Patterns

### Auth — Same-Origin & API-Key
**Source:** `src/lib/auth.ts` (verwendet in command/route.ts Z.9–11 und heartbeat/route.ts Z.32–34)
**Apply to:** Alle API-Routen (stats/route.ts braucht `isSameOriginRequest`, heartbeat behält `isValidApiKey`)
```typescript
// Für Stats-Endpunkt (Frontend-Aufruf):
if (!isSameOriginRequest(req)) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
// Für Heartbeat (Bot-Aufruf):
if (!isValidApiKey(req)) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

### Error Handling in API Routes
**Source:** `src/app/api/bots/[id]/log/route.ts` Zeilen 26–28 + command/route.ts Zeilen 16–18
**Apply to:** stats/route.ts
```typescript
try {
  body = await req.json()
} catch {
  return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
}
```

### Polling-Refresh Pattern (Client Component)
**Source:** `src/app/bots/BotsClient.tsx` Zeilen 72–85
**Apply to:** BotsClient.tsx (stats-Polling), BotsSettingsClient.tsx (bot-Liste-Refresh)
```typescript
const refresh = useCallback(async () => {
  try {
    const res = await fetch('/api/bridge/status')
    if (res.ok) {
      const { bots: list } = await res.json()
      setBots(filterBots(list))
    }
  } catch { /* silent */ }
}, [])

useEffect(() => {
  const id = setInterval(refresh, 8000)
  return () => clearInterval(id)
}, [refresh])
```

### Logging — Bot-Aktionen
**Source:** `src/lib/bot-data.ts` — `addBridgeLogEntry(botId, level, message, details)`
**Apply to:** Alle API-Routen die Bot-Aktionen ausführen
```typescript
addBridgeLogEntry(bridgeId, 'info', `Command gesendet: ${command}`, logDetails)
addBridgeLogEntry(bridgeId, 'error', `Command fehlgeschlagen: ${command}`, errBody.error)
```

### P&L-Farben (CSS-Variablen)
**Source:** `src/app/bots/BotsClient.tsx` Zeilen 20, 35 (ConnectionBadge) + globals.css
**Apply to:** BotsClient.tsx P&L-Anzeige
```typescript
// Grün: 'var(--green)'
// Rot: '#ef4444'
// Neutral: 'var(--text-3)' für "-"
```

---

## No Analog Found

Alle Dateien haben direkte Analoge in der Codebasis. Keine Datei ohne Muster.

---

## Metadata

**Analog search scope:** `src/app/api/bots/`, `src/app/api/bridge/`, `src/app/bots/`, `src/types/`, `src/context/`
**Files scanned:** 6 Quelldateien direkt gelesen
**Pattern extraction date:** 2026-06-11
