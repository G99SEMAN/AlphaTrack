# Profile Deletion & Setup-Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vollständige Datenbereinigung beim Profil löschen (inkl. Bot-Stop), Setup-Wizard Schritt 4 auf Bridge-History-Pull umstellen, und Auto-Startkapital beim ersten Heartbeat setzen.

**Architecture:** Feature 1 erweitert `deleteProfile()` um Bot-Cleanup und fügt einen Stop-and-wait-Flow im Frontend hinzu. Feature 2 ersetzt den MT5-HTML-Upload in Step 4 durch einen direkten Bridge-Pull via neuer Server Action. Feature 3 ergänzt den Heartbeat-Handler um einen einmaligen Account-Balance-Fetch wenn `startCapital === 0`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Server Actions, React (useState/useTransition), file-based JSON storage in `data/`

---

## File Map

| Datei | Änderung |
|---|---|
| `src/lib/normalize-trade.ts` | NEU — gemeinsame Trade-Normalisierungs-Helpers |
| `src/lib/bot-data.ts` | ÄNDERN — `deleteBotFiles()` + `getBotsByProfileId()` hinzufügen |
| `src/lib/profiles.ts` | ÄNDERN — `deleteProfile()` um Bot-Cleanup erweitern |
| `src/lib/actions.ts` | ÄNDERN — `stopBotsForProfileAction`, `checkStopAcknowledgedAction`, `importBridgeHistoryAction` hinzufügen |
| `src/app/api/bridge/heartbeat/route.ts` | ÄNDERN — Auto-startCapital-Logik ergänzen |
| `src/app/api/bridge/trades/route.ts` | ÄNDERN — lokale Helpers durch Import aus normalize-trade.ts ersetzen |
| `src/components/einstellungen/EinstellungenClient.tsx` | ÄNDERN — `handleDelete()` um Stop-Phase erweitern |
| `src/components/profile/ProfileSetupForm.tsx` | ÄNDERN — Schritt 4 komplett ersetzen |

---

## Task 1: Trade-Normalisierung in eigene Lib-Datei extrahieren

**Files:**
- Create: `src/lib/normalize-trade.ts`
- Modify: `src/app/api/bridge/trades/route.ts`

- [ ] **Schritt 1: Neue Datei erstellen**

Erstelle `src/lib/normalize-trade.ts` mit folgendem Inhalt:

```typescript
import { Trade } from '@/types/trade'

export function isValidRawTrade(raw: Record<string, unknown>): boolean {
  return (
    typeof raw.date === 'string' &&
    typeof raw.instrument === 'string' &&
    (raw.type === 'long' || raw.type === 'short') &&
    typeof raw.entry === 'number' &&
    typeof raw.size === 'number' &&
    (raw.status === 'open' || raw.status === 'closed' || raw.status === 'cancelled')
  )
}

export function normalizeTrade(raw: Record<string, unknown>): Omit<Trade, 'id'> {
  const { bot_id, botId, ...rest } = raw as Record<string, unknown> & { bot_id?: string | null; botId?: string | null }
  const resolvedBotId = botId ?? bot_id ?? null
  const sourceId = resolvedBotId !== null ? resolvedBotId : 'bridge/tradeexecuter'
  return { ...rest, botId: resolvedBotId, sourceId } as unknown as Omit<Trade, 'id'>
}
```

- [ ] **Schritt 2: `bridge/trades/route.ts` aktualisieren**

In `src/app/api/bridge/trades/route.ts` die beiden lokalen Funktionen löschen und durch den Import ersetzen.

Ersetze Zeilen 53–69 (die `isValidRawTrade`- und `normalizeTrade`-Definitionen):

```typescript
import { isValidRawTrade, normalizeTrade } from '@/lib/normalize-trade'
```

Füge diesen Import ganz oben in der Importsektion ein (nach den bestehenden Imports).

- [ ] **Schritt 3: Build prüfen**

```bash
npm run build 2>&1 | tail -20
```

Erwartetes Ergebnis: kein TypeScript-Fehler, Build erfolgreich.

- [ ] **Schritt 4: Committen**

```bash
git add src/lib/normalize-trade.ts src/app/api/bridge/trades/route.ts
git commit -m "refactor: Trade-Normalisierung in eigene Lib-Datei extrahiert"
```

---

## Task 2: Bot-Daten-Hilfsfunktionen in bot-data.ts

**Files:**
- Modify: `src/lib/bot-data.ts`

