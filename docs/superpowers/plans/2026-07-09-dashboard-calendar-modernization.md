# Dashboard-Kalender Modernisierung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den Dashboard-Trading-Kalender (`TradingCalendar.tsx`) visuell aufwerten und um Streak-Badges (Gewinn-/Verlustserien) sowie Bot-Punkte (welche Strategie-Bots haben an dem Tag gehandelt) erweitern.

**Architektur:** Alles bleibt in der bestehenden Client-Komponente `TradingCalendar.tsx` (kein neuer State-Management-Layer). Die einzige neue Datei ist eine geteilte Bot-Farb-Utility (`src/lib/bot-colors.ts`), die aus den zwei bereits existierenden Duplikaten (`BridgeTradesClient.tsx`, `RecentTradesCard.tsx`) extrahiert wird, damit `TradingCalendar.tsx` sie als dritter Konsument nutzen kann, ohne sie erneut zu duplizieren. Streaks und Bot-Punkte werden aus bereits vorhandenen Daten (`trades`, `strategyBots`) rein clientseitig berechnet — keine neuen API-Routen oder Datenfelder nötig.

**Tech Stack:** Next.js 15 (App Router), React (Client Component), TypeScript, Tailwind (nur für Grid-Utilities), inline `style`-Objekte (bestehende Konvention in diesem Projekt), `framer-motion` für Hover/Enter-Animationen, `lucide-react` für Icons.

## Global Constraints

- Keine automatisierten Tests in diesem Projekt (kein Jest/Vitest) — Verifikation läuft über `npx tsc --noEmit` (läuft zusätzlich automatisch per Hook nach jedem Edit) und visuelle Prüfung im laufenden Dev-Server.
- Visuelle Prüfung erfolgt auf dem NAS-Hot-Reload-Dev-Container (`http://192.168.178.3:3003`), NICHT lokal — der Nutzer hat das für diese Session als "Dev-Server" festgelegt. Sync-Befehl: `scripts\windows\sync-dev.bat` (PowerShell, aus Repo-Root; `echo "" | .\scripts\windows\sync-dev.bat` um den abschließenden Pause-Prompt zu überspringen).
- Screenshots über den Skill `run-alphatrack`: `node ".claude\skills\run-alphatrack\driver.mjs" screenshot ss.png /dashboard` — **muss über das PowerShell-Tool laufen, nicht Bash** (Git Bash verstümmelt den führenden `/`-Pfad zu einem Windows-Pfad). Danach `ss.png` mit Read ansehen und wieder löschen.
- Bestehender dunkler Look/Farbpalette (`var(--surface)`, `var(--green)`, `var(--red)`, `var(--accent)`, `var(--border)` etc.) bleibt unverändert — nur Politur, kein Redesign der Farbwelt.
- Serien (Streaks) werden nur innerhalb des aktuell angezeigten Monats berechnet, keine Monatsgrenzen-Fortführung (siehe Spec, Abschnitt 4).
- Spec-Referenz: `docs/superpowers/specs/2026-07-09-dashboard-calendar-modernization-design.md`

---

## Task 1: Geteilte Bot-Farb-Utility extrahieren

**Files:**
- Create: `src/lib/bot-colors.ts`
- Modify: `src/app/bridge/trades/BridgeTradesClient.tsx:12-18`
- Modify: `src/components/dashboard/RecentTradesCard.tsx:16-22`

**Interfaces:**
- Produces: `BOT_COLORS: string[]` (6 Hex-Farben), `getBotColor(botId: string | null | undefined, bots: BotEntry[]): string` — beide aus `src/lib/bot-colors.ts` exportiert. Spätere Tasks (Task 6) importieren `getBotColor` von dort.

- [ ] **Step 1: Utility-Datei erstellen**

