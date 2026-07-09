# Live Trades: Bot-Attribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Offene Positionen in der Live-Trades-Ansicht (`/bridge/trades`) korrekt dem auslösenden Strategie-Bot zuordnen, statt nur den Bridge-Namen zu zeigen.

**Architecture:** Die Bridge (`bridge/gateway.py`) führt bereits eine Ticket→Bot-ID-Registry, befüllt bei jedem `execute_trade`-Command. Diese wird bislang nur für geschlossene Trades und die Terminal-Anzeige genutzt. Der Fix reichert die offenen Positionen (`bridge/main.py`) mit dieser bereits vorhandenen Zuordnung an, bevor sie in den Positions-Cache/Heartbeat gehen. AlphaTrack löst `botId` anschließend gegen die Liste der registrierten Strategie-Bots auf und zeigt das bereits vorhandene Badge korrekt befüllt an.

**Tech Stack:** Python (Bridge, Mini-PC), Next.js 15 / TypeScript (AlphaTrack, NAS-Docker)

## Global Constraints

- Keine Änderung an `bridge/trade_executor.py` oder MT5-`order_send`-Requests (Spec: Risiko-Minimierung, Trade-Execution-Pfad bleibt unangetastet).
- Kein Backfill für bereits offene Positionen — nur ab Fix-Zeitpunkt neu geöffnete Trades bekommen eine Zuordnung (Spec: Einschränkung).
- Bridge-Änderungen laufen auf dem Mini-PC und werden separat vom Next.js-Hot-Reload-Workflow deployt/verifiziert (siehe `docs/DEPLOYMENT.md`).
- Deploy zu NAS/Mini-PC (Produktion) NUR nach expliziter Freigabe durch den Nutzer — nicht automatisch als Teil dieses Plans ausführen.

---

### Task 1: Bridge — offene Positionen mit Bot-ID anreichern

**Files:**
- Modify: `bridge/main.py:441`

**Interfaces:**
- Consumes: `get_at_bot_id_for_ticket(ticket: int) -> str | None` aus `bridge/gateway.py`, bereits importiert in `bridge/main.py:18`.
- Produces: Jedes Dict aus `mt5.get_open_positions()` bekommt zusätzlich den Key `"botId"` (AlphaTrack-Bot-ID als String, oder `None` wenn nicht zuordenbar), bevor es an `update_positions_cache()` geht. Dieser Cache speist sowohl `heartbeat.py` (`get_positions_cache()`) als auch den `/positions`-HTTP-Endpunkt — nachgelagerte Tasks können sich auf `positions[i]["botId"]` verlassen.

- [ ] **Step 1: Aktuellen Code lesen und Einfügestelle bestätigen**

Datei `bridge/main.py`, Zeilen 438-446 sollten aktuell so aussehen:

```python
        if mt5_ok:
            state["active_symbols"] = mt5.get_active_symbols()
            state["open_positions"] = mt5.get_open_positions_count()
            update_positions_cache(mt5.get_open_positions())
            account = mt5.get_account_info()
            if account:
                state["balance"] = account["balance"]
                state["currency"] = account["currency"]
```

- [ ] **Step 2: Anreicherung einbauen**

Ersetze die Zeile `update_positions_cache(mt5.get_open_positions())` durch:

```python
            open_positions = mt5.get_open_positions()
            for pos in open_positions:
                pos["botId"] = get_at_bot_id_for_ticket(pos["ticket"])
            update_positions_cache(open_positions)
```

Der vollständige Block sieht danach so aus:

```python
        if mt5_ok:
            state["active_symbols"] = mt5.get_active_symbols()
            state["open_positions"] = mt5.get_open_positions_count()
            open_positions = mt5.get_open_positions()
            for pos in open_positions:
                pos["botId"] = get_at_bot_id_for_ticket(pos["ticket"])
            update_positions_cache(open_positions)
            account = mt5.get_account_info()
            if account:
                state["balance"] = account["balance"]
                state["currency"] = account["currency"]
```

- [ ] **Step 3: Syntax prüfen**

