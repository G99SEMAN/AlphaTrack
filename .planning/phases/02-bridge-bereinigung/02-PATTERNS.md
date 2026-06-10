# Phase 2: Bridge-Bereinigung — Pattern Map

**Mapped:** 2026-06-10
**Files analyzed:** 5 zu ändernde Dateien + 2 zu löschende Dateien
**Analogs found:** 5 / 5 (alle Dateien sind ihre eigenen Analogs — reine Bereinigungsphase)

---

## File Classification

| Datei | Rolle | Data Flow | Änderungsart | Analog |
|-------|-------|-----------|--------------|--------|
| `src/context/BotStatusContext.tsx` | provider | event-driven (polling) | Timeout-Filter in `poll()` einbauen | sich selbst |
| `src/app/bridge/BridgeClient.tsx` | component | request-response | `deleteBot()` + Trash-Icon entfernen | sich selbst |
| `src/app/bridge/log/BridgeLogClient.tsx` | component | request-response | `botFilter`-State + Filter-UI entfernen | sich selbst |
| `src/app/bridge/log/page.tsx` | route (server) | CRUD | `initialLogs`-Loop auf gefilterte `bots`-Liste umstellen | sich selbst |
| `src/components/layout/Sidebar.tsx` | component | — | BRIDGE_NAV-Eintrag löschen | sich selbst |
| `src/app/bridge/settings/page.tsx` | route (server) | — | **LÖSCHEN** (BRIDGE-04) | — |
| `src/app/bridge/settings/BridgeSettingsClient.tsx` | component | — | **LÖSCHEN** (BRIDGE-04) | — |

---

## Pattern Assignments

### `src/context/BotStatusContext.tsx` — Timeout-Filter (BRIDGE-01)

**Änderung:** `poll()`-Funktion erhält einen Heartbeat-Timeout-Filter. Bots deren `lastHeartbeat` älter als 30 Sekunden ist, werden aus dem State entfernt bevor `setBots` aufgerufen wird.

**Bestehende `poll()`-Funktion** (Zeilen 29–38) — wird so geändert:
```typescript
// VORHER (Zeilen 29–38):
const poll = useCallback(async () => {
  try {
    const res = await fetch('/api/bridge/status')
    if (!res.ok) return
    const data = await res.json()
    const next: BotWithStatus[] = data.bots ?? []
    setBots(prev => fingerprint(prev) === fingerprint(next) ? prev : next)
    setLastUpdated(new Date())
  } catch { /* silent */ }
}, [])
```

```typescript
// NACHHER — Konstante vor BotStatusProvider, poll() mit Timeout-Filter:
const HEARTBEAT_TIMEOUT_MS = 30_000

const poll = useCallback(async () => {
  try {
    const res = await fetch('/api/bridge/status')
    if (!res.ok) return
    const data = await res.json()
    const raw: BotWithStatus[] = data.bots ?? []
    const now = Date.now()
    const next = raw.filter(b => {
      if (!b.status?.lastHeartbeat) return false
      return now - new Date(b.status.lastHeartbeat).getTime() <= HEARTBEAT_TIMEOUT_MS
    })
    setBots(prev => fingerprint(prev) === fingerprint(next) ? prev : next)
    setLastUpdated(new Date())
  } catch { /* silent */ }
}, [])
```

**Kritische Details:**
- `HEARTBEAT_TIMEOUT_MS = 30_000` als Modulkonstante außerhalb der Komponente platzieren (Zeile ~18, nach `fingerprint`-Funktion)
- `b.status?.lastHeartbeat` — optionaler Chaining zwingend, da `status` laut Typ `BotStatusWithConnection | null` ist
- Bot mit `status === null` → `lastHeartbeat` ist `undefined` → `return false` → wird herausgefiltert (korrekt per D-01/D-03)
- `fingerprint()` (Zeilen 18–22) bleibt unverändert — der Filter greift vor dem fingerprint-Vergleich

---

### `src/app/bridge/BridgeClient.tsx` — Trash-Icon + deleteBot() entfernen (BRIDGE-02)

**Drei zusammenhängende Entfernungen:**

**1. Import-Zeile** (Zeile 5) — nur `Trash2` entfernen:
```typescript
// VORHER (Zeile 5):
import { Bot, Trash2, TrendingUp, Search, Edit2, Check, X } from 'lucide-react'

// NACHHER:
import { Bot, TrendingUp, Search, Edit2, Check, X } from 'lucide-react'
```

**2. `deleteBot()`-Funktion** (Zeilen 43–47) — vollständig entfernen:
```typescript
// ENTFERNEN (Zeilen 43–47):
async function deleteBot(id: string) {
  if (!confirm('Bot wirklich entfernen?')) return
  await fetch(`/api/bots/${id}`, { method: 'DELETE' })
  refresh()
}
```