```typescript
// src/lib/bot-colors.ts
import { BotEntry } from '@/types/bot'

export const BOT_COLORS = ['#3b82f6', '#a855f7', '#f59e0b', '#06b6d4', '#ec4899', '#84cc16']

export function getBotColor(botId: string | null | undefined, bots: BotEntry[]): string {
  if (!botId) return '#6b7280'
  const idx = bots.findIndex(b => b.id === botId)
  return BOT_COLORS[(idx >= 0 ? idx : 0) % BOT_COLORS.length]
}
```

- [ ] **Step 2: `BridgeTradesClient.tsx` auf die geteilte Utility umstellen**

Aktueller Code (Zeilen 1-18):
```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity, TrendingUp, TrendingDown, X, AlertTriangle,
  Clock, Layers, RefreshCw
} from 'lucide-react'
import { BotEntry, LivePosition as BridgeLivePosition } from '@/types/bot'
import { useTradingLock } from '@/context/TradingLockContext'

const BOT_COLORS = ['#3b82f6', '#a855f7', '#f59e0b', '#06b6d4', '#ec4899', '#84cc16']

function getBotColor(botId: string | null | undefined, bots: BotEntry[]): string {
  if (!botId) return '#6b7280'
  const idx = bots.findIndex(b => b.id === botId)
  return BOT_COLORS[(idx >= 0 ? idx : 0) % BOT_COLORS.length]
}
```

Ersetzen durch:
```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity, TrendingUp, TrendingDown, X, AlertTriangle,
  Clock, Layers, RefreshCw
} from 'lucide-react'
import { BotEntry, LivePosition as BridgeLivePosition } from '@/types/bot'
import { useTradingLock } from '@/context/TradingLockContext'
import { BOT_COLORS, getBotColor } from '@/lib/bot-colors'
```

(Die restliche Datei bleibt unverändert — `BOT_COLORS` wird an Zeile 184 (`const dotColor = BOT_COLORS[i % BOT_COLORS.length]`) weiterhin verwendet, jetzt aus dem Import statt lokaler Deklaration.)

- [ ] **Step 3: `RecentTradesCard.tsx` auf die geteilte Utility umstellen**

Aktueller Code (Zeilen 1-22):
```typescript
'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { Trade } from '@/types/trade'
import { BotEntry } from '@/types/bot'
import { currencySymbol } from '@/lib/currency'

interface Props {
  trades: Trade[]
  currency: string
  strategyBots: BotEntry[]
}

const ROWS = 6
const BOT_COLORS = ['#3b82f6', '#a855f7', '#f59e0b', '#06b6d4', '#ec4899', '#84cc16']

function getBotColor(botId: string | null | undefined, bots: BotEntry[]): string {
  if (!botId) return '#6b7280'
  const idx = bots.findIndex(b => b.id === botId)
  return BOT_COLORS[(idx >= 0 ? idx : 0) % BOT_COLORS.length]
}
```

Ersetzen durch:
```typescript
'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { Trade } from '@/types/trade'
import { BotEntry } from '@/types/bot'
import { currencySymbol } from '@/lib/currency'
import { getBotColor } from '@/lib/bot-colors'

interface Props {
  trades: Trade[]
  currency: string
  strategyBots: BotEntry[]
}

const ROWS = 6
```

- [ ] **Step 4: TypeScript-Check**

Run: `npx tsc --noEmit`
Expected: keine Ausgabe (kein Fehler). Insbesondere kein "duplicate identifier" oder "unused variable" für `BOT_COLORS`/`getBotColor` in den beiden geänderten Dateien.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bot-colors.ts src/app/bridge/trades/BridgeTradesClient.tsx src/components/dashboard/RecentTradesCard.tsx
git commit -m "refactor: extract shared bot-color utility to src/lib/bot-colors.ts"
```

---

## Task 2: `strategyBots` bis zu `TradingCalendar` durchreichen

**Files:**
- Modify: `src/app/dashboard/page.tsx:147-153`
- Modify: `src/components/dashboard/TradingCalendar.tsx:1-14`

**Interfaces:**
- Consumes: `strategyBots: BotEntry[]` — bereits in `page.tsx:64` berechnet (`getAllBotsWithStatus().map(({ bot }) => bot).filter(bot => bot.type === 'bot')`), wird nur zusätzlich weitergereicht.
- Produces: `TradingCalendar`-Props erweitert um `strategyBots: BotEntry[]`, für Task 6 (Bot-Punkte) nutzbar.

- [ ] **Step 1: Prop im Dashboard durchreichen**

In `src/app/dashboard/page.tsx`, aktueller Code:
```tsx
              {/* Kalender — Mitte */}
              <div className="w-full min-w-0 xl:flex-1">
                <TradingCalendar
                  trades={allTrades}
                  currency={activeProfile.currency}
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
                />
              </div>
