# Kalender: Jahres-Heatmap, News-Overlay, Bester/Schlechtester Tag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den Dashboard-Trading-Kalender um eine Jahres-Heatmap (GitHub-Contribution-Stil), ein High-Impact-News-Overlay und eine Bester/Schlechtester-Tag-Hervorhebung erweitern.

**Architektur:** Die Jahres-Heatmap bekommt eine eigene Komponente (`YearHeatmap.tsx`), die per View-Toggle im Kalender-Header die Monatsansicht in derselben Karte ersetzt. Die News-Fetch-Logik wird aus der bestehenden API-Route in eine geteilte Lib-Funktion gezogen, damit sowohl die Route als auch das serverseitig rendernde Dashboard sie nutzen. Bester/Schlechtester Tag ist eine rein clientseitige Berechnung aus bereits vorhandenen Daten, analog zur bestehenden Streak-Berechnung.

**Tech Stack:** Next.js 15 (App Router), React (Client Component), TypeScript, inline `style`-Objekte (bestehende Projektkonvention), `lucide-react` für Icons.

## Global Constraints

- Keine automatisierten Tests in diesem Projekt — Verifikation über `npx tsc --noEmit` (läuft zusätzlich automatisch per Hook nach jedem Edit) und visuelle Prüfung im laufenden Dev-Server.
- Visuelle Prüfung erfolgt auf dem NAS-Hot-Reload-Dev-Container (`http://192.168.178.3:3003`), NICHT lokal. Sync-Befehl aus dem Repo-Root: `echo "" | .\scripts\windows\sync-dev.bat` (PowerShell — überspringt den abschließenden Pause-Prompt).
- Screenshots/Checks über den Skill `run-alphatrack`: `$env:ALPHATRACK_URL = "http://192.168.178.3:3003"; node ".claude\skills\run-alphatrack\driver.mjs" screenshot ss.png /dashboard` — **im selben PowerShell-Aufruf wie das Setzen der Env-Var**, sonst geht sie zwischen Tool-Calls verloren. Muss über PowerShell laufen, nicht Bash (Git Bash verstümmelt den führenden `/`-Pfad).
- News-Daten sind NUR für die aktuelle + nächste Woche verfügbar (siehe Spec, Abschnitt "Wichtige Einschränkung") — kein Fehlerzustand, wenn für einen Monat keine News-Marker erscheinen.
- Bestehender dunkler Look/Farbpalette bleibt unverändert.
- Spec-Referenz: `docs/superpowers/specs/2026-07-09-calendar-heatmap-news-topday-design.md`

---

## Task 1: Geteilte Wirtschaftskalender-Fetch-Funktion

**Files:**
- Modify: `src/lib/wirtschaftskalender.ts` (neue Funktion `getWirtschaftskalenderData()`)
- Modify: `src/app/api/wirtschaftskalender/route.ts` (auf neue Funktion umgestellt)

**Interfaces:**
- Produces: `getWirtschaftskalenderData(): Promise<WirtschaftskalenderData & { source: 'bridge' | 'tradays' | 'error' }>` — exportiert aus `src/lib/wirtschaftskalender.ts`. Task 2 importiert und ruft diese Funktion auf.

- [ ] **Step 1: `getWirtschaftskalenderData()` in `wirtschaftskalender.ts` ergänzen**

Aktueller Code (Zeile 1, Import-Zeile):
```typescript
import type { WirtschaftsEvent, WirtschaftskalenderData } from '@/types/wirtschaftskalender'
```

Ersetzen durch:
```typescript
import type { WirtschaftsEvent, WirtschaftskalenderData } from '@/types/wirtschaftskalender'
import { getBots } from '@/lib/bot-data'
```

Aktueller Code (letzte Zeilen der Datei, Ende der bestehenden `fetchWirtschaftskalender`-Funktion):
```typescript
    .filter(e => { const k = `${e.country}-${e.date}-${e.title}`; if (seen.has(k)) return false; seen.add(k); return true })
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))

  return { events, fetchedAt: new Date().toISOString() }
}
```

Ersetzen durch:
```typescript
    .filter(e => { const k = `${e.country}-${e.date}-${e.title}`; if (seen.has(k)) return false; seen.add(k); return true })
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))

  return { events, fetchedAt: new Date().toISOString() }
}

export interface WirtschaftskalenderResult extends WirtschaftskalenderData {
  source: 'bridge' | 'tradays' | 'error'
}

export async function getWirtschaftskalenderData(): Promise<WirtschaftskalenderResult> {
  // Bridge zuerst probieren - nur wenn Events zurückkommen
  const bots = getBots()
  for (const bot of bots) {
    try {
      const data = await fetchWirtschaftskalenderFromBridge(bot.url)
      if (data.events.length > 0) {
        return { ...data, source: 'bridge' }
      }
    } catch {
      // nächsten Bot oder Fallback versuchen
    }
  }

  // Fallback: Tradays
  try {
    const data = await fetchWirtschaftskalender()
    return { ...data, source: 'tradays' }
  } catch {
    return { events: [], fetchedAt: new Date().toISOString(), source: 'error' }
  }
}
```