**3. Trash-Button im JSX** (Zeilen 144–148) — vollständig entfernen:
```typescript
// ENTFERNEN (Zeilen 144–148) — innerer <button> innerhalb des Tab-Buttons:
<button onClick={e => { e.stopPropagation(); deleteBot(bot.id) }}
  className="ml-1 opacity-40 hover:opacity-80 cursor-pointer"
  title="Bot entfernen">
  <Trash2 size={12} />
</button>
```

**Kontext des Tab-Buttons** (Zeilen 134–149) nach der Bereinigung:
```typescript
<button key={bot.id}
  onClick={() => setSelectedBotId(bot.id)}
  className="flex items-center gap-2.5 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-all"
  style={{ ... }}>
  <span className="rounded-full shrink-0" style={{ ... }} />
  {bot.name}
  {/* Trash2-Button hier entfernt */}
</button>
```

**Hinweis:** `/api/bots/[id]` DELETE-Route bleibt erhalten — wird von Phase 3 noch benötigt.

---

### `src/app/bridge/log/BridgeLogClient.tsx` — botFilter entfernen (BRIDGE-03)

**Fünf zusammenhängende Entfernungen:**

**1. `botFilter`-State** (Zeile 66) — Zeile vollständig entfernen:
```typescript
// ENTFERNEN (Zeile 66):
const [botFilter, setBotFilter] = useState<string>('all')
```

**2. Filter-Logik in `filtered`** (Zeile 107) — nur diese eine Zeile entfernen:
```typescript
// VORHER (Zeilen 105–117):
const filtered = allEntries.filter(e => {
  if (levelFilter !== 'all' && e.level !== levelFilter) return false
  if (botFilter !== 'all' && e.botId !== botFilter) return false  // ← ENTFERNEN
  if (search.trim()) { ... }
  return true
})

// NACHHER:
const filtered = allEntries.filter(e => {
  if (levelFilter !== 'all' && e.level !== levelFilter) return false
  if (search.trim()) {
    const q = search.trim().toLowerCase()
    if (
      !e.message.toLowerCase().includes(q) &&
      !(e.details ?? '').toLowerCase().includes(q) &&
      !(e.botName ?? '').toLowerCase().includes(q)
    ) return false
  }
  return true
})
```

**3. Trennlinie zwischen Level- und Bot-Filter** (Zeile 238) — Zeile entfernen:
```typescript
// ENTFERNEN (Zeile 238):
<div className="h-4 w-px" style={{ background: 'var(--border)' }} />
```

**4. Bot-Filter-Block** (Zeilen 241–269) — vollständig entfernen:
```typescript
// ENTFERNEN (Zeilen 241–269):
{/* Bot-Filter */}
<div className="flex items-center gap-1.5 flex-wrap">
  <button onClick={() => setBotFilter('all')} ...>Alle Bots</button>
  {bots.map(bot => (
    <button key={bot.id} onClick={() => setBotFilter(bot.id)} ...>
      {bot.name}
    </button>
  ))}
</div>
```

**5. `(gefiltert)`-Anzeige** (Zeile 348) — `botFilter`-Term entfernen:
```typescript
// VORHER (Zeile 348):
{(levelFilter !== 'all' || botFilter !== 'all' || search) && (

// NACHHER:
{(levelFilter !== 'all' || !!search) && (
```

**Kritischer Hinweis (Pitfall 1):** TypeScript kompiliert nicht wenn `botFilter !== 'all'` in Zeile 348 vergessen wird. `npm run build` nach der Änderung ist Pflicht.

**Was bleibt unverändert:**
- `Props { bots: BotEntry[]; initialLogs: ... }` — `bots`-Prop bleibt (wird in `fetchAll` Zeile 76 und `botName`-Anzeige Zeile 377 gebraucht)
- Level-Filter (Zeilen 216–236) — vollständig erhalten
- Suchfeld (Zeilen 193–213) — vollständig erhalten
- Log-Lösch-Button (`<Trash2 size={13} />` Zeile 335) — bleibt erhalten (gehört zur Log-Verwaltung, nicht zum Bot-Filter)

---

### `src/app/bridge/log/page.tsx` — initialLogs auf Bridge-only (BRIDGE-03)

**Änderung:** `initialLogs`-Loop iteriert aktuell über `allBots` (Zeile 22), muss auf die gefilterte `bots`-Liste umgestellt werden. Dafür muss `bots` vor dem Loop definiert werden.