```

- [ ] **Step 2: Props-Interface und Import in `TradingCalendar.tsx` erweitern**

Aktueller Code (Zeilen 1-14):
```tsx
'use client'

import { Fragment, memo, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Trade } from '@/types/trade'
import { currencySymbol } from '@/lib/currency'
import DayModal from './DayModal'
import TradeDetailModal from './TradeDetailModal'

interface Props {
  trades: Trade[]
  currency: string
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

(`Flame`, `TriangleAlert` und `getBotColor` werden erst in Task 5/6 verwendet — Import jetzt schon mitnehmen, damit kein zweiter Diff an derselben Stelle nötig ist. `npx tsc --noEmit` meckert nicht wegen ungenutzter Imports, das Projekt hat keine strikte `noUnusedLocals`-Regel aktiv — falls Step 3 trotzdem einen Fehler dazu zeigt, sind `Flame`/`TriangleAlert`/`getBotColor` an dieser Stelle vorübergehend mit `// eslint-disable-next-line` NICHT nötig, weil sie in Task 5/6 unmittelbar danach verwendet werden; dieser Task und Task 5/6 sollten ohnehin in schneller Folge ausgeführt werden.)

- [ ] **Step 3: Funktionssignatur anpassen**

Aktueller Code:
```tsx
function TradingCalendar({ trades, currency }: Props) {
```

Ersetzen durch:
```tsx
function TradingCalendar({ trades, currency, strategyBots }: Props) {
```

- [ ] **Step 4: TypeScript-Check**

Run: `npx tsc --noEmit`
Expected: keine Ausgabe. Falls ein Fehler zu ungenutzten Imports (`Flame`, `TriangleAlert`, `getBotColor`, `strategyBots`) erscheint, ist das erwartet, bis Task 5/6 sie verwenden — in diesem Fall Step 2 so belassen und direkt mit Task 5 fortfahren, ohne separat zu committen (Task 2 und Task 5/6 dann als ein Commit zusammenfassen). Falls **kein** Fehler erscheint (üblich in diesem Projekt, siehe Klammerhinweis oben), normal weiter zu Step 5.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/page.tsx src/components/dashboard/TradingCalendar.tsx
git commit -m "feat: pass strategyBots prop through to TradingCalendar"
```

---

## Task 3: Visuelle Politur der Tageszellen

**Files:**
- Modify: `src/components/dashboard/TradingCalendar.tsx` (Grid-Gap, Zellen-Styling, Hover, Header-Pills)

**Interfaces:**
- Keine neuen Interfaces — reine Style-Änderungen an bestehendem JSX, keine Logikänderung.

- [ ] **Step 1: Grid-Gap vergrößern**

Aktueller Code:
```tsx
      <div
        className="grid grid-cols-7 sm:[grid-template-columns:repeat(7,minmax(0,1fr))_130px]"
        style={{ gap: 3 }}
      >
```

Ersetzen durch:
```tsx
      <div
        className="grid grid-cols-7 sm:[grid-template-columns:repeat(7,minmax(0,1fr))_130px]"
        style={{ gap: 5 }}
      >
```

- [ ] **Step 2: Gefüllte Tage bekommen Tiefe (Glow-Schatten in PnL-Farbe), leere Tage werden ruhiger**

Aktueller Code (Farb-/Rahmenberechnung + leere Zelle):
```tsx
                if (day === null) {
                  return <div key={di} style={{ gridColumn: di + 1, gridRow: wi + 2, aspectRatio: '1 / 0.85', borderRadius: 8 }} />
                }
                const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const data = pnlByDay.get(key)
                const isToday = key === todayStr
                const pnlPos = data ? data.pnl >= 0 : null
                const winPct = data && data.count > 0 ? Math.round((data.wins / data.count) * 100) : null