- [ ] **Step 2: `route.ts` auf die geteilte Funktion umstellen**

Aktueller Code (komplette Datei `src/app/api/wirtschaftskalender/route.ts`):
```typescript
import { NextResponse } from 'next/server'
import { fetchWirtschaftskalender, fetchWirtschaftskalenderFromBridge } from '@/lib/wirtschaftskalender'
import { getBots } from '@/lib/bot-data'

export const dynamic = 'force-dynamic'

export async function GET() {
  // Bridge zuerst probieren - nur wenn Events zurückkommen
  const bots = getBots()
  for (const bot of bots) {
    try {
      const data = await fetchWirtschaftskalenderFromBridge(bot.url)
      if (data.events.length > 0) {
        return NextResponse.json({ ...data, source: 'bridge' }, {
          headers: { 'Cache-Control': 'no-store' },
        })
      }
    } catch {
      // nächsten Bot oder Fallback versuchen
    }
  }

  // Fallback: Tradays
  try {
    const data = await fetchWirtschaftskalender()
    return NextResponse.json({ ...data, source: 'tradays' }, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    })
  } catch {
    return NextResponse.json({ events: [], fetchedAt: new Date().toISOString(), source: 'error' }, { status: 500 })
  }
}
```

Ersetzen durch:
```typescript
import { NextResponse } from 'next/server'
import { getWirtschaftskalenderData } from '@/lib/wirtschaftskalender'

export const dynamic = 'force-dynamic'

export async function GET() {
  const data = await getWirtschaftskalenderData()

  if (data.source === 'bridge') {
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
  }
  if (data.source === 'tradays') {
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    })
  }
  return NextResponse.json(data, { status: 500 })
}
```

- [ ] **Step 3: TypeScript-Check**

Run: `npx tsc --noEmit`
Expected: keine Ausgabe. Falls ein Fehler zu einem zirkulären Import zwischen `wirtschaftskalender.ts` und `bot-data.ts` auftritt (unwahrscheinlich — `bot-data.ts` hat keinen Grund, `wirtschaftskalender.ts` zu importieren), als BLOCKED melden statt selbst umzustrukturieren.

- [ ] **Step 4: Verhalten der `/kalender`-Seite manuell prüfen (keine Verhaltensänderung erwartet)**

Sync zum NAS-Dev-Container (PowerShell, aus Repo-Root):
```powershell
echo "" | .\scripts\windows\sync-dev.bat
```
Dann:
```powershell
$env:ALPHATRACK_URL = "http://192.168.178.3:3003"; node ".claude\skills\run-alphatrack\driver.mjs" check /kalender
```
Expected: `Status: 200 | Title: AlphaTrack`. Dies bestätigt, dass die Route nach dem Refactoring weiterhin funktioniert (reines Code-Konsolidierung, kein Verhaltenswechsel).

- [ ] **Step 5: Commit**

```bash
git add src/lib/wirtschaftskalender.ts src/app/api/wirtschaftskalender/route.ts
git commit -m "refactor: extract shared getWirtschaftskalenderData() fetch-fallback chain"
```

---

## Task 2: News-Daten ins Dashboard laden und durchreichen

**Files:**
- Modify: `src/app/dashboard/page.tsx` (News-Daten serverseitig laden)
- Modify: `src/components/dashboard/TradingCalendar.tsx` (neue Prop `highImpactEvents`)

**Interfaces:**
- Consumes: `getWirtschaftskalenderData()` aus Task 1.
- Produces: `TradingCalendar`-Props erweitert um `highImpactEvents: WirtschaftsEvent[]`, für Task 3 (News-Marker-Rendering) nutzbar.

- [ ] **Step 1: News-Daten in `page.tsx` laden**

Aktueller Code:
```tsx
import { getProfiles, getActiveProfile, setActiveProfileId, getProfileTrades } from '@/lib/profiles'
import { computeStats, filterTradesByPeriod } from '@/lib/data'
import { getAllBotsWithStatus } from '@/lib/bot-data'
```

Ersetzen durch:
```tsx
import { getProfiles, getActiveProfile, setActiveProfileId, getProfileTrades } from '@/lib/profiles'
import { computeStats, filterTradesByPeriod } from '@/lib/data'
import { getAllBotsWithStatus } from '@/lib/bot-data'
import { getWirtschaftskalenderData } from '@/lib/wirtschaftskalender'
import { WirtschaftsEvent } from '@/types/wirtschaftskalender'
```

Aktueller Code:
```tsx
  const strategyBots = getAllBotsWithStatus().map(({ bot }) => bot).filter(bot => bot.type === 'bot')
```

