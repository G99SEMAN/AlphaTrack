# Phase 3: Bot-Verbesserungen — Research

**Researched:** 2026-06-11
**Domain:** Next.js 15 / React 19 — Bot-UI, API-Endpunkte, TypeScript-Typen
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Metriken (offene Positionen, P&L, Trade-Anzahl) werden server-seitig aus den Trade-Daten berechnet — nicht aus dem Heartbeat-Payload.
**D-02:** Neuer API-Endpunkt `/api/bots/:id/stats` berechnet: openCount (Status=open), tradeCount (gesamt), realizedPnl (Summe closed-Trades).
**D-03:** Für die Trade-Filterung wird `bot.profileId` verwendet — liest `data/trades-{bot.profileId}.json` und filtert nach `sourceId === botId`.
**D-04:** Nur realisierter P&L: Summe des `pnl`-Felds aller Trades mit `sourceId = botId` und `status = 'closed'`.
**D-05:** Anzeige als Betrag mit Vorzeichen + Farbe: `+142.50 EUR` in grün / `-23.10 EUR` in rot.
**D-06:** Bot ohne geschlossene Trades → `-` anzeigen (nicht `0.00 EUR`).
**D-07:** Flexibler Key-Value-Store: `parameters?: Record<string, string | number | boolean>`.
**D-08:** Bot meldet seine aktuellen Parameter im Heartbeat-Payload (neues optionales Feld `parameters` in `BotStatus`).
**D-09:** Parameter-Updates per neuem Command-Typ `'set_parameters'` über bestehenden `/api/bridge/command` Endpunkt.
**D-10:** UI-Rendering per Typ-Inferenz: `number` → `<input type="number">`, `boolean` → Toggle/Checkbox, `string` → `<input type="text">`.
**D-11:** Wenn Bot keine Parameter meldet: Info-Text „Dieser Bot unterstützt keine konfigurierbaren Parameter."
**D-12:** Pencil-Button (Namens-Bearbeitung) und Trash-Button (Entfernen) aus `BotsSettingsClient.tsx` vollständig entfernen inkl. `editing`-State, `saveEdit()`, `deleteBot()`.
**D-13:** Bot-Info (Name, URL) bleibt read-only sichtbar.
**D-14:** Settings-Seite zeigt nur verbundene Bots (gleicher Heartbeat-Timeout-Filter wie BotStatusContext).
**D-15:** Pro Bot ein eigener „Parameter senden"-Button.

### Claude's Discretion

Keine — alle wesentlichen Entscheidungen sind in den Decisions gesperrt.

### Deferred Ideas (OUT OF SCOPE)

Keine — Diskussion blieb innerhalb des Phase-3-Scopes.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BOTS-01 | Bot-Positionsanzahl in Bot-Karte spiegelt tatsächlich offene Trades wider (nicht 0) | Neuer `/api/bots/:id/stats` Endpunkt; `getProfileTrades()` + `sourceId`-Filter liefert `openCount` |
| BOTS-02 | „Synced"-Feld in Bot-Karte ist entfernt | BEREITS ERLEDIGT — `BotsClient.tsx` zeigt kein Synced-Feld (verifiziert: Zeile 163–172 nur Balance/Positionen/Uptime) |
| BOTS-03 | Bot-Karte zeigt P&L des jeweiligen Bots statt Balance | Balance-`<Stat>` durch P&L-`<Stat>` ersetzen; Wert aus `/api/bots/:id/stats`; `valueColor`-Prop an `<Stat>` |
| BOTS-04 | Bot-Karte zeigt Gesamt-Trade-Anzahl des Bots | Neue `<Stat label="Trades">` aus `tradeCount` von `/api/bots/:id/stats` |
| BOTS-05 | Bot verschwindet automatisch wenn er sich trennt | BEREITS ERLEDIGT — `BotStatusContext.tsx` filtert nach `HEARTBEAT_TIMEOUT_MS = 30_000`; `BotsClient.tsx` filtert zusätzlich `connectionState !== 'offline'` (verifiziert: Zeile 69) |
| BOTS-06 | Bot-Entfernen-Button in Bot-Settings ist entfernt | `deleteBot()`-Funktion + Trash2-Button aus `BotsSettingsClient.tsx` löschen |
| BOTS-07 | Namens-Bearbeitung in Bot-Settings ist entfernt | `startEdit()`/`saveEdit()` + Pencil-Button aus `BotsSettingsClient.tsx` löschen; `BotDetailClient.tsx` hat ebenfalls Namens-Bearbeitung — laut CONTEXT.md prüfen ob auch dort entfernen |
| BOTS-08 | Editierbare Bot-Parameter mit Bestätigen-Button | Heartbeat speichert `parameters`; Settings-UI rendert Parameter per Typ-Inferenz; `set_parameters`-Command über `/api/bridge/command` |
</phase_requirements>