**Betroffene Zeilen 20–25:**
```typescript
// VORHER (Zeilen 20–25):
const allBots = getBots()
const initialLogs: Record<string, ReturnType<typeof getBridgeLog>> = {}
for (const bot of allBots) {
  initialLogs[bot.id] = getBridgeLog(bot.id)
}
const bots = allBots.filter(bot => bot.type === 'bridge' || !bot.type)

// NACHHER:
const allBots = getBots()
const bots = allBots.filter(bot => bot.type === 'bridge' || !bot.type)
const initialLogs: Record<string, ReturnType<typeof getBridgeLog>> = {}
for (const bot of bots) {
  initialLogs[bot.id] = getBridgeLog(bot.id)
}
```

**Einzige Änderung:** Reihenfolge der Definitionen tauschen — `bots` vor dem `initialLogs`-Loop, dann `for (const bot of bots)` statt `for (const bot of allBots)`.

---

### `src/components/layout/Sidebar.tsx` — Bridge-Settings-Link entfernen (BRIDGE-04)

**Änderung:** Zeile 34 aus `BRIDGE_NAV`-Array entfernen.

**BRIDGE_NAV** (Zeilen 31–35) — ein Eintrag entfernen:
```typescript
// VORHER (Zeilen 31–35):
const BRIDGE_NAV = [
  { href: '/bridge',          label: 'Bridge',          icon: Cpu },
  { href: '/bridge/log',      label: 'Bridge Log',      icon: ScrollText },
  { href: '/bridge/settings', label: 'Bridge Settings', icon: SlidersHorizontal },
]

// NACHHER:
const BRIDGE_NAV = [
  { href: '/bridge',     label: 'Bridge',     icon: Cpu },
  { href: '/bridge/log', label: 'Bridge Log', icon: ScrollText },
]
```

**Import bleibt unverändert (Pitfall 4):** `SlidersHorizontal` wird weiterhin in `BOTS_NAV` Zeile 40 verwendet:
```typescript
{ href: '/bots/settings', label: 'Bot Settings', icon: SlidersHorizontal },
```
Den Import `SlidersHorizontal` in Zeile 8 **nicht** entfernen.

---

### Zu löschende Dateien (BRIDGE-04)

| Datei | Aktion |
|-------|--------|
| `src/app/bridge/settings/page.tsx` | Löschen — Next.js App Router zeigt automatisch 404 |
| `src/app/bridge/settings/BridgeSettingsClient.tsx` | Löschen |

Kein Redirect nötig — Next.js handhabt fehlende Routen automatisch.

---

## Shared Patterns

### Muster: State-Entfernung in Client Components

**Quelle:** Phase 1 — `tradesSync`-Feld aus 4 Komponenten entfernt (analoges Muster)
**Anwenden bei:** `BridgeLogClient.tsx` (botFilter-State)

Vorgehen:
1. State-Deklaration entfernen
2. Alle Verwendungen der State-Variable im JSX entfernen
3. Alle Verwendungen in Logik entfernen (filter-Funktion)
4. TypeScript-Build laufen lassen — kompilierungsfehler zeigen vergessene Stellen

### Muster: fingerprint-basiertes setState

**Quelle:** `src/context/BotStatusContext.tsx` Zeilen 18–22 + 35
**Anwenden bei:** Timeout-Filter in `poll()` — `next` wird gefiltert bevor fingerprint-Vergleich

```typescript
// Pattern: fingerprint verhindert unnötige Re-Renders
setBots(prev => fingerprint(prev) === fingerprint(next) ? prev : next)
```

Der Timeout-Filter greift auf `raw` (ungefilterte API-Antwort) an und erzeugt `next` (gefiltert). Der fingerprint-Vergleich danach bleibt unverändert.

### Muster: Atomic Array-Konstante außerhalb Komponente

**Quelle:** `src/app/bridge/BridgeClient.tsx` Zeile 22
```typescript
const filterBridge = (list: BotWithStatus[]) => list.filter(b => !b.bot.type || b.bot.type === 'bridge')
```
**Anwenden bei:** `HEARTBEAT_TIMEOUT_MS = 30_000` — ebenfalls als Modulkonstante außerhalb der Komponente definieren.

---

## No Analog Found

Keine — alle Dateien sind bekannte, vollständig gelesene Dateien. Phase 2 erstellt keine neuen Dateien.

---

## Metadata

**Gelesene Dateien:**
- `src/context/BotStatusContext.tsx` (73 Zeilen, vollständig)
- `src/app/bridge/BridgeClient.tsx` (234 Zeilen, vollständig)
- `src/app/bridge/log/BridgeLogClient.tsx` (509 Zeilen, vollständig)
- `src/app/bridge/log/page.tsx` (33 Zeilen, vollständig)
- `src/components/layout/Sidebar.tsx` (Zeilen 1–60, relevanter Bereich)

**Pattern-Extraktion:** 2026-06-10
**Build-Validierung:** `npm run build` nach jeder Dateiänderung (TypeScript-Kompilierung als Proxy für Korrektheit)