                let bg = 'var(--surface-2)'
                let borderColor = 'var(--border-subtle)'
                if (data) {
                  if (pnlPos) {
                    const intensity = Math.min(Math.abs(data.pnl) / 500, 1)
                    bg = `rgba(0, 217, 126, ${0.08 + intensity * 0.18})`
                    borderColor = `rgba(0, 217, 126, ${0.15 + intensity * 0.2})`
                  } else {
                    const intensity = Math.min(Math.abs(data.pnl) / 500, 1)
                    bg = `rgba(255, 69, 96, ${0.08 + intensity * 0.18})`
                    borderColor = `rgba(255, 69, 96, ${0.15 + intensity * 0.2})`
                  }
                }
```

Ersetzen durch:
```tsx
                if (day === null) {
                  return (
                    <div
                      key={di}
                      style={{
                        gridColumn: di + 1, gridRow: wi + 2, aspectRatio: '1 / 0.85',
                        borderRadius: 10, border: '1px solid transparent',
                      }}
                    />
                  )
                }
                const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const data = pnlByDay.get(key)
                const isToday = key === todayStr
                const pnlPos = data ? data.pnl >= 0 : null
                const winPct = data && data.count > 0 ? Math.round((data.wins / data.count) * 100) : null

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
```

(`bg` für leere Handelstage wechselt von `var(--surface-2)` auf ein sehr schwaches `rgba(255,255,255,0.015)`, damit sie deutlich ruhiger wirken als gefüllte Tage — das ist der "leere Tage treten zurück"-Effekt aus der Spec. `glow` ist neu und wird in Step 3 in `boxShadow` verwendet.)

- [ ] **Step 3: `boxShadow` und Radius/Hover der Tageszelle anpassen**

Aktueller Code:
```tsx
                return (
                  <motion.div
                    key={di}
                    onClick={data ? () => setSelectedDay(key) : undefined}
                    style={{
                      gridColumn: di + 1,
                      gridRow: wi + 2,
                      aspectRatio: '1 / 0.85',
                      borderRadius: 8,
                      background: bg,
                      border: `1px solid ${isToday ? 'var(--accent)' : borderColor}`,
                      padding: '4px 5px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      cursor: data ? 'pointer' : 'default',
                      boxShadow: isToday ? '0 0 0 1px var(--accent)' : undefined,
                    }}
                    whileHover={data ? { scale: 1.03 } : {}}
                    transition={{ duration: 0.12 }}
                  >
```

Ersetzen durch:
```tsx
                return (
                  <motion.div
                    key={di}
                    onClick={data ? () => setSelectedDay(key) : undefined}
                    style={{
                      gridColumn: di + 1,
                      gridRow: wi + 2,
                      position: 'relative',
                      aspectRatio: '1 / 0.85',
                      borderRadius: 10,
                      background: bg,
                      border: `1px solid ${isToday ? 'var(--accent)' : borderColor}`,
                      padding: '5px 6px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      cursor: data ? 'pointer' : 'default',
                      boxShadow: isToday ? '0 0 0 1px var(--accent)' : glow,
                    }}
                    whileHover={data ? { scale: 1.03, boxShadow: '0 6px 16px -4px rgba(0,0,0,0.4)' } : {}}
                    transition={{ duration: 0.12 }}
                  >
```

(`position: 'relative'` wird für Task 5 gebraucht, um das Streak-Badge absolut darin zu positionieren — jetzt schon mitnehmen.)

- [ ] **Step 4: Wochen-Stats-Pills im Header auf Gradient umstellen**

Aktueller Code:
```tsx
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 8,
            background: monthlyPnl >= 0 ? 'rgba(0,217,126,0.12)' : 'rgba(255,69,96,0.12)',
            color: monthlyPnl >= 0 ? 'var(--green)' : 'var(--red)',
            fontFamily: 'var(--font-dm-mono)',
          }}>
            {monthlyPnl >= 0 ? '+' : ''}{monthlyPnl.toLocaleString('de-DE', { maximumFractionDigits: 0 })} {sym}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 8, background: 'var(--accent-bg)', color: 'var(--accent)' }}>
            {monthlyTradingDays} {monthlyTradingDays === 1 ? 'Tag' : 'Tage'}
          </span>
        </div>