---

## Summary

Phase 3 ist ein reines Brownfield-Änderungspaket an drei UI-Dateien und drei Backend-Dateien. Die Codebasis ist gut strukturiert — alle benötigten Bausteine existieren bereits, sie müssen nur umverdrahtet werden.

**Zwei Requirements sind bereits erfüllt:** BOTS-02 (Synced-Feld entfernt, verifiziert in `BotsClient.tsx` Z.163–172) und BOTS-05 (Auto-Disappear, verifiziert durch `HEARTBEAT_TIMEOUT_MS`-Filter in `BotStatusContext.tsx` Z.38–41 und `filterBots` in `BotsClient.tsx` Z.69). Diese müssen in Wave 0 nur per UAT-Test bestätigt, nicht implementiert werden.

Der Kern der Phase ist: (1) neuer `GET /api/bots/:id/stats` Endpunkt der Trade-Daten aggregiert, (2) `BotsClient.tsx` pollt diesen Endpunkt und zeigt P&L + Trade-Anzahl statt Balance, (3) `BotsSettingsClient.tsx` wird von Edit/Delete-UI auf Parameter-Editor umgebaut, (4) Heartbeat-Route und Typen erweitern für `parameters`-Feld, (5) Command-Route akzeptiert `set_parameters`.

**Primary recommendation:** Stats-Endpunkt zuerst implementieren (unabhängig, testbar), dann UI-Änderungen in zwei Dateien sequenziell.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Metriken berechnen (openCount, tradeCount, realizedPnl) | API / Backend | — | Trade-Daten liegen server-seitig in JSON-Dateien; Client hat kein direktes File-System-Zugriff |
| Metriken anzeigen (P&L, Trades, Positionen) | Frontend (Client Component) | — | `BotsClient.tsx` ist bereits `'use client'`; pollt per fetch |
| Parameter vom Bot empfangen | API / Backend (Heartbeat) | — | `BotStatus` wird bei jedem Heartbeat-POST gespeichert |
| Parameter an Bot senden | API / Backend (Command-Route) | — | Bestehendes Command-Queue-Muster; Flask-Bot empfängt Commands |
| Parameter in Settings anzeigen/editieren | Frontend (Client Component) | — | `BotsSettingsClient.tsx` ist `'use client'`; lokaler State für Draft-Werte |
| Auto-Disappear bei Disconnect | Frontend Context | API | `BotStatusContext` filtert nach Heartbeat-Alter; API liefert rohe Daten |
| Offline-Bots aus Settings ausblenden | Frontend (Client Component) | — | `filterBots` in `BotsSettingsClient.tsx` — gleiche Logik wie `BotsClient.tsx` |

---

## Standard Stack

### Core (bereits installiert — keine neuen Pakete nötig)

| Library | Version | Purpose | Verwendung in Phase 3 |
|---------|---------|---------|----------------------|
| Next.js | 15.5.15 | Framework, API Routes | Neuer `stats`-Endpunkt via App Router |
| React | 19.1.0 | UI | `useState`, `useEffect`, `useCallback` in Client Components |
| TypeScript | 5.x | Typsicherheit | Neue Interfaces `BotStats`, Erweiterung `BotStatus`, Union-Typ-Erweiterung |
| lucide-react | 1.11.0 | Icons | `Check`-Icon für Parameter-senden-Button (bereits importiert) |
| Framer Motion | 12.38.0 | Animationen | `motion.div` bereits in Settings-Datei — `AnimatePresence` wird entfernt |