- [ ] **Schritt 1: `getBotsByProfileId` und `deleteBotFiles` hinzufügen**

In `src/lib/bot-data.ts` direkt nach `removeBot()` (nach Zeile 119) einfügen:

```typescript
export function getBotsByProfileId(profileId: string): BotEntry[] {
  return getBots().filter(b => b.profileId === profileId)
}

export function deleteBotFiles(botId: string): void {
  const filesToDelete = [
    botStatusPath(botId),
    bridgeLogPath(botId),
    botCommandsPath(botId),
    botLogPath(botId),
  ]
  for (const f of filesToDelete) {
    try { fs.unlinkSync(f) } catch { /* ignorieren */ }
  }
}
```

Hinweis: `botLogPath` ist als `function botLogPath(botId: string)` bereits in der Datei auf Zeile 221 definiert — sie ist aber nicht exportiert. Diese Funktion muss für `deleteBotFiles` sichtbar sein. Da sie im selben File ist, ist das kein Problem.

- [ ] **Schritt 2: Build prüfen**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Schritt 3: Committen**

```bash
git add src/lib/bot-data.ts
git commit -m "feat: getBotsByProfileId und deleteBotFiles Hilfsfunktionen"
```

---

## Task 3: `deleteProfile()` um Bot-Cleanup erweitern

**Files:**
- Modify: `src/lib/profiles.ts`

- [ ] **Schritt 1: Import ergänzen**

In `src/lib/profiles.ts` den bestehenden Import von `bot-data` hinzufügen. Füge nach Zeile 4 (nach dem `saveProfileStrategies`-Import) ein:

```typescript
import { getBotsByProfileId, deleteBotFiles, removeBot } from '@/lib/bot-data'
```

- [ ] **Schritt 2: `deleteProfile()` erweitern**

Ersetze die gesamte `deleteProfile`-Funktion (Zeilen 52–82) durch:

```typescript
export function deleteProfile(profileId: string): void {
  // Screenshots der Trades einsammeln und löschen
  const trades = getProfileTrades(profileId)
  const screenshotsDir = path.join(DATA_DIR, 'screenshots')
  for (const trade of trades) {
    if (trade.screenshot) {
      const filename = trade.screenshot.replace('/api/screenshots/', '')
      try { fs.unlinkSync(path.join(screenshotsDir, filename)) } catch { /* ignorieren */ }
    }
  }

  // Zugehörige Bots und ihre Dateien löschen
  const bots = getBotsByProfileId(profileId)
  for (const bot of bots) {
    deleteBotFiles(bot.id)
    removeBot(bot.id)
  }

  // Profil-Dateien löschen
  const profiles = getProfiles().filter(p => p.id !== profileId)
  saveProfiles(profiles)
  const filesToDelete = [
    getTradeFilePath(profileId),
    path.join(DATA_DIR, `strategies-${profileId}.json`),
    path.join(DATA_DIR, `bot-trades-${profileId}.json`),
  ]
  for (const f of filesToDelete) {
    try { fs.unlinkSync(f) } catch { /* ignorieren */ }
  }

  // Aktives Profil zurücksetzen wenn nötig
  const active = getActiveProfileId()
  if (active === profileId) {
    const remaining = profiles[0]
    if (remaining) setActiveProfileId(remaining.id)
    else clearActiveProfile()
  }
}
```

- [ ] **Schritt 3: Build prüfen**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Schritt 4: Committen**

```bash
git add src/lib/profiles.ts
git commit -m "feat: deleteProfile bereinigt jetzt auch Bot-Dateien und bots.json-Einträge"
```

---

## Task 4: Server Actions für Stop-and-Delete Flow

**Files:**
- Modify: `src/lib/actions.ts`

- [ ] **Schritt 1: Imports ergänzen**

In `src/lib/actions.ts` den bestehenden Import-Block erweitern. Nach dem bestehenden `getBotById`-Import (oder ähnlich), ergänze:

```typescript
import {
  getBotsByProfileId,
  addBotCommand,
  getBotCommands,
  getConnectionState,
  getBotStatus,
} from '@/lib/bot-data'
```

- [ ] **Schritt 2: `stopBotsForProfileAction` hinzufügen**

Füge nach `deleteProfileAction` (nach Zeile 54) ein:

```typescript
export async function stopBotsForProfileAction(
  profileId: string
): Promise<{ botId: string; commandId: string }[]> {
  const bots = getBotsByProfileId(profileId)
  const stops: { botId: string; commandId: string }[] = []

  for (const bot of bots) {
    const status = getBotStatus(bot.id)
    const state = getConnectionState(status)
    if (state === 'connected' || state === 'warning') {
      const command = addBotCommand(bot.id, 'stop')
      stops.push({ botId: bot.id, commandId: command.id })
    }
  }

  return stops
}
```

- [ ] **Schritt 3: `checkStopAcknowledgedAction` hinzufügen**

Direkt danach einfügen:

```typescript
export async function checkStopAcknowledgedAction(
  stops: { botId: string; commandId: string }[]
): Promise<boolean> {
  for (const { botId, commandId } of stops) {
    const commands = getBotCommands(botId)
    const cmd = commands.find(c => c.id === commandId)
    if (!cmd || !cmd.acknowledged) return false
  }
  return true
}
```

- [ ] **Schritt 4: Build prüfen**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Schritt 5: Committen**

```bash
git add src/lib/actions.ts
git commit -m "feat: stopBotsForProfileAction und checkStopAcknowledgedAction"
```

---

## Task 5: Delete-Flow in EinstellungenClient mit Stop-Phase

**Files:**
- Modify: `src/components/einstellungen/EinstellungenClient.tsx`

- [ ] **Schritt 1: Imports ergänzen**

In `EinstellungenClient.tsx` den bestehenden Import von `actions` erweitern:

```typescript
import { switchProfileAction, deleteProfileAction, stopBotsForProfileAction, checkStopAcknowledgedAction } from '@/lib/actions'
```

- [ ] **Schritt 2: Neuen State `deleteStatusMsg` hinzufügen**

Im Komponenten-Body direkt neben dem bestehenden `deleting`-State hinzufügen:

```typescript
const [deleteStatusMsg, setDeleteStatusMsg] = useState<string | null>(null)
```

- [ ] **Schritt 3: `handleDelete` ersetzen**

Ersetze die gesamte `handleDelete`-Funktion (Zeilen 141–152) durch:

```typescript
async function handleDelete() {
  if (!deleteConfirm) return
  const id = deleteConfirm.id
  setDeleteConfirm(null)
  setDeleting(true)

  try {
    // Schritt 1: Stop-Commands an alle aktiven Bots senden
    const stops = await stopBotsForProfileAction(id)

    if (stops.length > 0) {
      setDeleteStatusMsg('Bots werden gestoppt…')
      // Max 5 Sekunden auf Acknowledgment warten
      const deadline = Date.now() + 5000
      while (Date.now() < deadline) {
        const allDone = await checkStopAcknowledgedAction(stops)
        if (allDone) break
        await new Promise(r => setTimeout(r, 500))
      }
    }

    // Schritt 2: Profil und alle Daten löschen
    setDeleteStatusMsg('Profil wird gelöscht…')
    await deleteProfileAction(id)
    router.refresh()
  } finally {
    setDeleting(false)
    setDeleteStatusMsg(null)
  }
}
```

- [ ] **Schritt 4: Status-Anzeige im Delete-Spinner-Bereich**

Im JSX: Suche den Bereich wo `deleting` als Ladeindikator gezeigt wird. Das ist die Stelle in der Profilliste wo `deleting` den Trash-Button deaktiviert. Ergänze darunter eine Statusanzeige.

Suche im JSX nach:

```tsx
title="Profil löschen"
```

Der gesamte Profilkarten-Bereich hat keinen dedizierten Spinner. Stattdessen: ergänze nach dem bestehenden `{deleting && ...}` Block (oder wo der Lösch-Zustand angezeigt wird) folgendes, direkt vor dem schließenden `</div>` der Profil-Tab-Sektion:

```tsx
{deleting && deleteStatusMsg && (
  <div
    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
    style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
  >
    <span className="animate-spin text-base">⟳</span>
    {deleteStatusMsg}
  </div>
)}
```

Platziere dieses Element direkt nach dem `{profiles.length === 0 && ...}` Block, aber vor dem Bestätigungs-Dialog-Block.

- [ ] **Schritt 5: Manuell testen**

1. App starten: `npm run dev`
2. Ein Profil mit einer verbundenen Bridge erstellen
3. Profil löschen → Dialog öffnet sich
4. Bestätigen → „Bots werden gestoppt…" erscheint kurz, dann „Profil wird gelöscht…"
5. Profil und alle zugehörigen Dateien in `data/` prüfen: keine `bot-*`, `trades-*`, `strategies-*` Dateien mehr für dieses Profil