Ersetzen durch:
```tsx
  const strategyBots = getAllBotsWithStatus().map(({ bot }) => bot).filter(bot => bot.type === 'bot')

  let highImpactEvents: WirtschaftsEvent[] = []
  try {
    const newsData = await getWirtschaftskalenderData()
    highImpactEvents = newsData.events.filter(e => e.impact === 'High')
  } catch {
    highImpactEvents = []
  }
```

- [ ] **Step 2: Prop an `TradingCalendar` durchreichen**

Aktueller Code:
```tsx
              {/* Kalender — Mitte */}
              <div className="w-full min-w-0 xl:flex-1">
                <TradingCalendar
                  trades={allTrades}
                  currency={activeProfile.currency}
                  strategyBots={strategyBots}
                />
              </div>
```

Ersetzen durch:
```tsx
              {/* Kalender — Mitte */}
              <div className="w-full min-w-0 xl:flex-1">
                <TradingCalendar
                  trades={allTrades}
                  currency={activeProfile.currency}
                  strategyBots={strategyBots}
                  highImpactEvents={highImpactEvents}
                />
              </div>
```

- [ ] **Step 3: Props-Interface in `TradingCalendar.tsx` erweitern**

Aktueller Code (Zeilen 1-17):
```tsx
'use client'

import { Fragment, memo, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Flame, TriangleAlert } from 'lucide-react'
import { Trade } from '@/types/trade'
import { BotEntry } from '@/types/bot'
import { currencySymbol } from '@/lib/currency'
import { getBotColor } from '@/lib/bot-colors'
import DayModal from './DayModal'
import TradeDetailModal from './TradeDetailModal'

interface Props {
  trades: Trade[]
  currency: string
  strategyBots: BotEntry[]
}
```

Ersetzen durch:
```tsx
'use client'

import { Fragment, memo, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Flame, TriangleAlert } from 'lucide-react'
import { Trade } from '@/types/trade'
import { BotEntry } from '@/types/bot'
import { WirtschaftsEvent } from '@/types/wirtschaftskalender'
import { currencySymbol } from '@/lib/currency'
import { getBotColor } from '@/lib/bot-colors'
import DayModal from './DayModal'
import TradeDetailModal from './TradeDetailModal'

interface Props {
  trades: Trade[]
  currency: string
  strategyBots: BotEntry[]
  highImpactEvents: WirtschaftsEvent[]
}
```

- [ ] **Step 4: Funktionssignatur anpassen**

Aktueller Code:
```tsx
function TradingCalendar({ trades, currency, strategyBots }: Props) {
```

Ersetzen durch:
```tsx
function TradingCalendar({ trades, currency, strategyBots, highImpactEvents }: Props) {
```

- [ ] **Step 5: TypeScript-Check**

Run: `npx tsc --noEmit`
Expected: keine Ausgabe. `highImpactEvents` ist an dieser Stelle noch ungenutzt — das ist in diesem Projekt (kein `noUnusedLocals` in `tsconfig.json`) kein Fehler.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/page.tsx src/components/dashboard/TradingCalendar.tsx
git commit -m "feat: load high-impact economic events into dashboard calendar"
```

---

## Task 3: News-Marker in der Tageszelle rendern

**Files:**
- Modify: `src/components/dashboard/TradingCalendar.tsx`

**Interfaces:**
- Consumes: `highImpactEvents: WirtschaftsEvent[]` (Task 2).

- [ ] **Step 1: `newsByDate`-Map berechnen**

Direkt nach dem bestehenden `botsByDay`-`useMemo`-Block, aktueller Code:
```tsx
  // Eindeutige Bot-IDs pro Tag (nur Trades mit botId, für die Bot-Punkte-Anzeige)
  const botsByDay = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const t of trades) {
      if (t.status !== 'closed' || t.pnl === undefined || !t.botId) continue
      const dateStr = (t.closeTime ?? t.date).slice(0, 10)
      const existing = map.get(dateStr) ?? []
      if (!existing.includes(t.botId)) existing.push(t.botId)
      map.set(dateStr, existing)
    }
    return map
  }, [trades])
```

Ersetzen durch:
```tsx
  // Eindeutige Bot-IDs pro Tag (nur Trades mit botId, für die Bot-Punkte-Anzeige)
  const botsByDay = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const t of trades) {
      if (t.status !== 'closed' || t.pnl === undefined || !t.botId) continue
      const dateStr = (t.closeTime ?? t.date).slice(0, 10)
      const existing = map.get(dateStr) ?? []
      if (!existing.includes(t.botId)) existing.push(t.botId)
      map.set(dateStr, existing)
    }
    return map
  }, [trades])

  // High-Impact-Events pro Tag (Key: YYYY-MM-DD, wie WirtschaftsEvent.date bereits formatiert ist)
  const newsByDate = useMemo(() => {
    const map = new Map<string, WirtschaftsEvent[]>()
    for (const e of highImpactEvents) {
      const existing = map.get(e.date) ?? []
      existing.push(e)
      map.set(e.date, existing)
    }
    return map
  }, [highImpactEvents])