**Keine neuen npm-Pakete in Phase 3.** Alle benötigten Libraries sind installiert. [VERIFIED: Codebase grep — package.json + BotsClient.tsx Imports]

### Package Legitimacy Audit

Entfällt — Phase 3 installiert keine externen Pakete.

---

## Architecture Patterns

### System Architecture Diagram

```
Bot (Flask) → POST /api/bridge/heartbeat
                  │ parameters-Feld (neu, optional)
                  ▼
          saveBotStatus() → bot-status-{id}.json
                  │
                  ├── GET /api/bots/:id/stats
                  │     └── getProfileTrades(bot.profileId)
                  │           filter: sourceId === botId
                  │           → { openCount, tradeCount, realizedPnl, currency }
                  │
BotsClient.tsx ←──┘  (pollt alle 8s)
  └── <Stat label="P&L" valueColor={pnlColor} />
  └── <Stat label="Positionen" />
  └── <Stat label="Trades" />
  └── <Stat label="Uptime" />

BotsSettingsClient.tsx ←── GET /api/bridge/status (alle 8s, bestehend)
  └── Bot-Info (read-only: Name, URL)
  └── Parameter-Editor (aus status.parameters)
        └── [Parameter senden]-Button
              └── POST /api/bridge/command
                    { bridgeId, command: 'set_parameters', payload: { parameters } }
                          │
                          ▼
                  Bot (Flask) ← Command empfangen
```

### Recommended Project Structure (nur neue/geänderte Dateien)

```
src/
├── app/
│   ├── api/
│   │   ├── bots/
│   │   │   └── [id]/
│   │   │       └── stats/
│   │   │           └── route.ts        # NEU — aggregiert Trade-Metriken
│   │   └── bridge/
│   │       ├── command/
│   │       │   └── route.ts            # ÄNDERN — set_parameters validieren
│   │       └── heartbeat/
│   │           └── route.ts            # ÄNDERN — parameters-Feld speichern
│   └── bots/
│       ├── BotsClient.tsx              # ÄNDERN — P&L+Trades statt Balance
│       └── settings/
│           └── BotsSettingsClient.tsx  # ÄNDERN — Edit/Delete weg, Parameter rein
└── types/
    └── bot.ts                          # ÄNDERN — BotStatus.parameters, set_parameters
```

### Pattern 1: Per-Bot API-Endpunkt (nach bestehendem log-Muster)

**Was:** `GET /api/bots/[id]/stats` — analoges Muster zu `GET /api/bots/[id]/log/route.ts`
**Wann:** Immer wenn ein bot-spezifischer Lesezugriff auf Serverdaten nötig ist

```typescript
// Source: src/app/api/bots/[id]/log/route.ts (bestehendes Muster)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  // Neue Stats-Route:
  const bot = getBotById(id)
  if (!bot) return NextResponse.json({ error: 'Bot nicht gefunden' }, { status: 404 })
  const trades = getProfileTrades(bot.profileId)
  const botTrades = trades.filter(t => t.sourceId === id)
  const openCount = botTrades.filter(t => t.status === 'open').length
  const tradeCount = botTrades.length
  const realizedPnl = botTrades
    .filter(t => t.status === 'closed' && t.pnl !== undefined)
    .reduce((sum, t) => sum + (t.pnl ?? 0), 0)
  const profile = getProfiles().find(p => p.id === bot.profileId)
  return NextResponse.json({ openCount, tradeCount, realizedPnl, currency: profile?.currency ?? 'EUR' })
}
```

[VERIFIED: Codebase — src/app/api/bots/[id]/log/route.ts + src/lib/profiles.ts]

### Pattern 2: Stat-Komponente mit optionalem valueColor-Prop

**Was:** Bestehende `<Stat>` Komponente in `BotsClient.tsx` um optionalen `valueColor`-Prop erweitern
**Wann:** P&L-Wert benötigt Farbsteuerung je nach Vorzeichen