Da es in `bridge/` keine automatisierten Tests gibt (siehe `CLAUDE.md`, Abschnitt "Testen"), Syntax stattdessen per Compile-Check verifizieren:

Run: `python -m py_compile bridge/main.py`
Expected: Kein Output, Exit-Code 0.

- [ ] **Step 4: Logik gegen die Registry-Funktion gegenprüfen**

Run (aus dem `bridge/`-Verzeichnis, mit MetaTrader5-Paket in der Umgebung):

```bash
python -c "
import gateway
gateway._ticket_to_at_bot_id[999999] = 'testbot123'
print('bekanntes Ticket:', gateway.get_at_bot_id_for_ticket(999999))
print('unbekanntes Ticket:', gateway.get_at_bot_id_for_ticket(1))
"
```

Expected:
```
bekanntes Ticket: testbot123
unbekanntes Ticket: None
```

Das bestätigt, dass `get_at_bot_id_for_ticket()` für bekannte Tickets die Bot-ID liefert und für unbekannte `None` — genau das Verhalten, das Step 2 in `pos["botId"]` einträgt.

- [ ] **Step 5: Commit**

```bash
git add bridge/main.py
git commit -m "feat(bridge): offene Positionen mit auslösendem Bot verknüpfen"
```

---

### Task 2: AlphaTrack — `botId` im geteilten LivePosition-Typ ergänzen

**Files:**
- Modify: `src/types/bot.ts:53-65`

**Interfaces:**
- Produces: `LivePosition.botId?: string | null` — wird von `BotStatus.positions` (Heartbeat-Payload) mitgeführt.

- [ ] **Step 1: Typ ergänzen**

Aktuell (`src/types/bot.ts:53-65`):

```typescript
export interface LivePosition {
  ticket: number
  date: string
  instrument: string
  type: 'long' | 'short'
  entry: number
  currentPrice: number
  size: number
  sl: number | null
  tp: number | null
  pnl: number
  swap: number
}
```

Neu:

```typescript
export interface LivePosition {
  ticket: number
  date: string
  instrument: string
  type: 'long' | 'short'
  entry: number
  currentPrice: number
  size: number
  sl: number | null
  tp: number | null
  pnl: number
  swap: number
  botId?: string | null
}
```

- [ ] **Step 2: TypeScript-Check**

Der Edit löst automatisch den `ts-check.py`-Hook aus (siehe `.claude/hooks/ts-check.py`, läuft bei jedem Edit an `.ts`/`.tsx`-Dateien). Zur Sicherheit zusätzlich manuell:

Run: `npx tsc --noEmit --pretty false`
Expected: Kein Output, Exit-Code 0 (keine neuen Fehler durch das zusätzliche optionale Feld).

- [ ] **Step 3: Commit**

```bash
git add src/types/bot.ts
git commit -m "feat(types): botId zu LivePosition hinzufügen"
```

---

### Task 3: AlphaTrack — Strategie-Bots an die Live-Trades-Seite durchreichen

**Files:**
- Modify: `src/app/bridge/trades/page.tsx`

**Interfaces:**
- Consumes: `getAllBotsWithStatus(): BotWithStatus[]` aus `src/lib/bot-data.ts` (bereits importiert), `BotEntry.type?: 'bridge' | 'bot'` aus `src/types/bot.ts`.
- Produces: Neue Prop `strategyBots: BotEntry[]` an `<BridgeTradesClient>` — alle registrierten Bots mit `type === 'bot'` (unabhängig vom Verbindungsstatus, damit auch kurzzeitig getrennte Bots weiter korrekt benannt werden).

- [ ] **Step 1: Aktuellen Code lesen**

`src/app/bridge/trades/page.tsx` aktuell:

```typescript
export const dynamic = 'force-dynamic'

import { getProfiles, getActiveProfile, setActiveProfileId } from '@/lib/profiles'
import { getAllBotsWithStatus } from '@/lib/bot-data'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import BridgeTradesClient from './BridgeTradesClient'

export default async function BridgeTradesPage() {
  const profiles = getProfiles()
  if (profiles.length === 0) redirect('/setup')

  let activeProfile = getActiveProfile()
  if (!activeProfile) {
    setActiveProfileId(profiles[0].id)
    activeProfile = profiles[0]
  }

  const bots = getAllBotsWithStatus()
    .filter(({ bot, status }) =>
      (bot.type === 'bridge' || !bot.type) &&
      (status?.connectionState === 'connected' || status?.connectionState === 'warning')
    )
    .map(({ bot }) => bot)

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar profiles={profiles} activeProfile={activeProfile} />
      <BridgeTradesClient bots={bots} />
    </div>
  )
}
```

- [ ] **Step 2: `strategyBots` ergänzen und durchreichen**

Neue Datei-Version:

```typescript
export const dynamic = 'force-dynamic'

import { getProfiles, getActiveProfile, setActiveProfileId } from '@/lib/profiles'
import { getAllBotsWithStatus } from '@/lib/bot-data'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import BridgeTradesClient from './BridgeTradesClient'

export default async function BridgeTradesPage() {
  const profiles = getProfiles()
  if (profiles.length === 0) redirect('/setup')

  let activeProfile = getActiveProfile()
  if (!activeProfile) {
    setActiveProfileId(profiles[0].id)
    activeProfile = profiles[0]
  }

  const allBots = getAllBotsWithStatus().map(({ bot }) => bot)

  const bots = getAllBotsWithStatus()
    .filter(({ bot, status }) =>
      (bot.type === 'bridge' || !bot.type) &&
      (status?.connectionState === 'connected' || status?.connectionState === 'warning')
    )
    .map(({ bot }) => bot)

  const strategyBots = allBots.filter(bot => bot.type === 'bot')

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar profiles={profiles} activeProfile={activeProfile} />
      <BridgeTradesClient bots={bots} strategyBots={strategyBots} />
    </div>
  )
}
```

- [ ] **Step 3: TypeScript-Check**

Run: `npx tsc --noEmit --pretty false`
Expected: Fehler bezüglich fehlender `strategyBots`-Prop in `BridgeTradesClient` (Task 4 behebt das) — an dieser Stelle erwartet, da Task 3 vor Task 4 läuft. Wenn der Fehler exakt `Property 'strategyBots' is missing` lautet, ist Step 2 korrekt.

- [ ] **Step 4: Commit**

```bash
git add src/app/bridge/trades/page.tsx
git commit -m "feat(bridge-trades): Strategie-Bots an Live-Trades-Seite durchreichen"
```

---

### Task 4: AlphaTrack — Bot-Attribution in BridgeTradesClient auflösen

**Files:**
- Modify: `src/app/bridge/trades/BridgeTradesClient.tsx`

**Interfaces:**
- Consumes: `strategyBots: BotEntry[]` aus Task 3, `LivePosition.botId` aus Task 2 (via `/api/bridge/positions`-Response), `BotEntry` aus `@/types/bot`.
- Produces: `pos.botName`/`pos.botId` in `positions`-State entsprechen ab jetzt dem tatsächlichen Strategie-Bot (nicht mehr der Bridge). Badge zeigt Name/Farbe des Strategie-Bots.

- [ ] **Step 1: Import und Props-Interface erweitern**

Aktuell (`BridgeTradesClient.tsx:1-38`):

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity, TrendingUp, TrendingDown, X, AlertTriangle,
  Clock, Layers, RefreshCw
} from 'lucide-react'
import { BotEntry } from '@/types/bot'
import { useTradingLock } from '@/context/TradingLockContext'

const BOT_COLORS = ['#3b82f6', '#a855f7', '#f59e0b', '#06b6d4', '#ec4899', '#84cc16']

function getBotColor(botId: string | undefined, bots: BotEntry[]): string {
  if (!botId) return '#6b7280'
  const idx = bots.findIndex(b => b.id === botId)
  return BOT_COLORS[(idx >= 0 ? idx : 0) % BOT_COLORS.length]
}

