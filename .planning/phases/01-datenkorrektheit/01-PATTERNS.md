# Phase 1: Datenkorrektheit - Pattern Map

**Mapped:** 2026-06-09
**Files analyzed:** 10
**Analogs found:** 10 / 10

---

## File Classification

| Neue/Geänderte Datei | Rolle | Data Flow | Nächster Analog | Match-Qualität |
|----------------------|-------|-----------|-----------------|----------------|
| `src/types/trade.ts` | model | — | `src/types/trade.ts` selbst | exact (Erweiterung) |
| `src/lib/auth.ts` | utility | request-response | `src/lib/auth.ts` selbst | exact (Erweiterung) |
| `src/app/api/bridge/trades/route.ts` | controller | request-response | `src/app/api/bridge/trades/route.ts` selbst | exact (Erweiterung) |
| `src/app/api/bridge/heartbeat/route.ts` | controller | request-response | `src/app/api/bridge/heartbeat/route.ts` selbst | exact (Erweiterung) |
| `src/app/api/bridge/close-event/route.ts` | controller | request-response | `src/app/api/bridge/heartbeat/route.ts` | role-match |
| `bridge/trade_executor.py` | utility | — | `bridge/trade_executor.py` selbst | exact (1-Zeilen-Fix) |
| `src/app/bots/BotsClient.tsx` | component | — | `src/app/bots/BotsClient.tsx` selbst | exact (Entfernung) |
| `src/app/bots/[id]/BotDetailClient.tsx` | component | — | `src/app/bots/[id]/BotDetailClient.tsx` selbst | exact (Entfernung) |
| `src/components/bridge/WatchdogPanel.tsx` | component | — | `src/components/bridge/WatchdogPanel.tsx` selbst | exact (Entfernung) |
| `src/components/bridge/BridgeDashboardWidget.tsx` | component | — | `src/components/bridge/BridgeDashboardWidget.tsx` selbst | exact (Entfernung) |

---

## Pattern Assignments

### `src/types/trade.ts` (model — Felderweiterung)

**Analog:** `src/types/trade.ts` (Zeilen 1–28)

**Aktuelles Interface-Muster** (Zeilen 4–28):
```typescript
export interface Trade {
  id: string
  date: string
  closeTime?: string
  instrument: string
  type: TradeDirection
  entry: number
  exit?: number
  size: number
  // ... weitere Felder
  externalId?: string
  outcome?: 'win' | 'loss'
  botId?: string | null
}
```

**Änderung:** `sourceId?: string` als letztes optionales Feld nach `botId` einfügen. Optionales Feld (`?:`) für Rückwärtskompatibilität mit bestehenden 161 Trades ohne sourceId.

**Konvention:** Alle optionalen Felder nutzen `?:`. Neue Felder ans Ende des Interface anhängen (kein Alphabetisierungszwang).

---

### `src/lib/auth.ts` (utility — Funktionserweiterung)

**Analog:** `src/lib/auth.ts` (Zeilen 1–13) — vollständige Datei bereits gelesen

**Bestehendes Muster** (Zeilen 1–13):
```typescript
import { timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'

export function isValidApiKey(req: NextRequest): boolean {
  const provided = req.headers.get('x-bot-api-key') ?? ''
  const expected = process.env.BOT_API_KEY ?? ''
  if (!provided || provided.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(provided, 'utf-8'), Buffer.from(expected, 'utf-8'))
  } catch {
    return false
  }
}
```

**Entscheidung aus RESEARCH.md:** `isValidApiKey()` muss NICHT verändert werden. Die sourceId-Attribution erfolgt über `botId` im Trade-Payload, nicht über per-Bot API-Keys (es gibt nur einen globalen `BOT_API_KEY`). Diese Datei wird in Phase 1 **nicht geändert**.

**Verwendungsmuster in neuen Endpunkten — kopieren:**
```typescript
if (!isValidApiKey(req)) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```
Quelle: `src/app/api/bridge/trades/route.ts` Zeilen 53–55 und `src/app/api/bridge/heartbeat/route.ts` Zeilen 7–9.

---

### `src/app/api/bridge/trades/route.ts` (controller — Erweiterung normalizeTrade)

**Analog:** `src/app/api/bridge/trades/route.ts` selbst (Zeilen 43–50)