```typescript
// Source: BotsClient.tsx Z.201–208 (bestehend, minimal erweitern)
function Stat({ label, value, valueColor }: {
  label: string
  value: string
  valueColor?: string
}) {
  return (
    <div className="rounded-xl px-3 py-2" style={{ background: 'var(--bg)' }}>
      <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-3)' }}>{label}</p>
      <p className="text-sm font-bold truncate" style={{ color: valueColor ?? 'var(--text-1)' }}>{value}</p>
    </div>
  )
}
```

[VERIFIED: Codebase — BotsClient.tsx Z.201–208]

### Pattern 3: P&L-Formatierung

```typescript
// Konsistent mit Trading-Journal (bestehende CSS-Variablen)
function formatPnl(realizedPnl: number | null, currency: string): { value: string; color: string } {
  if (realizedPnl === null) return { value: '-', color: 'var(--text-3)' }
  if (realizedPnl > 0)  return { value: `+${realizedPnl.toFixed(2)} ${currencySymbol(currency)}`, color: 'var(--green)' }
  if (realizedPnl < 0)  return { value: `${realizedPnl.toFixed(2)} ${currencySymbol(currency)}`, color: '#ef4444' }
  return { value: `+0.00 ${currencySymbol(currency)}`, color: 'var(--text-1)' }
}
```

[ASSUMED — Logik aus D-05/D-06 abgeleitet; CSS-Variablen aus globals.css verifiziert]

### Pattern 4: BotCommandType Union-Typ erweitern

```typescript
// Source: src/types/bot.ts Z.5 (bestehend)
// Aktuell:
export type BotCommandType = 'start' | 'stop' | 'pause' | 'resume' | 'execute_trade' | 'close_position' | 'restart'
// Neu:
export type BotCommandType = 'start' | 'stop' | 'pause' | 'resume' | 'execute_trade' | 'close_position' | 'restart' | 'set_parameters'

// Neuer Payload-Typ (analog zu TradeOrderPayload):
export interface SetParametersPayload {
  parameters: Record<string, string | number | boolean>
}
```

[VERIFIED: Codebase — src/types/bot.ts Z.5]

### Pattern 5: Command-Route Validierung für set_parameters

```typescript
// Source: src/app/api/bridge/command/route.ts Z.6 (bestehend)
// VALID_COMMANDS erweitern:
const VALID_COMMANDS: BotCommandType[] = [
  'start', 'stop', 'pause', 'resume', 'execute_trade', 'close_position', 'restart', 'set_parameters'
]

// Validierungsblock für set_parameters hinzufügen (nach dem close_position-Block):
if (command === 'set_parameters') {
  const p = payload as SetParametersPayload | undefined
  if (!p?.parameters || typeof p.parameters !== 'object') {
    return NextResponse.json({ error: 'set_parameters requires parameters object' }, { status: 400 })
  }
}
```

[VERIFIED: Codebase — src/app/api/bridge/command/route.ts Z.6–46]

### Pattern 6: Heartbeat-Route — parameters-Feld durchreichen

```typescript
// Source: src/app/api/bridge/heartbeat/route.ts Z.36 (bestehend)
// body-Typ erweitern — parameters aus BotStatus lesen und speichern:
// BotStatus bekommt parameters?: Record<string, string|number|boolean>
// saveBotStatus() speichert bereits das gesamte status-Objekt, kein extra Handling nötig
// Das parameters-Feld wird automatisch in bot-status-{id}.json mitgespeichert
```

[VERIFIED: Codebase — src/app/api/bridge/heartbeat/route.ts Z.61: `saveBotStatus(resolvedId, { ...status, lastHeartbeat: ... })`]

### Pattern 7: Heartbeat-Timeout-Filter in BotsSettingsClient

```typescript
// Source: BotsClient.tsx Z.68–69 (bestehend) — gleiche Logik übernehmen
// Aktuell in BotsSettingsClient.tsx Z.21:
const filterBots = (list: BotWithStatus[]) => list.filter(b => b.bot.type === 'bot')
// Neu (D-14):
const filterBots = (list: BotWithStatus[]) =>
  list.filter(b => b.bot.type === 'bot' && b.status?.connectionState !== 'offline')
```

[VERIFIED: Codebase — BotsSettingsClient.tsx Z.21, BotsClient.tsx Z.68–69]

### Anti-Patterns to Avoid