```

- [ ] **Step 2: `dayNews`-Variable pro Zelle bereitstellen**

Aktueller Code (Kopf der Tageszellen-Berechnung):
```tsx
                const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const data = pnlByDay.get(key)
                const dayBotIds = botsByDay.get(key) ?? []
                const isToday = key === todayStr
```

Ersetzen durch:
```tsx
                const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const data = pnlByDay.get(key)
                const dayBotIds = botsByDay.get(key) ?? []
                const dayNews = newsByDate.get(key)
                const isToday = key === todayStr
```

- [ ] **Step 3: News-Punkt neben der Tageszahl rendern**

Aktueller Code (erste Zeile innerhalb der Tageszelle):
```tsx
                    <span style={{ fontSize: 9, fontWeight: 600, color: isToday ? 'var(--accent)' : 'var(--text-3)' }}>
                      {day}
                    </span>
                    {data && (
```

Ersetzen durch:
```tsx
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span style={{ fontSize: 9, fontWeight: 600, color: isToday ? 'var(--accent)' : 'var(--text-3)' }}>
                        {day}
                      </span>
                      {dayNews && (
                        <span
                          title={dayNews.map(e => `${e.title} (${e.time})`).join(', ')}
                          style={{
                            width: 5, height: 5, borderRadius: '50%',
                            background: '#ff4560', flexShrink: 0,
                            boxShadow: '0 0 4px rgba(255,69,96,0.6)',
                          }}
                        />
                      )}
                    </div>
                    {data && (
```

- [ ] **Step 4: TypeScript-Check**

Run: `npx tsc --noEmit`
Expected: keine Ausgabe.

- [ ] **Step 5: Visuelle Prüfung auf dem NAS-Dev-Container**

Sync (PowerShell, aus Repo-Root):
```powershell
echo "" | .\scripts\windows\sync-dev.bat
```
Screenshot der aktuellen Kalenderwoche prüfen (`$env:ALPHATRACK_URL = "http://192.168.178.3:3003"; node ".claude\skills\run-alphatrack\driver.mjs" screenshot ss.png /dashboard` — dann mit Read ansehen, danach löschen). Erwartet: Tage mit High-Impact-News in der aktuellen/nächsten Woche zeigen einen kleinen roten Punkt neben der Tageszahl. Falls in der aktuellen Woche zufällig keine High-Impact-News anstehen, ist das kein Fehler — dann sind einfach keine Punkte sichtbar (siehe Global Constraints).

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/TradingCalendar.tsx
git commit -m "feat: render high-impact news marker on calendar day cells"
```

---

## Task 4: Bester/Schlechtester Tag im Monat

**Files:**
- Modify: `src/components/dashboard/TradingCalendar.tsx`

**Interfaces:**
- Produces: `topFlopDates: { best: Set<string>; worst: Set<string> }` — Sets von `YYYY-MM-DD`-Keys.

- [ ] **Step 1: `topFlopDates`-Berechnung einfügen**

Direkt nach dem bestehenden `streakByDate`-`useMemo`-Block, aktueller Code:
```tsx
      if (runLength >= 3) {
        if (prevKey && runLength > 3) result.delete(prevKey)
        result.set(key, { length: runLength, isWin })
      }
      prevKey = key
    }
    return result
  }, [pnlByDay, year, month])

  function prevMonth() {
```

Ersetzen durch:
```tsx
      if (runLength >= 3) {
        if (prevKey && runLength > 3) result.delete(prevKey)
        result.set(key, { length: runLength, isWin })
      }
      prevKey = key
    }
    return result
  }, [pnlByDay, year, month])

  // Bester/schlechtester Handelstag im sichtbaren Monat (nur wenn P&L > 0 bzw. < 0 — kein "bester Tag"
  // in einem komplett negativen Monat). Bei Gleichstand werden alle betroffenen Tage markiert.
  const topFlopDates = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`
    let bestPnl = -Infinity
    let worstPnl = Infinity
    for (const [key, data] of pnlByDay) {
      if (!key.startsWith(prefix)) continue
      if (data.pnl > bestPnl) bestPnl = data.pnl
      if (data.pnl < worstPnl) worstPnl = data.pnl
    }
    const best = new Set<string>()
    const worst = new Set<string>()
    for (const [key, data] of pnlByDay) {
      if (!key.startsWith(prefix)) continue
      if (bestPnl > 0 && data.pnl === bestPnl) best.add(key)
      if (worstPnl < 0 && data.pnl === worstPnl) worst.add(key)
    }
    return { best, worst }
  }, [pnlByDay, year, month])

  function prevMonth() {
```

- [ ] **Step 2: Rahmen-/Glow-Override für Top-/Flop-Tag**

Aktueller Code (Farb-/Glow-Berechnung, direkt vor der `streak`-Zuweisung):
```tsx
                let bg = 'rgba(255,255,255,0.015)'
                let borderColor = 'var(--border-subtle)'
                let glow: string | undefined
                if (data) {
                  const intensity = Math.min(Math.abs(data.pnl) / 500, 1)
                  if (pnlPos) {
                    bg = `rgba(0, 217, 126, ${0.08 + intensity * 0.18})`
                    borderColor = `rgba(0, 217, 126, ${0.15 + intensity * 0.2})`
                    glow = `0 2px 10px -2px rgba(0, 217, 126, ${0.1 + intensity * 0.25})`
                  } else {
                    bg = `rgba(255, 69, 96, ${0.08 + intensity * 0.18})`
                    borderColor = `rgba(255, 69, 96, ${0.15 + intensity * 0.2})`
                    glow = `0 2px 10px -2px rgba(255, 69, 96, ${0.1 + intensity * 0.25})`
                  }
                }
                const streak = streakByDate.get(key)
```

Ersetzen durch:
```tsx
                let bg = 'rgba(255,255,255,0.015)'
                let borderColor = 'var(--border-subtle)'
                let glow: string | undefined
                if (data) {
                  const intensity = Math.min(Math.abs(data.pnl) / 500, 1)
                  if (pnlPos) {
                    bg = `rgba(0, 217, 126, ${0.08 + intensity * 0.18})`
                    borderColor = `rgba(0, 217, 126, ${0.15 + intensity * 0.2})`
                    glow = `0 2px 10px -2px rgba(0, 217, 126, ${0.1 + intensity * 0.25})`
                  } else {
                    bg = `rgba(255, 69, 96, ${0.08 + intensity * 0.18})`
                    borderColor = `rgba(255, 69, 96, ${0.15 + intensity * 0.2})`
                    glow = `0 2px 10px -2px rgba(255, 69, 96, ${0.1 + intensity * 0.25})`
                  }
                }
                if (topFlopDates.best.has(key)) {
                  borderColor = '#fbbf24'
                  glow = '0 2px 12px -2px rgba(251,191,36,0.5)'
                } else if (topFlopDates.worst.has(key)) {
                  borderColor = '#94a3b8'
                  glow = '0 2px 10px -2px rgba(148,163,184,0.35)'
                }
                const streak = streakByDate.get(key)
```

(`isToday` behält weiterhin Vorrang: die Zeile `border: \`1px solid ${isToday ? 'var(--accent)' : borderColor}\`` weiter unten im JSX wertet `borderColor` erst aus, wenn `isToday` falsch ist — unverändert, keine weitere Anpassung nötig.)

- [ ] **Step 3: TypeScript-Check**

Run: `npx tsc --noEmit`
Expected: keine Ausgabe.

- [ ] **Step 4: Visuelle Prüfung auf dem NAS-Dev-Container**

Sync + Screenshot wie in Task 3, Step 5. Erwartet: der Tag mit dem höchsten Tages-P&L im aktuell angezeigten Monat hat einen auffälligen goldenen Rahmen/Glow, der Tag mit dem niedrigsten (negativsten) P&L einen gedämpften silbrig-grauen Rahmen — beide klar unterscheidbar vom normalen grünen/roten Rahmen der übrigen Tage.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/TradingCalendar.tsx
git commit -m "feat: highlight best and worst trading day of the month"
```

---

## Task 5: `YearHeatmap`-Komponente erstellen

**Files:**
- Create: `src/components/dashboard/YearHeatmap.tsx`

**Interfaces:**
- Consumes: `Trade` Typ aus `@/types/trade` (Felder `status`, `pnl`, `closeTime`, `date` — bereits bekannt aus `TradingCalendar.tsx`).
- Produces: `YearHeatmap({ trades, year, onSelectMonth }: { trades: Trade[]; year: number; onSelectMonth: (year: number, month: number, day: string) => void })` — Default-Export. Task 6 importiert und rendert diese Komponente.

> **Nachtrag (post-implementation):** Der Code unten zeigt noch `for (let w = 0; w < 53; w++)`. Das Review fand einen Bug — 53 Wochen decken nicht jedes Jahr ab (Schaltjahre, deren 1. Januar auf einen Sonntag fällt, z.B. 2012, 2040, verlieren den 31. Dezember). Gefixt in Commit `76a8c6a` auf `w < 54`. Der Code unten ist unverändert als historisches Artefakt belassen — die tatsächlich ausgelieferte Logik in `YearHeatmap.tsx` nutzt 54 Wochen.

- [ ] **Step 1: Komponente erstellen**

```tsx
'use client'

import { useMemo, useState } from 'react'
import { Trade } from '@/types/trade'

interface Props {
  trades: Trade[]
  year: number
  onSelectMonth: (year: number, month: number, day: string) => void
}

interface DayPnl {
  pnl: number
  count: number
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
const CELL_SIZE = 11
const CELL_GAP = 3

function fmtPnlShort(val: number): string {
  const abs = Math.abs(val)
  if (abs >= 1000) return `${val >= 0 ? '' : '-'}${(abs / 1000).toFixed(1)}K`
  return `${val >= 0 ? '' : '-'}${abs.toLocaleString('de-DE', { maximumFractionDigits: 0 })}`
}

function keyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function cellColor(data: DayPnl | undefined, inYear: boolean): string {
  if (!inYear) return 'transparent'
  if (!data) return 'rgba(255,255,255,0.03)'
  const intensity = Math.min(Math.abs(data.pnl) / 500, 1)
  return data.pnl >= 0
    ? `rgba(0, 217, 126, ${0.15 + intensity * 0.65})`
    : `rgba(255, 69, 96, ${0.15 + intensity * 0.65})`
}

export default function YearHeatmap({ trades, year, onSelectMonth }: Props) {
  const [hovered, setHovered] = useState<string | null>(null)

  const pnlByDay = useMemo(() => {
    const map = new Map<string, DayPnl>()
    for (const t of trades) {
      if (t.status !== 'closed' || t.pnl === undefined) continue
      const dateStr = (t.closeTime ?? t.date).slice(0, 10)
      if (!dateStr.startsWith(`${year}-`)) continue
      const existing = map.get(dateStr) ?? { pnl: 0, count: 0 }
      existing.pnl += t.pnl
      existing.count++
      map.set(dateStr, existing)
    }
    return map
  }, [trades, year])

  // Montag der Woche, die den 1. Januar enthält (europäische Woche, Mo=0)
  const jan1 = new Date(year, 0, 1)
  const jan1Dow = (jan1.getDay() + 6) % 7
  const gridStart = new Date(year, 0, 1 - jan1Dow)

  // 53 Wochenspalten decken jedes Jahr sicher ab
  const weeks: Date[][] = []
  for (let w = 0; w < 53; w++) {
    const week: Date[] = []
    for (let d = 0; d < 7; d++) {
      const day = new Date(gridStart)
      day.setDate(gridStart.getDate() + w * 7 + d)
      week.push(day)
    }
    weeks.push(week)
  }

  // Für jede Wochenspalte: Monatsname, wenn diese Woche der erste Auftritt dieses Monats im Jahr ist
  const weekMonthLabels = weeks.map((week, wi) => {
    const firstOfWeek = week[0]
    if (firstOfWeek.getFullYear() !== year) return null
    if (firstOfWeek.getDate() > 7) return null
    const prevWeekMonth = wi > 0 ? weeks[wi - 1][0].getMonth() : -1
    if (firstOfWeek.getMonth() === prevWeekMonth) return null
    return MONTH_LABELS[firstOfWeek.getMonth()]
  })

  const hoveredData = hovered ? pnlByDay.get(hovered) : undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <div style={{ display: 'flex', gap: CELL_GAP, marginBottom: 4 }}>
          {weekMonthLabels.map((label, wi) => (
            <div key={wi} style={{ width: CELL_SIZE, fontSize: 9, color: 'var(--text-3)', flexShrink: 0 }}>
              {label ?? ''}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: CELL_GAP }}>
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: CELL_GAP, flexShrink: 0 }}>
              {week.map((d, di) => {
                const key = keyOf(d)
                const inYear = d.getFullYear() === year
                const data = pnlByDay.get(key)
                const clickable = inYear && !!data
                return (
                  <div
                    key={di}
                    onMouseEnter={() => inYear && setHovered(key)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={clickable ? () => onSelectMonth(d.getFullYear(), d.getMonth(), key) : undefined}
                    style={{
                      width: CELL_SIZE, height: CELL_SIZE, borderRadius: 3,
                      background: cellColor(data, inYear),
                      cursor: clickable ? 'pointer' : 'default',
                      border: hovered === key ? '1px solid var(--accent)' : '1px solid transparent',
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <div style={{ height: 20, fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-dm-mono)' }}>
        {hovered
          ? `${hovered.split('-').reverse().join('.')} · ${
              hoveredData
                ? `${hoveredData.pnl >= 0 ? '+' : ''}${fmtPnlShort(hoveredData.pnl)} € · ${hoveredData.count} ${hoveredData.count === 1 ? 'Trade' : 'Trades'}`
                : 'Keine Trades'
            }`
          : 'Tag mit Trades anklicken für Details'}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript-Check**

Run: `npx tsc --noEmit`
Expected: keine Ausgabe.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/YearHeatmap.tsx
git commit -m "feat: add YearHeatmap component (GitHub-style contribution grid)"
```

---

## Task 6: Jahres-Heatmap in den Kalender einbinden

**Files:**
- Modify: `src/components/dashboard/TradingCalendar.tsx`

**Interfaces:**
- Consumes: `YearHeatmap` aus Task 5 (`{ trades, year, onSelectMonth }` Props, siehe Task 5 Interfaces).

- [ ] **Step 1: Import und `viewMode`-State ergänzen**

Aktueller Code:
```tsx
import DayModal from './DayModal'
import TradeDetailModal from './TradeDetailModal'
```

Ersetzen durch:
```tsx
import DayModal from './DayModal'
import TradeDetailModal from './TradeDetailModal'
import YearHeatmap from './YearHeatmap'
```

Aktueller Code:
```tsx
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)
```

Ersetzen durch:
```tsx
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month')
```

- [ ] **Step 2: `prevYear`/`nextYear` ergänzen**

Aktueller Code:
```tsx
  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }
  function goToday() { setYear(now.getFullYear()); setMonth(now.getMonth()) }
```

Ersetzen durch:
```tsx
  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }
  function goToday() { setYear(now.getFullYear()); setMonth(now.getMonth()) }
  function prevYear() { setYear(y => y - 1) }
  function nextYear() { setYear(y => y + 1) }
```

- [ ] **Step 3: Header um View-Toggle erweitern**

Aktueller Code (komplette "Header row"):
```tsx
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={prevMonth} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-2)' }}>
            <ChevronLeft size={14} />
          </button>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', minWidth: 120, textAlign: 'center' }}>
            {monthNames[month]} {year}
          </span>
          <button onClick={nextMonth} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-2)' }}>
            <ChevronRight size={14} />
          </button>
        </div>

        <button
          onClick={goToday}
          style={{ fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer' }}
        >
          Dieser Monat
        </button>

        {/* Monthly stats */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 8,
            background: monthlyPnl >= 0
              ? 'linear-gradient(135deg, rgba(0,217,126,0.18), rgba(0,217,126,0.08))'
              : 'linear-gradient(135deg, rgba(255,69,96,0.18), rgba(255,69,96,0.08))',
            border: `1px solid ${monthlyPnl >= 0 ? 'rgba(0,217,126,0.25)' : 'rgba(255,69,96,0.25)'}`,
            color: monthlyPnl >= 0 ? 'var(--green)' : 'var(--red)',
            fontFamily: 'var(--font-dm-mono)',
          }}>
            {monthlyPnl >= 0 ? '+' : ''}{monthlyPnl.toLocaleString('de-DE', { maximumFractionDigits: 0 })} {sym}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 8,
            background: 'linear-gradient(135deg, rgba(59,130,246,0.18), rgba(59,130,246,0.08))',
            border: '1px solid rgba(59,130,246,0.25)', color: 'var(--accent)',
          }}>
            {monthlyTradingDays} {monthlyTradingDays === 1 ? 'Tag' : 'Tage'}
          </span>
        </div>
      </div>
```

Ersetzen durch:
```tsx
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        {viewMode === 'month' ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={prevMonth} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-2)' }}>
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', minWidth: 120, textAlign: 'center' }}>
                {monthNames[month]} {year}
              </span>
              <button onClick={nextMonth} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-2)' }}>
                <ChevronRight size={14} />
              </button>
            </div>

            <button
              onClick={goToday}
              style={{ fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer' }}
            >
              Dieser Monat
            </button>

            <button
              onClick={() => setViewMode('year')}
              style={{ fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer' }}
            >
              Jahr
            </button>

            {/* Monthly stats */}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 8,
                background: monthlyPnl >= 0
                  ? 'linear-gradient(135deg, rgba(0,217,126,0.18), rgba(0,217,126,0.08))'
                  : 'linear-gradient(135deg, rgba(255,69,96,0.18), rgba(255,69,96,0.08))',
                border: `1px solid ${monthlyPnl >= 0 ? 'rgba(0,217,126,0.25)' : 'rgba(255,69,96,0.25)'}`,
                color: monthlyPnl >= 0 ? 'var(--green)' : 'var(--red)',
                fontFamily: 'var(--font-dm-mono)',
              }}>
                {monthlyPnl >= 0 ? '+' : ''}{monthlyPnl.toLocaleString('de-DE', { maximumFractionDigits: 0 })} {sym}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 8,
                background: 'linear-gradient(135deg, rgba(59,130,246,0.18), rgba(59,130,246,0.08))',
                border: '1px solid rgba(59,130,246,0.25)', color: 'var(--accent)',
              }}>
                {monthlyTradingDays} {monthlyTradingDays === 1 ? 'Tag' : 'Tage'}
              </span>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={prevYear} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-2)' }}>
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', minWidth: 60, textAlign: 'center' }}>
                {year}
              </span>
              <button onClick={nextYear} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-2)' }}>
                <ChevronRight size={14} />
              </button>
            </div>

            <button
              onClick={() => setViewMode('month')}
              style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 8, background: 'var(--accent-bg)', border: '1px solid var(--accent)', color: 'var(--accent)', cursor: 'pointer' }}
            >
              Monat
            </button>
          </>
        )}
      </div>