**Bestehende normalizeTrade-Funktion** (Zeilen 43–50):
```typescript
// Normalize a raw trade payload to a typed Trade, resolving bot_id attribution.
// Python sends snake_case bot_id; TypeScript stores as botId.
// Trades with no bot attribution (bridge sync) receive botId: null (C4).
function normalizeTrade(raw: Record<string, unknown>): Omit<Trade, 'id'> {
  const { bot_id, botId, ...rest } = raw as Record<string, unknown> & { bot_id?: string | null; botId?: string | null }
  const resolvedBotId = botId ?? bot_id ?? null
  return { ...rest, botId: resolvedBotId } as unknown as Omit<Trade, 'id'>
}
```

**Änderung — sourceId ableiten und hinzufügen:**
```typescript
function normalizeTrade(raw: Record<string, unknown>): Omit<Trade, 'id'> {
  const { bot_id, botId, ...rest } = raw as Record<string, unknown> & { bot_id?: string | null; botId?: string | null }
  const resolvedBotId = botId ?? bot_id ?? null
  const sourceId = resolvedBotId !== null ? resolvedBotId : 'bridge/tradeexecuter'
  return { ...rest, botId: resolvedBotId, sourceId } as unknown as Omit<Trade, 'id'>
}
```

**Rückwirkende Migration (D-01):** Beim POST-Handler nach `getBotTrades(profileId)` alle Trades ohne `sourceId` korrigieren:
```typescript
// Einmalige rückwirkende Korrektur: Trades ohne sourceId erhalten 'bridge/tradeexecuter'
// Guard: !t.sourceId verhindert Mehrfachanwendung (natürlicher Einmal-Guard laut RESEARCH Pitfall 5)
const needsMigration = existing.some(t => !t.sourceId)
if (needsMigration) {
  const migrated = existing.map(t => t.sourceId ? t : { ...t, sourceId: 'bridge/tradeexecuter' })
  saveBotTrades(profileId, migrated)
}
```

**Bestehende revalidatePath-Aufrufe** (Zeilen 143–146) — Muster beibehalten:
```typescript
revalidatePath('/dashboard')
revalidatePath('/journal')
revalidatePath('/statistiken')
```

---

### `src/app/api/bridge/heartbeat/route.ts` (controller — Fallback-Abgleich)

**Analog:** `src/app/api/bridge/heartbeat/route.ts` selbst (vollständige Datei, 50 Zeilen)

**Bestehendes Handler-Grundgerüst** (Zeilen 1–50):
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { saveBotStatus, addBridgeLogEntry, getBotById, getBotStatus, getBots } from '@/lib/bot-data'
import { BotStatus } from '@/types/bot'
import { isValidApiKey } from '@/lib/auth'