- **Positionen aus Heartbeat lesen:** `status.openPositions` ist vom Bot gemeldet und zeigt 0 (Root Cause BOTS-01). Stattdessen `openCount` aus Trade-Daten via Stats-Endpunkt verwenden.
- **Cache nicht invalidieren:** `saveBotStatus()` setzt bereits `_botsWithStatusCache = null` (verifiziert Z.136). `getProfileTrades()` nutzt keinen Modul-Cache — kein extra Handling nötig.
- **`AnimatePresence` ohne Grund behalten:** Der Edit-Branch in BotsSettingsClient kann komplett entfernt werden — kein Ersatz nötig, kein AnimatePresence-Wrapper mehr nötig wenn nur eine View-Variante existiert.
- **Globaler Speichern-Button:** D-15 verlangt pro Bot einen eigenen Button. Kein einzelner Button für alle Bots.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic File-Writes | Eigene Temp-Rename-Logik | `atomicWrite()` in `bot-data.ts` Z.30–35 | Bereits vorhanden, crash-safe |
| Trade-Datei lesen | Direktes `fs.readFileSync` | `getProfileTrades(profileId)` aus `src/lib/profiles.ts` | Konsistenter Pfad, Error-Handling inklusive |
| Currency-Symbol | Inline `'€'` | `currencySymbol()` aus `src/lib/currency.ts` | Multi-Currency-Support |
| Bot-Lookup | Direktes JSON-Parsen | `getBotById(id)` aus `src/lib/bot-data.ts` | Cache + korrekter Datenpfad |
| Verbindungszustand prüfen | Eigene Timestamp-Logik | `getConnectionState()` aus `bot-data.ts` Z.139 | Konsistente Schwellwerte (`CONNECTED_THRESHOLD_MS`, `WARNING_THRESHOLD_MS`) |

**Key insight:** Alle Daten-Layer-Funktionen sind in `src/lib/` bereits vorhanden. Der Stats-Endpunkt ist eine dünne Aggregationsschicht über bestehenden Funktionen.

---

## Verified Status: Already-Done Requirements

### BOTS-02: Synced-Feld entfernt

Verifiziert durch Code-Lektüre `BotsClient.tsx` Z.163–172:
```
<Stat label="Balance" ... />
<Stat label="Positionen" ... />
<Stat label="Uptime" ... />
```
Kein `Synced`-Feld vorhanden. [VERIFIED: Codebase — BotsClient.tsx Z.163–172]

### BOTS-05: Auto-Disappear

Verifiziert durch zwei Filter-Ebenen:
1. `BotStatusContext.tsx` Z.38–41: Filtert nach `HEARTBEAT_TIMEOUT_MS = 30_000`
2. `BotsClient.tsx` Z.68–69: `filterBots` entfernt `connectionState === 'offline'`

Ein Bot der sich trennt verschwindet spätestens nach 30s aus der Liste. [VERIFIED: Codebase — BotStatusContext.tsx Z.24+38–41, BotsClient.tsx Z.68–69]

**Achtung:** `BotsSettingsClient.tsx` filtert aktuell nur nach `type === 'bot'` (Z.21) — offline Bots werden dort noch angezeigt. Filter muss in dieser Phase angepasst werden (D-14).

---

## Common Pitfalls

### Pitfall 1: Stats-Endpunkt mit falschem Trade-Datenpfad

**Was schiefgeht:** `data.ts` liest `data/trades.json` (globale Datei für das aktive Profil). Bots haben ihr eigenes Profil (`bot.profileId`), dessen Trades in `data/trades-{profileId}.json` liegen.
**Warum:** `getTrades()` aus `data.ts` liest die hardcodierte Datei `data/trades.json`, nicht profil-spezifisch. `getProfileTrades(profileId)` aus `profiles.ts` liest die korrekte Datei.
**Vermeidung:** Im Stats-Endpunkt zwingend `getProfileTrades(bot.profileId)` aus `src/lib/profiles.ts` verwenden — nicht `getTrades()` aus `src/lib/data.ts`.
**Warnsignal:** Stats zeigen 0 obwohl Trades existieren.

[VERIFIED: Codebase — src/lib/data.ts Z.7 (hardcodiert), src/lib/profiles.ts Z.97–108 (profil-spezifisch)]