```

- [ ] **Step 4: Grid bei `viewMode === 'year'` durch `YearHeatmap` ersetzen**

Aktueller Code (Anfang des Grid-Blocks):
```tsx
      {/* Grid + Week column — ein gemeinsames Grid, damit KW-Boxen exakt auf Zeilenhöhe der jeweiligen Woche sitzen */}
      <div
        className="grid grid-cols-7 sm:[grid-template-columns:repeat(7,minmax(0,1fr))_130px]"
        style={{ gap: 5 }}
      >
```

Ersetzen durch:
```tsx
      {/* Grid + Week column — ein gemeinsames Grid, damit KW-Boxen exakt auf Zeilenhöhe der jeweiligen Woche sitzen */}
      {viewMode === 'year' ? (
        <YearHeatmap
          trades={trades}
          year={year}
          onSelectMonth={(y, m, day) => {
            setYear(y)
            setMonth(m)
            setViewMode('month')
            setSelectedDay(day)
          }}
        />
      ) : (
      <div
        className="grid grid-cols-7 sm:[grid-template-columns:repeat(7,minmax(0,1fr))_130px]"
        style={{ gap: 5 }}
      >
```

Aktueller Code (Ende des Grid-Blocks, direkt vor der `DayModal`-Bedingung):
```tsx
            </Fragment>
          )
        })}
      </div>

      {selectedDay && (
```

Ersetzen durch:
```tsx
            </Fragment>
          )
        })}
      </div>
      )}

      {selectedDay && (
```

- [ ] **Step 5: TypeScript-Check**

Run: `npx tsc --noEmit`
Expected: keine Ausgabe.

- [ ] **Step 6: Visuelle Prüfung auf dem NAS-Dev-Container**

Sync (PowerShell, aus Repo-Root):
```powershell
echo "" | .\scripts\windows\sync-dev.bat
```
Danach Screenshot der Dashboard-Seite prüfen: Button „Jahr" im Kalender-Header ist sichtbar. Klick würde in die Jahresansicht wechseln (Klick lässt sich mit dem Screenshot-Skill nicht direkt ausführen — für den Klick-Test den Playwright-MCP-Browser verwenden: `mcp__playwright__browser_navigate` auf `http://192.168.178.3:3003/dashboard`, dann `mcp__playwright__browser_click` auf den „Jahr"-Button, dann `mcp__playwright__browser_take_screenshot`). Erwartet: 53-Wochen-Raster mit Monatsbeschriftungen erscheint an Stelle der Monatsansicht, Hover über eine Zelle mit Trades zeigt Datum+P&L in der Fußzeile, Klick auf einen Tag mit Trades wechselt zurück in die Monatsansicht und öffnet `DayModal` für diesen Tag. Klick auf „Monat" im Jahres-Header wechselt zurück ohne Tagesauswahl.

- [ ] **Step 7: Commit**

```bash
git add src/components/dashboard/TradingCalendar.tsx
git commit -m "feat: wire year-heatmap view toggle into TradingCalendar"
```

---

## Task 7: Abschlussprüfung

**Files:**
- Keine Datei-Änderungen erwartet — reiner Verifikationsschritt.

- [ ] **Step 1: Vollständiger TypeScript-Check**

Run: `npx tsc --noEmit`
Expected: keine Ausgabe.

- [ ] **Step 2: `git status` prüfen**

Run: `git status --short`
Expected: keine liegen gebliebenen Screenshot-Dateien (`ss.png` o.ä.) im Repo-Root — falls doch, löschen statt committen.

- [ ] **Step 3: Gemeinsamer Rundgang aller drei Features auf dem NAS-Dev-Container**

Playwright-MCP-Browser verwenden (nicht nur Screenshot-Skill, da Klick-Interaktionen geprüft werden müssen):
1. `mcp__playwright__browser_navigate` → `http://192.168.178.3:3003/dashboard`
2. `mcp__playwright__browser_console_messages` mit `onlyErrors: true` prüfen — erwartet 0 Errors (insbesondere kein Hydration-Mismatch durch die neuen Komponenten)
3. Monatsansicht: News-Punkt (falls in aktueller/nächster Woche High-Impact-News anstehen), Top-/Flop-Tag-Rahmen (falls der Monat sowohl Gewinn- als auch Verlusttage hat) gemeinsam mit Streak-Badges und Bot-Punkten aus der vorherigen Runde sichtbar, keine Layout-Kollisionen
4. Klick auf „Jahr" → Heatmap erscheint, Klick auf einen Tag mit Trades → zurück in Monatsansicht, `DayModal` offen für den richtigen Tag
5. `mcp__playwright__browser_close` danach nicht vergessen, temporäre Screenshot-Dateien im Repo-Root löschen

- [ ] **Step 4: Aufräumen**

```powershell
Remove-Item ss.png -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .playwright-mcp -ErrorAction SilentlyContinue
```

Kein Commit in diesem Task — reine Verifikation der vorherigen sechs Tasks.