interface LivePosition {
  ticket: number
  date: string
  instrument: string
  type: 'long' | 'short'
  entry: number
  currentPrice: number
  size: number
  sl: number | null
  tp: number | null
  pnl: number
  swap: number
  botId?: string
  botName?: string
}

interface Props {
  bots: BotEntry[]
}

export default function BridgeTradesClient({ bots }: Props) {
```

Neu — `Props` erweitern und Destrukturierung anpassen:

```typescript
interface Props {
  bots: BotEntry[]
  strategyBots: BotEntry[]
}

export default function BridgeTradesClient({ bots, strategyBots }: Props) {
```

(Rest der Datei zwischen `getBotColor` und `interface Props` unverändert.)

- [ ] **Step 2: `fetchPositions` — Bot-ID nicht mehr mit Bridge-ID überschreiben**

Aktuell (`BridgeTradesClient.tsx:87-107`):

```typescript
  const fetchPositions = useCallback(async () => {
    if (selectedBotIds.size === 0) return
    setLoadingPositions(true)
    try {
      const results = await Promise.all(
        [...selectedBotIds].map(async (botId) => {
          const bot = bots.find(b => b.id === botId)
          const res = await fetch(`/api/bridge/positions?bridgeId=${botId}`)
          if (!res.ok) return []
          const data = await res.json()
          return (data.positions ?? []).map((p: LivePosition) => ({
            ...p,
            botId,
            botName: bot?.name ?? botId,
          }))
        })
      )
      setPositions(results.flat())
    } catch { /* silent */ }
    finally { setLoadingPositions(false) }
  }, [selectedBotIds, bots])
```

Neu — der Loop-Parameter heißt jetzt explizit `bridgeId` (das war vorher schon inhaltlich die Bridge, nur falsch benannt), `p.botId` (vom Server, aus Task 1+2) wird gegen `strategyBots` aufgelöst, mit Fallback auf die Bridge falls keine Zuordnung existiert (Alt-Positionen ohne Registry-Eintrag):

```typescript
  const fetchPositions = useCallback(async () => {
    if (selectedBotIds.size === 0) return
    setLoadingPositions(true)
    try {
      const results = await Promise.all(
        [...selectedBotIds].map(async (bridgeId) => {
          const bridge = bots.find(b => b.id === bridgeId)
          const res = await fetch(`/api/bridge/positions?bridgeId=${bridgeId}`)
          if (!res.ok) return []
          const data = await res.json()
          return (data.positions ?? []).map((p: LivePosition) => {
            const strategyBot = p.botId ? strategyBots.find(b => b.id === p.botId) : undefined
            return {
              ...p,
              botId: p.botId ?? bridgeId,
              botName: strategyBot?.name ?? bridge?.name ?? bridgeId,
            }
          })
        })
      )
      setPositions(results.flat())
    } catch { /* silent */ }
    finally { setLoadingPositions(false) }
  }, [selectedBotIds, bots, strategyBots])
```

- [ ] **Step 3: `getBotColor`-Aufrufe und Badge-Bedingung auf Strategie-Bots umstellen**

Aktuell (`BridgeTradesClient.tsx:275`, im `positions.map`-Callback):

```typescript
                  const botColor = getBotColor(pos.botId, bots)
```

Neu:

```typescript
                  const botColor = getBotColor(pos.botId, strategyBots)
```

Aktuell (`BridgeTradesClient.tsx:299`, Badge-Bedingung):

```typescript
                              {pos.botName && bots.length > 1 && (
```

Neu — Badge zeigt sich, sobald ein Strategie-Bot aufgelöst werden konnte, unabhängig von der Bridge-Anzahl:

```typescript
                              {pos.botId && strategyBots.some(b => b.id === pos.botId) && (
```

- [ ] **Step 4: TypeScript-Check**

Run: `npx tsc --noEmit --pretty false`
Expected: Kein Output, Exit-Code 0.

- [ ] **Step 5: Frontend im Hot-Reload-Dev-Container manuell mit simulierten Daten verifizieren**

Da eine echte Bot-Zuordnung erst nach dem Bridge-Deploy (Task 5) entsteht, wird hier mit einer manuell injizierten `botId` in der isolierten Dev-Datenkopie getestet:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\windows\sync-dev.ps1
```

Dann per SSH auf dem NAS eine offene Position in der Dev-Datenkopie mit einer bekannten Strategie-Bot-ID versehen (Bot-ID z.B. aus `curl -s http://192.168.178.3:3003/api/bots` entnehmen, ein Eintrag mit `"type":"bot"`):

```bash
ssh -i ~/.ssh/alphatrack_nas -p 88 G99SEMAN@192.168.178.3 "cat /volume1/docker/alphatrack-dev/data-dev/bot-positions--KpVEYjcXw.json"
```

Falls eine offene Position existiert, per SSH das `botId`-Feld im ersten Eintrag ergänzen (Beispiel mit `Ig2am7_HxU` = "Scalping V1"):

```bash
ssh -i ~/.ssh/alphatrack_nas -p 88 G99SEMAN@192.168.178.3 "python3 -c \"
import json
p = '/volume1/docker/alphatrack-dev/data-dev/bot-positions--KpVEYjcXw.json'
data = json.load(open(p))
if data:
    data[0]['botId'] = 'Ig2am7_HxU'
    json.dump(data, open(p, 'w'), indent=2)
    print('OK, botId gesetzt auf', data[0])
else:
    print('keine offene Position zum Testen vorhanden')
\""
```

Danach Screenshot:

```powershell
cd C:\Users\G99SEMAN\Desktop\AlphaTrack
$env:ALPHATRACK_URL = "http://192.168.178.3:3003"
$env:WAIT_MS = "3000"
node ".claude\skills\run-alphatrack\driver.mjs" screenshot ".claude\skills\run-alphatrack\bot-attribution-check.png" /bridge/trades
```

Expected: Screenshot zeigt bei der offenen Position ein farbiges Badge mit dem Namen "Scalping V1" (oder dem verwendeten Test-Bot) statt "AGP v1"/Bridge-Namen. Screenshot mit `Read` prüfen.

- [ ] **Step 6: Commit**

```bash
git add src/app/bridge/trades/BridgeTradesClient.tsx
git commit -m "feat(bridge-trades): Live-Positionen dem tatsächlichen Strategie-Bot zuordnen"
```

---

### Task 5: Bridge-Deploy auf Mini-PC + Live-Verifikation (Freigabe erforderlich)

**Files:** keine Code-Änderung — reiner Deploy-/Verifikationsschritt.

**Interfaces:** keine.

- [ ] **Step 1: Explizite Freigabe einholen**

Vor diesem Schritt beim Nutzer nachfragen, ob `bridge/main.py` jetzt auf den Mini-PC deployt werden soll — das betrifft die laufende Trading-Infrastruktur. Nicht automatisch ausführen.

- [ ] **Step 2: Deploy (nach Freigabe)**

```
scripts\windows\deploy.bat
```

(Deployt sowohl den NAS-Container — inkl. der in Task 1-4 gebauten UI-Änderungen — als auch `bridge/` auf den Mini-PC, siehe `docs/DEPLOYMENT.md` Abschnitt 2.)

- [ ] **Step 3: Live-Verifikation**

Nach erfolgreichem Deploy einen Testtrade über einen Bot auslösen (oder auf den nächsten natürlichen Trade warten) und prüfen:

```
curl -s http://192.168.178.3:3002/api/bridge/positions?bridgeId=<bridge-id>
```

Expected: Die zurückgegebene Position enthält ein `botId`-Feld, das der auslösenden Strategie entspricht. In der UI unter `http://192.168.178.3:3002/bridge/trades` erscheint das Badge mit dem korrekten Bot-Namen.

- [ ] **Step 4: Commit (nur falls Step 2/3 Config-Änderungen wie `deploy.config.json` erzeugt haben, sonst überspringen)**

`deploy.config.json` ist gitignored — normalerweise kein Commit nötig.