### Pitfall 2: BotStatus.parameters ist undefined wenn Bot kein parameters-Feld sendet

**Was schiefgeht:** Alter Bot-Code sendet kein `parameters`-Feld im Heartbeat. `status.parameters` ist `undefined`. TypeScript-Strict-Mode erfordert explizite Behandlung.
**Warum:** Rückwärtskompatibilität — `parameters?` ist optional im Interface.
**Vermeidung:** In der UI immer `status?.parameters ?? undefined` prüfen und den „keine Parameter"-Zustand explizit rendern (D-11). Im Heartbeat-Handler ist keine extra Logik nötig — `saveBotStatus` speichert `{ ...status, ... }` und optionale Felder werden einfach nicht gespeichert.
**Warnsignal:** TypeScript-Fehler `Object is possibly 'undefined'` bei direktem `Object.entries(status.parameters)`.

### Pitfall 3: Stats-Polling-State beim Bot-Wechsel

**Was schiefgeht:** `BotsClient.tsx` hält Stats für alle Bots in einem gemeinsamen State-Objekt (`Record<botId, BotStats>`). Wenn ein Bot die Liste verlässt, bleibt sein Stats-Eintrag im State.
**Warum:** React bereinigt State nicht automatisch wenn ein Array-Element verschwindet.
**Vermeidung:** Stats-State als `Record<string, BotStats>` führen; beim Rendern nur Stats für aktuell sichtbare Bots lesen; oder State bei jedem Bot-Listen-Refresh bereinigen.

### Pitfall 4: `addBotCommand` speichert Payload nicht

**Was schiefgeht:** `addBotCommand(botId, command)` in `bot-data.ts` Z.182 hat kein `payload`-Parameter. `set_parameters` braucht aber einen Payload mit den neuen Parameterwerten.
**Warum:** Bestehende Funktion wurde nur für einfache Commands (start/stop) designed.
**Vermeidung:** Die Command-Route (`route.ts`) übergibt den Payload direkt an Flask via `flaskBody.payload`. Der Payload muss **nicht** in der lokalen Command-Queue gespeichert werden — nur die Command-Delivery an Flask ist relevant. Die `addBotCommand`-Funktion bleibt unverändert.

[VERIFIED: Codebase — src/app/api/bridge/command/route.ts Z.59–63, src/lib/bot-data.ts Z.182–191]

### Pitfall 5: BotDetail-Seite hat ebenfalls Namens-Bearbeitung (BOTS-07)

**Was schiefgeht:** BOTS-07 verlangt Entfernen der Namens-Bearbeitung aus Bot-Settings. `BotDetailClient.tsx` hat ebenfalls einen Edit2-Button für Namens-Bearbeitung (Z.130–133). Falls BOTS-07 nur Settings meint, bleibt Detail-Seite unangetastet. Falls BOTS-07 alle Stellen meint, muss Detail-Seite auch geändert werden.
**Warum:** CONTEXT.md-Canonical-Refs: „`src/app/bots/[id]/BotDetailClient.tsx` — Namens-Bearbeitung hier ebenfalls prüfen (BOTS-07)".
**Empfehlung:** Namens-Bearbeitung in `BotDetailClient.tsx` belassen — der Scope laut Requirements ist „Bot-Settings". Die Detail-Seite ist eine separate Ansicht. Der CONTEXT.md-Hinweis ist eine Prüfaufforderung, kein Löschauftrag.

---

## Code Examples

### Stats-Endpunkt Response-Typ

```typescript
// Neues Interface für src/types/bot.ts oder inline in route.ts
interface BotStats {
  openCount: number
  tradeCount: number
  realizedPnl: number | null  // null = keine geschlossenen Trades (D-06)
  currency: string
}
```

### Parameter-Editor Toggle (boolean)