export async function POST(req: NextRequest) {
  if (!isValidApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // ... body parse, bridgeId resolve, saveBotStatus ...
  return NextResponse.json({ ok: true })
}
```

**Zu ergänzende Imports für reconcileOpenTrades:**
```typescript
import { getProfileTrades, saveProfileTrades } from '@/lib/profiles'
import { revalidatePath } from 'next/cache'
```

**reconcileOpenTrades-Funktion — nach saveBotStatus() einfügen:**

Die Funktion wird inline im Handler aufgerufen, nach `saveBotStatus()` (Zeile 36). `openTicketIds` kommt aus dem erweiterten Heartbeat-Payload (`status.openTicketIds?: number[]`). Falls nicht vorhanden (alte Bridge-Version): Funktion überspringen.

```typescript
function reconcileOpenTrades(profileId: string, openTicketIds: number[]): void {
  const trades = getProfileTrades(profileId)
  const ticketSet = new Set(openTicketIds.map(t => `pos_${t}`))
  let changed = false
  const updated = trades.map(t => {
    if (t.status === 'open' && t.externalId && !ticketSet.has(t.externalId)) {
      changed = true
      return { ...t, status: 'closed' as const }
    }
    return t
  })
  if (changed) {
    saveProfileTrades(profileId, updated)
    revalidatePath('/dashboard')
    revalidatePath('/journal')
  }
}
```

**Integration im POST-Handler** — nach `saveBotStatus()`-Aufruf (Zeile 36):
```typescript
// Heartbeat-Fallback: offene Trades abgleichen (D-11)
// profileId aus body lesen — Heartbeat-Payload muss profileId enthalten
if (body.profileId && Array.isArray(status.openTicketIds)) {
  reconcileOpenTrades(body.profileId, status.openTicketIds as number[])
}
```

**Konvention:** `addBridgeLogEntry()` für alle Zustandsänderungen verwenden (Zeilen 42–47 als Muster).

---

### `src/app/api/bridge/close-event/route.ts` (controller — NEUE DATEI)

**Analog:** `src/app/api/bridge/heartbeat/route.ts` (role-match, gleiche Struktur) und `src/app/api/bridge/trades/route.ts` (Dedup-Pattern)

**Vollständiges Datei-Muster — von heartbeat/route.ts kopieren:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { addBridgeLogEntry } from '@/lib/bot-data'
import { getProfileTrades, saveProfileTrades } from '@/lib/profiles'
import { isValidApiKey } from '@/lib/auth'

export async function POST(req: NextRequest) {
  if (!isValidApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    bridgeId: string
    profileId: string
    ticket: number
    exitPrice: number
    closeTime: string
    pnl?: number
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { bridgeId, profileId, ticket, exitPrice, closeTime, pnl } = body
  if (!bridgeId || !profileId || ticket == null || exitPrice == null || !closeTime) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // profileId-Validierung — Muster aus trades/route.ts Zeile 37
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(profileId)) {
    return NextResponse.json({ error: 'Invalid profileId' }, { status: 400 })
  }

  const externalId = `pos_${ticket}`
  const trades = getProfileTrades(profileId)
  const idx = trades.findIndex(t => t.externalId === externalId && t.status === 'open')

  if (idx === -1) {
    return NextResponse.json({ ok: true, updated: false })
  }

  const updated = [...trades]
  updated[idx] = {
    ...updated[idx],
    status: 'closed',
    exit: exitPrice,
    closeTime,
    ...(pnl !== undefined && { pnl }),
  }

  saveProfileTrades(profileId, updated)
  addBridgeLogEntry(bridgeId, 'info', `Trade geschlossen: pos_${ticket}`, `exitPrice: ${exitPrice}`)
  revalidatePath('/dashboard')
  revalidatePath('/journal')
  revalidatePath('/statistiken')

  return NextResponse.json({ ok: true, updated: true })
}
```

**Kritische Konventionen:**
- `isValidApiKey(req)` als erste Prüfung (Security — RESEARCH.md ASVS V4)
- `externalId`-Format: `pos_${ticket}` — exakt wie in `mt5_connector.py` und bestehenden Trades (RESEARCH Pitfall 3)
- `saveProfileTrades()` schreibt atomar via `atomicWrite()` intern (kein direktes fs.writeFileSync)
- `revalidatePath()` nach Mutation — gleiche Pfade wie trades/route.ts Zeilen 143–146
- `addBridgeLogEntry()` für alle Trade-Mutationen (Logging-Konvention aus heartbeat/route.ts)

---

### `bridge/trade_executor.py` (utility — 1-Zeilen-Fix)

**Analog:** `bridge/trade_executor.py` selbst (Zeile 88)

**Bestehend** (Zeile 88):
```python
"comment": "AlphaTrack Executor",
```

**Änderung:**
```python
"comment": "/bridge/tradeexecuter",
```

**Kontext** (Zeilen 80–91 — request-Dict):
```python
request = {
    "action": mt5.TRADE_ACTION_DEAL,
    "symbol": symbol,
    "volume": float(lots),
    "type": order_type,
    "price": price,
    "deviation": deviation,
    "magic": 20250101,
    "comment": "/bridge/tradeexecuter",  # geändert von "AlphaTrack Executor"
    "type_time": mt5.ORDER_TIME_GTC,
    "type_filling": filling_mode,
}
```

**Hinweis:** Zeile 183 (`"comment": "AlphaTrack Close"`) für Close-Orders bleibt unverändert — TRADES-03 betrifft nur die Trade-Executor-Eröffnungsorders.

---

### `src/app/bots/BotsClient.tsx` (component — Entfernung Zeile 172)

**Analog:** `src/app/bots/BotsClient.tsx` selbst

**Zu entfernende Zeile** (Zeile 172 im Stats-Grid):
```tsx
<Stat label="Synced" value={status?.tradesSync != null ? `${status.tradesSync} Trades` : '-'} />
```

**Kontext — Stats-Grid** (Zeilen 164–173):
```tsx
<div className="grid grid-cols-2 gap-2">
  <Stat label="Balance"    value={...} />
  <Stat label="Positionen" value={status?.openPositions?.toString() ?? '-'} />
  <Stat label="Uptime"     value={status?.uptime ? formatUptime(status.uptime) : '-'} />
  <Stat label="Synced"     value={status?.tradesSync != null ? `${status.tradesSync} Trades` : '-'} />  {/* ENTFERNEN */}
</div>
```

**Nach Entfernung:** Grid hat 3 statt 4 Einträge — `grid-cols-2` bleibt unverändert, letztes Feld fehlt einfach. Keine weiteren CSS-Anpassungen nötig.

---

### `src/app/bots/[id]/BotDetailClient.tsx` (component — Entfernung eines Array-Eintrags)

**Analog:** `src/app/bots/[id]/BotDetailClient.tsx` selbst

**Zu entfernender Eintrag** im stats-Array (Zeile 156):
```tsx
{ label: 'Trades gespeichert', value: String(status?.tradesSync ?? 0) },
```

**Kontext — Stats-Array** (Zeilen 148–157):
```tsx
{[
  { label: 'Bot-ID',             value: bot.id },
  { label: 'Name',               value: currentName },
  { label: 'Status',             value: status?.state ?? '—' },
  { label: 'Offene Trades',      value: String(status?.openPositions ?? 0) },
  { label: 'Profil',             value: profile?.name ?? '—' },
  { label: 'Balance',            value: status?.balance != null ? `...` : '—' },
  { label: 'Uptime',             value: status?.uptime ? `...` : '—' },
  { label: 'Trades gespeichert', value: String(status?.tradesSync ?? 0) },  // ENTFERNEN
].map(s => (...))}
```

**Nach Entfernung:** Array hat 7 statt 8 Einträge — `grid-cols-2 sm:grid-cols-4` (Zeile 147) bleibt unverändert.

---

### `src/components/bridge/WatchdogPanel.tsx` (component — Entfernung eines Array-Eintrags)

**Analog:** `src/components/bridge/WatchdogPanel.tsx` selbst

**Zu entfernender Eintrag** im inline-Array (Zeile 82):
```tsx
{ Icon: Layers, label: 'Sync', value: `${status.tradesSync} Trades`, color: 'var(--text-1)' },
```

**Kontext — Stats-Array** (Zeilen 78–82):
```tsx
{[
  { Icon: Cpu,        label: 'MT5',      value: status.mt5Connected ? 'Verbunden' : 'Getrennt', color: status.mt5Connected ? 'var(--green)' : 'var(--red)' },
  { Icon: Clock,      label: 'Laufzeit', value: fmt(status.uptime), color: 'var(--text-1)' },
  { Icon: TrendingUp, label: 'Offen',    value: `${status.openPositions} Position${...}`, color: ... },
  { Icon: Layers,     label: 'Sync',     value: `${status.tradesSync} Trades`, color: 'var(--text-1)' },  // ENTFERNEN
].map(...)}
```

**Import-Bereinigung:** Nach Entfernung des `Layers`-Eintrags den `Layers`-Import in Zeile 4 ebenfalls entfernen, falls er sonst unbenutzt ist:
```tsx
// Zeile 4 — Layers aus dem Import entfernen:
import { Wifi, WifiOff, AlertTriangle, Bot, Cpu, Clock, TrendingUp } from 'lucide-react'
```

**Nach Entfernung:** Grid hat 3 statt 4 Einträge — `grid-cols-2` (Zeile 77) bleibt unverändert.

---

### `src/components/bridge/BridgeDashboardWidget.tsx` (component — Entfernung totalSync + Anzeige)

**Analog:** `src/components/bridge/BridgeDashboardWidget.tsx` selbst

**Zu entfernende Berechnung** (Zeile 34):
```tsx
const totalSync = bots.reduce((s, b) => s + (b.status?.tradesSync ?? 0), 0)
```

**Zu entfernender JSX-Block** (Zeilen 90–93):
```tsx
<div className="text-center">
  <p className="text-lg font-bold font-mono leading-none" style={{ color: 'var(--text-1)' }}>{totalSync}</p>
  <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Synced</p>
</div>
```

**Kontext:** Dieser Block steht im `flex items-center gap-4`-Container (Zeile 85) zusammen mit dem `totalOpen`-Block. Nach Entfernung bleibt nur der `Offen`-Zähler übrig — `gap-4` und `shrink-0` auf dem Container bleiben unverändert.

---

## Shared Patterns

### Auth-Guard (gilt für alle neuen/geänderten API-Routen)

**Quelle:** `src/lib/auth.ts` Zeilen 4–13 + Verwendung in `src/app/api/bridge/heartbeat/route.ts` Zeilen 7–9

```typescript
// Immer als erstes im POST-Handler:
if (!isValidApiKey(req)) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

**Anwenden auf:** `src/app/api/bridge/close-event/route.ts` (neue Datei), `src/app/api/bridge/heartbeat/route.ts` (bereits vorhanden).

### JSON-Body-Parsing mit try/catch

**Quelle:** `src/app/api/bridge/heartbeat/route.ts` Zeilen 11–15

```typescript
let body: { ... }
try {
  body = await req.json()
} catch {
  return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
}
```

**Anwenden auf:** `src/app/api/bridge/close-event/route.ts`.

### profileId-Validierung (Regex-Guard)

**Quelle:** `src/app/api/bridge/trades/route.ts` Zeilen 37–39

```typescript
if (!/^[a-zA-Z0-9_-]{1,64}$/.test(profileId)) {
  return NextResponse.json({ error: 'Invalid profileId' }, { status: 400 })
}
```

**Anwenden auf:** `src/app/api/bridge/close-event/route.ts`.

### Cache-Invalidierung nach Trade-Mutation

**Quelle:** `src/app/api/bridge/trades/route.ts` Zeilen 143–146

```typescript
revalidatePath('/dashboard')
revalidatePath('/journal')
revalidatePath('/statistiken')
```

**Anwenden auf:** `src/app/api/bridge/close-event/route.ts` und `src/app/api/bridge/heartbeat/route.ts` (nach reconcileOpenTrades).

**Achtung (RESEARCH Pitfall 1):** `saveProfileTrades()` in `src/lib/profiles.ts` ruft `_statsCache = null` NICHT auf. `_statsCache` liegt in `src/lib/data.ts` — anderem Modul. Daher `revalidatePath()` nach jeder Mutation zwingend aufrufen.

### Logging via addBridgeLogEntry

**Quelle:** `src/app/api/bridge/heartbeat/route.ts` Zeilen 41–47

```typescript
addBridgeLogEntry(resolvedId, 'info', 'Nachricht', `Details: ${variable}`)
addBridgeLogEntry(resolvedId, 'error', 'Fehlermeldung', `State: ${status.state}`)
addBridgeLogEntry(resolvedId, 'warn', 'Warnung', 'Details')
```

**Anwenden auf:** `src/app/api/bridge/close-event/route.ts` für Trade-Close-Ereignisse.

### externalId-Format für Ticket-Mapping

**Quelle:** `bridge/mt5_connector.py` (verifiziert durch RESEARCH Pitfall 3)

```typescript
// TypeScript-Seite:
const externalId = `pos_${ticket}`  // ticket ist number

// Python-Seite (bridge/mt5_connector.py Zeile 95):
// "externalId": f"pos_{p.ticket}"
```

**Anwenden auf:** `src/app/api/bridge/close-event/route.ts` und `reconcileOpenTrades()` in heartbeat/route.ts.

---

## Keine Analogs nötig (Entfernungen)

Die vier UI-Cleanup-Dateien (BotsClient.tsx, BotDetailClient.tsx, WatchdogPanel.tsx, BridgeDashboardWidget.tsx) erfordern nur das Entfernen einzelner JSX-Elemente/-Zeilen. Die bestehenden Dateien selbst sind der Analog — kein externer Referenzcode nötig.

---

## Metadata

**Analog-Suchbereich:** `src/app/api/bridge/`, `src/lib/`, `src/types/`, `src/app/bots/`, `src/components/bridge/`, `bridge/`
**Gescannte Dateien:** 10
**Pattern-Extraction-Datum:** 2026-06-09