- [ ] **Schritt 6: Committen**

```bash
git add src/components/einstellungen/EinstellungenClient.tsx
git commit -m "feat: Profil-Löschen zeigt Stop-Phase und wartet auf Bot-Acknowledgment"
```

---

## Task 6: Auto-Startkapital beim ersten Heartbeat

**Files:**
- Modify: `src/app/api/bridge/heartbeat/route.ts`

- [ ] **Schritt 1: Imports ergänzen**

In `heartbeat/route.ts` den bestehenden Profiles-Import erweitern:

```typescript
import { getProfileTrades, saveProfileTrades, getProfiles, updateProfile } from '@/lib/profiles'
```

- [ ] **Schritt 2: Auto-startCapital-Logik einfügen**

In der `POST`-Handler-Funktion, direkt **nach** dem `reconcileOpenTrades`-Block (nach Zeile 68, nach dem `}`), aber **vor** dem `mt5WasConnected`-Block, einfügen:

```typescript
  // Auto-Startkapital: bei erster Verbindung Kontostand aus Bridge holen
  if (body.profileId && /^[a-zA-Z0-9_-]{1,64}$/.test(body.profileId)) {
    const profiles = getProfiles()
    const profile = profiles.find(p => p.id === body.profileId)
    if (profile && profile.startCapital === 0) {
      const bridge = getBotById(resolvedId)
      if (bridge) {
        try {
          const accountRes = await fetch(`${bridge.url}/account`, {
            signal: AbortSignal.timeout(5000),
          })
          if (accountRes.ok) {
            const account = await accountRes.json() as Record<string, unknown>
            const balance = account?.balance
            if (typeof balance === 'number' && balance > 0) {
              updateProfile({ ...profile, startCapital: balance })
              addBridgeLogEntry(
                resolvedId,
                'info',
                `Startkapital automatisch gesetzt: ${balance} ${profile.currency}`,
              )
            }
          }
        } catch {
          // Nächster Heartbeat versucht es erneut
        }
      }
    }
  }
```

- [ ] **Schritt 3: Build prüfen**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Schritt 4: Manuell testen**

1. Profil mit `startCapital = 0` anlegen
2. Bridge verbinden
3. Einstellungen → Profil-Tab öffnen: `startCapital` sollte jetzt den Kontostand der Bridge zeigen
4. Bridge-Log prüfen: Eintrag „Startkapital automatisch gesetzt" sichtbar

- [ ] **Schritt 5: Committen**

```bash
git add src/app/api/bridge/heartbeat/route.ts
git commit -m "feat: Auto-Startkapital aus Bridge-Kontostand beim ersten Heartbeat"
```

---

## Task 7: `importBridgeHistoryAction` in actions.ts

**Files:**
- Modify: `src/lib/actions.ts`

- [ ] **Schritt 1: Imports ergänzen**

In `src/lib/actions.ts` ergänzen:

```typescript
import { isValidRawTrade, normalizeTrade } from '@/lib/normalize-trade'
import { getAllBotsWithStatus } from '@/lib/bot-data'
import { nanoid } from 'nanoid'
```

`nanoid` ist wahrscheinlich schon importiert — falls ja, nur die anderen beiden hinzufügen.

- [ ] **Schritt 2: `importBridgeHistoryAction` hinzufügen**

Am Ende von `actions.ts` einfügen:

```typescript
export async function importBridgeHistoryAction(): Promise<
  | { ok: true; imported: number }
  | { ok: false; reason: 'no_bridge' | 'bridge_offline' | 'fetch_error' }
> {
  const activeId = getActiveProfileId()
  if (!activeId) return { ok: false, reason: 'no_bridge' }

  // Verbundene Bridge für dieses Profil suchen
  const allBots = getAllBotsWithStatus()
  const bridgeEntry = allBots.find(
    ({ bot, status }) =>
      bot.profileId === activeId &&
      (bot.type ?? 'bridge') === 'bridge' &&
      (status?.connectionState === 'connected' || status?.connectionState === 'warning')
  )

  if (!bridgeEntry) return { ok: false, reason: 'bridge_offline' }

  const bridge = bridgeEntry.bot

  let deals: Record<string, unknown>[]
  try {
    const res = await fetch(`${bridge.url}/history`, {
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) return { ok: false, reason: 'fetch_error' }
    const data = await res.json() as { deals?: unknown[] }
    deals = (data.deals ?? []) as Record<string, unknown>[]
  } catch {
    return { ok: false, reason: 'fetch_error' }
  }

  const validRaw = deals.filter(isValidRawTrade)
  const existing = getProfileTrades(activeId)
  const existingExternalIds = new Set(existing.filter(t => t.externalId).map(t => t.externalId!))
  const syntheticKeys = new Set(
    existing.filter(t => !t.externalId).map(t => `${t.instrument}_${t.date}_${t.size}`)
  )

  const newTrades = []
  for (const raw of validRaw) {
    const t = normalizeTrade(raw)
    if (t.externalId) {
      if (!existingExternalIds.has(t.externalId as string)) {
        newTrades.push({ ...t, id: nanoid(10) })
      }
    } else {
      const key = `${t.instrument}_${t.date}_${t.size}`
      if (!syntheticKeys.has(key)) {
        newTrades.push({ ...t, id: nanoid(10) })
        syntheticKeys.add(key)
      }
    }
  }

  if (newTrades.length > 0) {
    saveProfileTrades(activeId, [...existing, ...newTrades as Trade[]])
    revalidatePath('/dashboard')
    revalidatePath('/journal')
  }

  return { ok: true, imported: newTrades.length }
}
```

- [ ] **Schritt 3: Build prüfen**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Schritt 4: Committen**

```bash
git add src/lib/actions.ts
git commit -m "feat: importBridgeHistoryAction für Bridge-History-Pull"
```

---

## Task 8: Setup-Wizard Schritt 4 ersetzen

**Files:**
- Modify: `src/components/profile/ProfileSetupForm.tsx`

- [ ] **Schritt 1: Imports bereinigen und ergänzen**

In `ProfileSetupForm.tsx`:

**Entfernen:**
```typescript
import { extractInitialBalance, parseMT5Html } from '@/lib/parsers/mt5'
```

**Ergänzen (zu bestehenden imports):**
```typescript
import { importBridgeHistoryAction } from '@/lib/actions'
import { History, SkipForward, Loader2 } from 'lucide-react'
```

`Loader2` und andere Icons sind evtl. schon importiert — nur die fehlenden hinzufügen.

- [ ] **Schritt 2: State-Variablen für Schritt 4 ersetzen**

Die bestehenden Import-States (Zeilen 55–63) ersetzen:

```typescript
// Schritt 4 - Trade-Sync
const [syncPhase, setSyncPhase] = useState<'choice' | 'loading' | 'done' | 'no_bridge'>('choice')
const [syncImported, setSyncImported] = useState<number>(0)
```

Die alten States und Variablen entfernen: `importSubStep`, `importBrokerSelected`, `importParsed`, `importParseError`, `importBalanceMismatch`, `importCapitalUpdated`, `importResult`, `isPending`, `startTransition` sowie `importFileRef4` (das `useRef`). `useTransition` und `useRef` aus dem React-Import entfernen, sofern sie nicht anderweitig genutzt werden.

- [ ] **Schritt 3: Handler für Schritt 4 ergänzen**

Füge nach `handleFinish()` ein:

```typescript
async function handleBridgeSync() {
  setSyncPhase('loading')
  const result = await importBridgeHistoryAction()
  if (!result.ok) {
    setSyncPhase('no_bridge')
    return
  }
  setSyncImported(result.imported)
  setSyncPhase('done')
}
```

- [ ] **Schritt 4: `isWidePreview` entfernen**

Zeile 147 (`const isWidePreview = step === 4 && importSubStep === 'preview'`) löschen.

Zeile 157 (`maxWidth: isWidePreview ? 700 : 480`) ändern zu:
```typescript
maxWidth: 480,
```

- [ ] **Schritt 5: `stepLabels` anpassen**

```typescript
const stepLabels = ['Profil-Typ', 'Broker & Kapital', 'Details', 'Trade-Sync']
```

- [ ] **Schritt 6: Schritt 4 JSX komplett ersetzen**

Den gesamten Block `{/* Schritt 4: Trade-Import */}` (ab `{step === 4 && (` bis zum schließenden `)}`) ersetzen durch:

```tsx
{/* Schritt 4: Trade-Sync */}
{step === 4 && (
  <motion.div
    key="step4"
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    className="flex flex-col gap-5"
  >
    <div>
      <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text-1)' }}>
        Trades synchronisieren
      </h2>
      <p className="text-sm" style={{ color: 'var(--text-2)' }}>
        Möchtest du bestehende Trades aus MetaTrader laden oder erst ab heute dokumentieren?
      </p>
    </div>

    <AnimatePresence mode="wait">

      {/* Auswahl */}
      {syncPhase === 'choice' && (
        <motion.div
          key="choice"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex flex-col gap-3"
        >
          <button
            type="button"
            onClick={handleBridgeSync}
            className="w-full flex items-center gap-4 px-4 py-4 rounded-xl text-left transition-all cursor-pointer"
            style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--accent-bg)' }}
            >
              <History size={20} style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
                Alle historischen Trades laden
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>
                Bridge muss verbunden sein — lädt alle bisherigen Trades aus MetaTrader
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={handleFinish}
            className="w-full flex items-center gap-4 px-4 py-4 rounded-xl text-left transition-all cursor-pointer"
            style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--surface-3)' }}
            >
              <SkipForward size={20} style={{ color: 'var(--text-3)' }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
                Erst ab heute dokumentieren
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>
                Keine historischen Daten — neue Trades werden ab sofort erfasst
              </p>
            </div>
          </button>
        </motion.div>
      )}

      {/* Laden */}
      {syncPhase === 'loading' && (
        <motion.div
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-3 py-8"
        >
          <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent)' }} />
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            Historische Trades werden geladen…
          </p>
        </motion.div>
      )}

      {/* Keine Bridge */}
      {syncPhase === 'no_bridge' && (
        <motion.div
          key="no_bridge"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col gap-4"
        >
          <div
            className="px-4 py-3 rounded-xl"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}
          >
            <p className="text-sm font-semibold" style={{ color: '#f59e0b' }}>
              Keine Bridge verbunden
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-2)' }}>
              Du kannst den historischen Import später unter Einstellungen nachholen, sobald die Bridge verbunden ist.
            </p>
          </div>
          <button
            type="button"
            onClick={handleFinish}
            className="w-full py-3 rounded-xl font-semibold text-sm cursor-pointer"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Zum Dashboard
          </button>
        </motion.div>
      )}

      {/* Fertig */}
      {syncPhase === 'done' && (
        <motion.div
          key="done"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4 py-6"
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(34,197,94,0.12)' }}
          >
            <Check size={28} style={{ color: '#22c55e' }} strokeWidth={2.5} />
          </div>
          <div className="text-center">
            <p className="text-base font-bold" style={{ color: 'var(--text-1)' }}>
              {syncImported} Trade{syncImported !== 1 ? 's' : ''} importiert
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>
              Alle historischen Trades wurden synchronisiert
            </p>
          </div>
          <button
            type="button"
            onClick={handleFinish}
            className="px-6 py-2.5 rounded-xl font-semibold text-sm cursor-pointer"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Zum Dashboard
          </button>
        </motion.div>
      )}

    </AnimatePresence>
  </motion.div>
)}
```

- [ ] **Schritt 7: Ungenutzte Imports entfernen**

Prüfe ob noch genutzt: `Upload`, `FileText`, `AlertCircle`. Falls nicht mehr referenziert: aus dem Lucide-Import-Block entfernen.

- [ ] **Schritt 8: Build prüfen**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Schritt 9: Manuell testen**

1. Neues Profil anlegen (alle 4 Schritte durchlaufen)
2. Schritt 4 zeigt zwei Karten: „Alle historischen Trades laden" und „Erst ab heute dokumentieren"
3. „Erst ab heute" → direkt zum Dashboard
4. Erneut neues Profil → „Historische Trades laden" ohne Bridge → Amber-Banner erscheint
5. Mit verbundener Bridge → Trades werden importiert, „N Trades importiert"-Anzeige

- [ ] **Schritt 10: Committen**

```bash
git add src/components/profile/ProfileSetupForm.tsx
git commit -m "feat: Setup-Wizard Schritt 4 auf Bridge-History-Pull umgestellt"
```

---

## Abschlusskontrolle

- [ ] `npm run build` ohne Fehler
- [ ] Profil anlegen → Wizard Schritt 4 zeigt zwei Karten
- [ ] Profil löschen → Stop-Phase erscheint → alle Daten in `data/` bereinigt
- [ ] Neues Profil mit startCapital 0 → Bridge verbinden → Kontostand wird automatisch gesetzt