```tsx
// Source: UI-SPEC.md — Toggle 44×24px, role="switch"
<button
  role="switch"
  aria-checked={value as boolean}
  aria-label={key}
  onClick={() => setDraft(prev => ({ ...prev, [key]: !prev[key] }))}
  className="relative shrink-0 rounded-full cursor-pointer transition-colors"
  style={{
    width: 44, height: 24,
    background: value ? 'var(--green)' : 'var(--surface-2)',
    border: '1px solid var(--border)',
  }}
>
  <span
    className="absolute top-0.5 rounded-full transition-transform"
    style={{
      width: 20, height: 20,
      background: '#fff',
      transform: value ? 'translateX(22px)' : 'translateX(2px)',
    }}
  />
</button>
```

### Stats-Polling in BotsClient

```typescript
// Analoges Muster zum bestehenden /api/bridge/status Refresh (alle 8s)
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

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `status.openPositions` aus Heartbeat | `openCount` aus Trade-Daten (server-seitig) | Korrekte Werte statt immer 0 |
| `status.balance` anzeigen | `realizedPnl` aus Trades anzeigen | Bot-Performance statt Konto-Balance |
| Edit + Delete in Settings | Read-only Info + Parameter-Editor | Klarere Trennung: Settings für Konfiguration, nicht für Verwaltung |
| Alle Bots in Settings (auch offline) | Nur verbundene Bots in Settings | Parameter-Commands können nur online Bots empfangen |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `BotDetailClient.tsx` Namens-Bearbeitung soll laut BOTS-07 nicht entfernt werden (nur Settings-Seite betroffen) | Common Pitfalls #5 | Detail-Seite müsste ebenfalls geändert werden; kein Breaking Change |
| A2 | P&L-Formatierung mit `toFixed(2)` und `currencySymbol()` ist konsistent mit Trading-Journal | Code Examples | Visuell inkonsistent mit Journal-Darstellung wenn Journal anders formatiert |
| A3 | `realizedPnl: null` (nicht `0`) wenn keine geschlossenen Trades — Unterscheidung über separates Flag statt Null-Wert | Standard Stack | Könnte zu `-` vs `+0.00` Ambiguität führen wenn Bot echten 0-P&L hat |

---

## Open Questions (RESOLVED)

1. **BOTS-07: BotDetailClient Namens-Bearbeitung**
   - Was wir wissen: CONTEXT.md sagt „prüfen (BOTS-07)" für `BotDetailClient.tsx`
   - Was unklar ist: Ob „prüfen" = entfernen oder nur sicherstellen dass Settings-Bearbeitung nicht mehr existiert
   - Empfehlung: Detail-Seite belassen — „Bot-Settings" im Requirement-Text deutet auf Settings-Seite, nicht Detail-Seite. Planner soll Requirement-Text auswerten.
   - **RESOLVED: `BotDetailClient.tsx` bleibt unverändert — BOTS-07 betrifft ausschließlich die Bot-Settings-Seite (`BotsSettingsClient.tsx`).**

2. **Stats-Fetch: Initial-Zustand während Fetch**
   - Was wir wissen: UI-SPEC sagt „alle Werte zeigen `-`" initial
   - Was unklar ist: Ob ein Skeleton-Loading-State (z.B. pulsierender Placeholder) aus UI-SPEC hervorgeht
   - Empfehlung: Schlicht `-` anzeigen (kein Skeleton) — konsistent mit bestehendem Verhalten bei fehlenden Heartbeat-Daten
   - **RESOLVED: Schlicht `-` anzeigen (kein Skeleton) — durch `?? '-'`-Fallbacks in Plan 03-02 abgedeckt.**

---

## Environment Availability

Entfällt — Phase 3 hat keine externen Abhängigkeiten. Alle Komponenten sind interner Code (Next.js API Routes, React Components, TypeScript-Typen). Node.js 24.15.0 + npm 11.12.1 verfügbar und Build erfolgreich (verifiziert). [VERIFIED: `node --version`, `npm --version`, `npm run build`]

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Manuell (kein automatisches Test-Framework konfiguriert) |
| Config file | none — kein jest.config, vitest.config, oder pytest.ini vorhanden |
| Quick run command | `npm run build` (TypeScript-Kompilierung als Smoke-Test) |
| Full suite command | `npm run build` + manuelle UAT-Checkliste |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BOTS-01 | Bot-Karte zeigt korrekte Positionsanzahl aus Trade-Daten | UAT (manuell) | `npm run build` (TypeScript) | ❌ Wave 0: kein Test-File |
| BOTS-02 | Synced-Feld nicht sichtbar | UAT (visuell) | — | ✅ bereits erfüllt |
| BOTS-03 | P&L statt Balance in Bot-Karte | UAT (manuell) | `npm run build` | ❌ Wave 0 |
| BOTS-04 | Trade-Anzahl in Bot-Karte sichtbar | UAT (manuell) | `npm run build` | ❌ Wave 0 |
| BOTS-05 | Bot verschwindet nach Disconnect | UAT (manuell, 30s warten) | — | ✅ bereits erfüllt |
| BOTS-06 | Entfernen-Button nicht sichtbar | UAT (visuell) | `npm run build` | ❌ Wave 0 |
| BOTS-07 | Namens-Bearbeitung in Settings nicht sichtbar | UAT (visuell) | `npm run build` | ❌ Wave 0 |
| BOTS-08 | Parameter-Editor sichtbar + Parameter senden funktioniert | UAT (manuell) | `npm run build` | ❌ Wave 0 |

### Sampling Rate

- **Per Task:** `npm run build` — TypeScript-Fehler sofort sichtbar
- **Per Wave:** `npm run build` + manuelle UAT der Anforderungen
- **Phase Gate:** Alle 8 Success Criteria aus ROADMAP.md manuell verifiziert

### Wave 0 Gaps

- Kein automatisches Test-Framework — `npm run build` ist einziger automatischer Check
- UAT-Checkliste in `03-UAT.md` muss BOTS-01/03/04/06/07/08 abdecken

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | nein | — |
| V3 Session Management | nein | — |
| V4 Access Control | ja (teilweise) | `isSameOriginRequest()` bereits in command/route.ts; `isValidApiKey()` in heartbeat/route.ts — beide bleiben unverändert |
| V5 Input Validation | ja | `set_parameters`-Command-Validierung in command/route.ts; Parameter-Objekt-Typ-Prüfung |
| V6 Cryptography | nein | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Fremder Bot sendet `set_parameters` für anderen Bot | Spoofing | `getBotById(bridgeId)` — Command nur an bekannte Bot-IDs |
| Parameter-Payload mit Sonderzeichen/Injection | Tampering | Flask-Bot ist verantwortlich für Validierung; AlphaTrack nur Typ-Prüfung (`typeof`) |
| Direkter File-System-Zugriff auf Trade-Daten | — | Kein neues Risiko — `getProfileTrades()` ist bestehende, geprüfte Funktion |

---

## Sources

### Primary (HIGH confidence)

- Codebase direkt gelesen: `src/types/bot.ts`, `src/app/bots/BotsClient.tsx`, `src/app/bots/settings/BotsSettingsClient.tsx`, `src/app/bots/[id]/BotDetailClient.tsx`, `src/lib/bot-data.ts`, `src/lib/profiles.ts`, `src/app/api/bots/[id]/log/route.ts`, `src/app/api/bridge/command/route.ts`, `src/app/api/bridge/heartbeat/route.ts`, `src/context/BotStatusContext.tsx`, `src/types/trade.ts`
- `.planning/phases/03-bot-verbesserungen/03-CONTEXT.md` — Alle Decisions D-01 bis D-15
- `.planning/phases/03-bot-verbesserungen/03-UI-SPEC.md` — UI-Design-Contract vollständig gelesen

### Secondary (MEDIUM confidence)

- `.planning/REQUIREMENTS.md` — BOTS-01 bis BOTS-08 Definitionen
- `.planning/ROADMAP.md` — Phase-3-Success-Criteria

### Tertiary (LOW confidence)

Keine.

---

## Metadata

**Confidence breakdown:**

- Standard Stack: HIGH — alle Libraries direkt aus package.json verifiziert; kein neues Paket nötig
- Architecture: HIGH — alle relevanten Source-Dateien gelesen; Patterns aus bestehendem Code abgeleitet
- Pitfalls: HIGH — aus direkter Code-Lektüre identifiziert (falsche Trade-Datei, fehlender Payload-Support)

**Research date:** 2026-06-11
**Valid until:** 2026-07-11 (stabiler Next.js/React-Stack, keine externen Abhängigkeiten)