```

Ersetzen durch:
```tsx
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
```

- [ ] **Step 5: TypeScript-Check**

Run: `npx tsc --noEmit`
Expected: keine Ausgabe.

- [ ] **Step 6: Visuelle Prüfung auf dem NAS-Dev-Container**

Aus dem Repo-Root, PowerShell-Tool (nicht Bash):
```powershell
.\scripts\windows\sync-dev.bat
```
(Bei hängendem "Drücken Sie eine beliebige Taste"-Prompt am Ende: das ist normal, der Sync ist zu dem Zeitpunkt bereits abgeschlossen — Prozess kann beendet werden, kein weiterer Schritt nötig.)

Dann Screenshot über den `run-alphatrack`-Skill (Playwright zeigt bereits auf `192.168.178.3:3003`, falls `ALPHATRACK_URL` entsprechend gesetzt ist — sonst Driver-Aufruf mit `$env:ALPHATRACK_URL = "http://192.168.178.3:3003"` davor) prüfen: gefüllte Tage wirken tiefer/leuchtender, leere Tage treten zurück, Header-Pills haben sichtbares Gradient.

- [ ] **Step 7: Commit**

```bash
git add src/components/dashboard/TradingCalendar.tsx
git commit -m "style: modernize calendar cell depth, spacing and header pills"
```

---

## Task 4: Streak-Berechnung (Gewinn-/Verlustserien)

**Files:**
- Modify: `src/components/dashboard/TradingCalendar.tsx` (neue `useMemo`-Berechnung nach `weekSummaries`)

**Interfaces:**
- Produces: `streakByDate: Map<string, { length: number; isWin: boolean }>` — enthält **nur** Einträge für den jeweils letzten Tag einer laufenden Serie ab Länge 3 (Key: `YYYY-MM-DD`). Task 5 liest diese Map beim Rendern jeder Tageszelle über `streakByDate.get(key)`.

- [ ] **Step 1: Streak-Berechnung einfügen**

Direkt nach dem bestehenden Block (nach `const monthlyTradingDays = ...`, vor `function prevMonth() {`), aktueller Code:
```tsx
  // Monthly totals
  const monthlyPnl = weekSummaries.reduce((s, w) => s + w.pnl, 0)
  const monthlyTradingDays = weekSummaries.reduce((s, w) => s + w.tradingDays, 0)

  function prevMonth() {
```

Ersetzen durch:
```tsx
  // Monthly totals
  const monthlyPnl = weekSummaries.reduce((s, w) => s + w.pnl, 0)
  const monthlyTradingDays = weekSummaries.reduce((s, w) => s + w.tradingDays, 0)

  // Streaks: aufeinanderfolgende Handelstage mit gleichem Vorzeichen (nur innerhalb des sichtbaren Monats,
  // handelsfreie Tage unterbrechen die Serie nicht — siehe Spec Abschnitt 4). Map enthält nur den jeweils
  // letzten Tag einer Serie ab Länge 3.
  const streakByDate = useMemo(() => {
    const result = new Map<string, { length: number; isWin: boolean }>()
    const tradingDayKeys = Array.from(pnlByDay.keys())
      .filter(k => k.startsWith(`${year}-${String(month + 1).padStart(2, '0')}-`))
      .sort()

    let runLength = 0
    let runIsWin: boolean | null = null
    for (const key of tradingDayKeys) {
      const isWin = (pnlByDay.get(key)?.pnl ?? 0) >= 0
      if (runIsWin === isWin) {
        runLength++
      } else {
        runIsWin = isWin
        runLength = 1
      }
      if (runLength >= 3) {
        result.set(key, { length: runLength, isWin })
      } else {
        result.delete(key)
      }
    }
    return result
  }, [pnlByDay, year, month])

  function prevMonth() {
```

- [ ] **Step 2: TypeScript-Check**

Run: `npx tsc --noEmit`
Expected: keine Ausgabe. `streakByDate` ist an dieser Stelle noch ungenutzt — das führt in diesem Projekt (kein `noUnusedLocals`) zu keinem Fehler; falls doch, direkt mit Task 5 fortfahren und beide Tasks in einem Commit zusammenfassen.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/TradingCalendar.tsx
git commit -m "feat: compute win/loss streaks for calendar days"
```

---

## Task 5: Streak-Badges rendern

**Files:**
- Modify: `src/components/dashboard/TradingCalendar.tsx` (Tageszellen-JSX)

**Interfaces:**
- Consumes: `streakByDate.get(key)` aus Task 4, `Flame`/`TriangleAlert` aus `lucide-react` (Import bereits in Task 2 ergänzt).

- [ ] **Step 1: Badge in der Tageszelle rendern**

Aktueller Code (Ende der Tageszelle, nach dem `{data && (...)}`-Block, vor dem schließenden `</motion.div>`):
```tsx
                    {data && (
                      <>
                        <span style={{
                          fontSize: 9, fontWeight: 700,
                          color: pnlPos ? 'var(--green)' : 'var(--red)',
                          fontFamily: 'var(--font-dm-mono)',
                          lineHeight: 1.1,
                        }}>
                          {fmtPnl(data.pnl).replace('$', sym)}
                        </span>
                        <div>
                          <span style={{ fontSize: 8, color: 'var(--text-3)' }}>
                            {data.count} {data.count === 1 ? 'Trade' : 'Trades'}
                          </span>
                          {winPct !== null && (
                            <span style={{ fontSize: 8, color: pnlPos ? 'var(--green)' : 'var(--red)', display: 'block' }}>
                              {winPct}%
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </motion.div>
                )
              })}
```

Ersetzen durch:
```tsx
                    {data && (
                      <>
                        <span style={{
                          fontSize: 9, fontWeight: 700,
                          color: pnlPos ? 'var(--green)' : 'var(--red)',
                          fontFamily: 'var(--font-dm-mono)',
                          lineHeight: 1.1,
                        }}>
                          {fmtPnl(data.pnl).replace('$', sym)}
                        </span>
                        <div>
                          <span style={{ fontSize: 8, color: 'var(--text-3)' }}>
                            {data.count} {data.count === 1 ? 'Trade' : 'Trades'}
                          </span>
                          {winPct !== null && (
                            <span style={{ fontSize: 8, color: pnlPos ? 'var(--green)' : 'var(--red)', display: 'block' }}>
                              {winPct}%
                            </span>
                          )}
                        </div>
                      </>
                    )}
                    {streak && (
                      <span
                        title={streak.isWin ? `${streak.length} Gewinntage in Folge` : `${streak.length} Verlusttage in Folge`}
                        style={{
                          position: 'absolute', top: -5, right: -5,
                          display: 'flex', alignItems: 'center', gap: 1,
                          fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 8,
                          background: streak.isWin ? 'var(--green)' : 'var(--red)',
                          color: '#0a0f14',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                        }}
                      >
                        {streak.isWin
                          ? <Flame size={9} strokeWidth={2.5} />
                          : <TriangleAlert size={9} strokeWidth={2.5} />}
                        {streak.length}
                      </span>
                    )}
                  </motion.div>
                )
              })}
```

- [ ] **Step 2: `streak`-Variable oberhalb des Returns berechnen**

Aktueller Code (direkt vor dem `return (` der Tageszelle, nach der Farb-/Glow-Berechnung aus Task 3):
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

                return (
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
                const streak = streakByDate.get(key)

                return (
```

- [ ] **Step 3: TypeScript-Check**

Run: `npx tsc --noEmit`
Expected: keine Ausgabe.

- [ ] **Step 4: Visuelle Prüfung auf dem NAS-Dev-Container**

Sync (PowerShell, aus Repo-Root):
```powershell
.\scripts\windows\sync-dev.bat
```
Screenshot prüfen: auf einem Tag, der der letzte einer 3+-Serie ist (z.B. 3 grüne Tage in Folge im aktuell angezeigten Testmonat), erscheint oben rechts ein kleines grünes 🔥-Badge mit Zahl; bei 3+ roten Tagen in Folge ein rotes ⚠️-Badge. Tage 1-2 einer Serie zeigen **kein** Badge (nur der letzte Tag der laufenden Serie). Falls im aktuellen Testdatensatz keine Serie ab Länge 3 vorkommt: keine Badges sichtbar ist das korrekte Verhalten, keine Anpassung nötig — ggf. mit einem anderen Monat (Pfeil-Navigation) prüfen, in dem eine Serie vorkommt.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/TradingCalendar.tsx
git commit -m "feat: render streak badges on calendar day cells"
```

---

## Task 6: Bot-Punkte in der Tageszelle

**Files:**
- Modify: `src/components/dashboard/TradingCalendar.tsx` (Tageszellen-Datenaufbereitung + JSX)

**Interfaces:**
- Consumes: `strategyBots: BotEntry[]` (Task 2), `getBotColor` aus `@/lib/bot-colors` (Task 1/2), `trades: Trade[]` (bereits vorhandene Prop, jedes `Trade` hat `botId?: string | null`).
- Produces: `botsByDay: Map<string, string[]>` (Key: `YYYY-MM-DD`, Value: eindeutige `botId`-Liste der Trades dieses Tages) — neuer `useMemo`, analog zu `pnlByDay`.

- [ ] **Step 1: `botsByDay`-Map berechnen**

Direkt nach dem bestehenden `pnlByDay`-`useMemo`-Block, aktueller Code:
```tsx
  const pnlByDay = useMemo(() => {
    const map = new Map<string, DayData>()
    for (const t of trades) {
      if (t.status !== 'closed' || t.pnl === undefined) continue
      const dateStr = (t.closeTime ?? t.date).slice(0, 10)
      const existing = map.get(dateStr) ?? { pnl: 0, count: 0, wins: 0 }
      existing.pnl += t.pnl
      existing.count++
      if (t.pnl > 0) existing.wins++
      map.set(dateStr, existing)
    }
    return map
  }, [trades])
```

Ersetzen durch:
```tsx
  const pnlByDay = useMemo(() => {
    const map = new Map<string, DayData>()
    for (const t of trades) {
      if (t.status !== 'closed' || t.pnl === undefined) continue
      const dateStr = (t.closeTime ?? t.date).slice(0, 10)
      const existing = map.get(dateStr) ?? { pnl: 0, count: 0, wins: 0 }
      existing.pnl += t.pnl
      existing.count++
      if (t.pnl > 0) existing.wins++
      map.set(dateStr, existing)
    }
    return map
  }, [trades])

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

- [ ] **Step 2: Bot-Punkte unterhalb von Trades/Winrate rendern**

Aktueller Code (der `<div>` mit Trades-Anzahl/Winrate innerhalb von `{data && (...)}`):
```tsx
                        <div>
                          <span style={{ fontSize: 8, color: 'var(--text-3)' }}>
                            {data.count} {data.count === 1 ? 'Trade' : 'Trades'}
                          </span>
                          {winPct !== null && (
                            <span style={{ fontSize: 8, color: pnlPos ? 'var(--green)' : 'var(--red)', display: 'block' }}>
                              {winPct}%
                            </span>
                          )}
                        </div>
                      </>
                    )}
```

Ersetzen durch:
```tsx
                        <div>
                          <span style={{ fontSize: 8, color: 'var(--text-3)' }}>
                            {data.count} {data.count === 1 ? 'Trade' : 'Trades'}
                          </span>
                          {winPct !== null && (
                            <span style={{ fontSize: 8, color: pnlPos ? 'var(--green)' : 'var(--red)', display: 'block' }}>
                              {winPct}%
                            </span>
                          )}
                          {dayBotIds.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 2 }}>
                              {dayBotIds.slice(0, 4).map(botId => (
                                <span
                                  key={botId}
                                  title={strategyBots.find(b => b.id === botId)?.name ?? botId}
                                  style={{
                                    width: 5, height: 5, borderRadius: '50%',
                                    background: getBotColor(botId, strategyBots), flexShrink: 0,
                                  }}
                                />
                              ))}
                              {dayBotIds.length > 4 && (
                                <span style={{ fontSize: 7, color: 'var(--text-3)', lineHeight: 1 }}>
                                  +{dayBotIds.length - 4}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </>
                    )}
```

- [ ] **Step 3: `dayBotIds`-Variable bereitstellen**

Aktueller Code (Kopf der Tageszellen-Berechnung, direkt nach `const data = pnlByDay.get(key)`):
```tsx
                const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const data = pnlByDay.get(key)
                const isToday = key === todayStr
```

Ersetzen durch:
```tsx
                const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const data = pnlByDay.get(key)
                const dayBotIds = botsByDay.get(key) ?? []
                const isToday = key === todayStr
```

- [ ] **Step 4: TypeScript-Check**

Run: `npx tsc --noEmit`
Expected: keine Ausgabe.

- [ ] **Step 5: Visuelle Prüfung auf dem NAS-Dev-Container**

Sync (PowerShell, aus Repo-Root):
```powershell
.\scripts\windows\sync-dev.bat
```
Screenshot prüfen: an Tagen mit Bot-Trades erscheinen kleine farbige Punkte unterhalb der Trade-Anzahl/Winrate, in denselben Farben wie die Bot-Tags bei "Letzte Trades" (visueller Konsistenz-Check zwischen den beiden Ansichten). Tage mit ausschließlich manuellen Trades (kein `botId`) zeigen keine Punkte. Bei mehr als 4 Bots an einem Tag erscheint `+N`.

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/TradingCalendar.tsx
git commit -m "feat: render bot-color dots on calendar day cells"
```

---

## Task 7: Aufräumen & Abschlussprüfung

**Files:**
- Keine Datei-Änderungen erwartet — reiner Verifikationsschritt.

- [ ] **Step 1: Vollständiger TypeScript-Check**

Run: `npx tsc --noEmit`
Expected: keine Ausgabe.

- [ ] **Step 2: `git status` prüfen — keine liegen gebliebenen temporären Dateien**

Run: `git status --short`
Expected: keine `ss.png` oder sonstigen Screenshot-Reste im Repo-Root (falls doch: `rm ss.png` bzw. per Bash-Tool löschen, nicht committen).

- [ ] **Step 3: Finaler Screenshot-Rundgang auf dem NAS-Dev-Container**

Sync + Screenshot von `/dashboard` wie in Task 3/5/6 beschrieben. Prüfen: alle drei Features gemeinsam sichtbar (Politur, mind. ein Streak-Badge falls Testdaten das hergeben, Bot-Punkte an Bot-Trade-Tagen), keine Layout-Brüche (KW-Spalte weiterhin passgenau pro Zeile, siehe vorheriger Spec-Stand), keine Konsolen-Fehler (`node driver.mjs check /dashboard` liefert `Status: 200`).

- [ ] **Step 4: Screenshot-Datei löschen**

```powershell
Remove-Item ss.png -ErrorAction SilentlyContinue
```

Kein Commit in diesem Task — reine Verifikation der vorherigen sechs Tasks.
