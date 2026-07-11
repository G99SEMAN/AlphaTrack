# Entry-/Exit-Marker im Trade-Detail-Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Im Trade-Detail-Modal (`TradeDetailModal.tsx`) wird der bisherige TradingView-`<iframe>` durch einen selbst gerenderten `lightweight-charts`-Candlestick-Chart ersetzt, der echte Kursdaten von Twelve Data lädt und Entry-/Exit-Marker sowie SL/TP-Linien einzeichnet.

**Architecture:** Neue Server-Route `/api/quotes/history` holt OHLC-Kerzen von Twelve Data (API-Key bleibt serverseitig). Reine Hilfsfunktionen in `src/lib/quotes.ts` übernehmen Symbol-Mapping (nur Forex) und Zeitfenster-/Intervall-Berechnung aus der Trade-Dauer. Eine neue Client-Komponente `TradeChart.tsx` ruft die Route auf und rendert den Chart mit `lightweight-charts`, inkl. Marker und Preislinien. `TradeDetailModal.tsx` bindet diese Komponente statt des iframes ein.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, `lightweight-charts` (neue Dependency), Twelve Data REST API (`time_series`-Endpunkt), `next-themes` für Dark/Light.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-11-trade-chart-entry-exit-markers-design.md` (Approved).
- **Es gibt keine automatisierte Testsuite in diesem Projekt** (kein Jest/Vitest, kein `npm test`). Verifikation läuft ausschließlich über: (1) den automatischen `tsc --noEmit`-Hook nach jedem Datei-Edit, (2) direkte API-Aufrufe via `.claude\skills\run-alphatrack\driver.mjs api ...`, (3) Browser-Verifikation via Playwright (MCP-Tools oder `driver.mjs screenshot`). Schritte, die in einer klassischen TDD-Vorlage `pytest`/`jest`-Aufrufe wären, sind entsprechend durch diese Mechanismen ersetzt.
- `TWELVE_DATA_API_KEY` ist bereits in `.env.local` gesetzt — keine Env-Änderung nötig.
- Nur Forex-Instrumente (6-Buchstaben-Paare) bekommen Kursdaten; alles andere zeigt direkt die "nicht unterstützt"-Meldung, kein Twelve-Data-Aufruf.
- `TradingViewWidget.tsx` und `AnalyseClient.tsx` (Analyse-Seite) bleiben unverändert.
- Offene Trades werden in diesem Modal nicht behandelt (kommen im Kalender-Tagespopup nicht vor).
- Atomare Schreibvorgänge (`.tmp` + rename) sind für dieses Feature nicht relevant — es werden keine `data/*.json`-Dateien geschrieben.

---

### Task 1: `lightweight-charts` als Dependency hinzufügen

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: `lightweight-charts`-Paket (v4-API: `createChart`, `addCandlestickSeries`, `series.setMarkers`, `series.createPriceLine`) für Task 4.

- [ ] **Step 1: Dependency in package.json eintragen**

In `package.json` im `dependencies`-Block (alphabetisch nach `jszip`, vor `lucide-react`) ergänzen:

```json
    "jszip": "^3.10.1",
    "lightweight-charts": "^4.2.0",
    "lucide-react": "^1.11.0",
```

- [ ] **Step 2: Installieren**

```powershell
npm install
```

Erwartung: `lightweight-charts@4.2.x` erscheint in `node_modules` und in `package-lock.json`.

- [ ] **Step 3: Installation verifizieren**

```powershell
npm ls lightweight-charts
```

Erwartung: Zeigt `lightweight-charts@4.2.x` ohne Fehler (kein `UNMET DEPENDENCY`).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add lightweight-charts dependency for trade chart markers"
```

---

### Task 2: Symbol-Mapping und Zeitfenster-Berechnung (`src/lib/quotes.ts`)

**Files:**
- Create: `src/lib/quotes.ts`

**Interfaces:**
- Consumes: nichts (reine Funktionen, keine Abhängigkeiten außerhalb Standard-JS `Date`).
- Produces:
  - `export type TwelveDataInterval = '1min' | '5min' | '15min' | '1h'`
  - `export interface ChartWindow { start: Date; end: Date; interval: TwelveDataInterval }`
  - `export function mapToForexSymbol(instrument: string): string | null`
  - `export function computeChartWindow(openIso: string, closeIso: string): ChartWindow`
  - `export function toTwelveDataDateTime(iso: string): string`

  Diese Signaturen werden von Task 3 (Route) und Task 4 (`TradeChart.tsx`) direkt importiert.

- [ ] **Step 1: Datei schreiben**

```typescript
export type TwelveDataInterval = '1min' | '5min' | '15min' | '1h'

export interface ChartWindow {
  start: Date
  end: Date
  interval: TwelveDataInterval
}

const MIN_BUFFER_MS = 15 * 60 * 1000

/**
 * Normalisiert ein Instrument-Kürzel auf ein Twelve-Data-Forex-Symbol
 * ("EUR/USD"). Gibt null zurück, wenn es sich nicht um ein erkennbares
 * 6-Buchstaben-Forex-Paar handelt (Indizes, Futures, Krypto, ...).
 */
export function mapToForexSymbol(instrument: string): string | null {
  const base = instrument.split(/[._]/)[0].replace(/[a-z]+$/, '')
  const clean = base.replace(/[^A-Za-z]/g, '').toUpperCase()
  if (!/^[A-Z]{6}$/.test(clean)) return null
  return `${clean.slice(0, 3)}/${clean.slice(3)}`
}

/**
 * Berechnet Zeitfenster (mit Puffer) und passende Candle-Auflösung
 * aus Entry- und Exit-Zeitpunkt eines Trades.
 */
export function computeChartWindow(openIso: string, closeIso: string): ChartWindow {
  const open = new Date(openIso)
  const close = new Date(closeIso)
  const durationMs = Math.max(close.getTime() - open.getTime(), 60 * 1000)
  const buffer = Math.max(durationMs * 0.25, MIN_BUFFER_MS)

  const start = new Date(open.getTime() - buffer)
  const end = new Date(close.getTime() + buffer)

  const durationMin = durationMs / 60000
  let interval: TwelveDataInterval
  if (durationMin <= 30) interval = '1min'
  else if (durationMin <= 240) interval = '5min'
  else if (durationMin <= 1440) interval = '15min'
  else interval = '1h'

  return { start, end, interval }
}

/**
 * Formatiert einen ISO-Zeitstempel in das von Twelve Data erwartete
 * "YYYY-MM-DD HH:MM:SS"-Format (UTC).
 */
export function toTwelveDataDateTime(iso: string): string {
  return new Date(iso).toISOString().slice(0, 19).replace('T', ' ')
}
```

- [ ] **Step 2: TypeScript-Check abwarten**

Der `.claude/hooks/ts-check.py`-Hook läuft automatisch nach dem Schreiben der Datei. Erwartung: keine Fehler (blockiert sonst mit Meldung).

- [ ] **Step 3: Commit**

```bash
git add src/lib/quotes.ts
git commit -m "feat: add forex symbol mapping and chart window calculation"
```

*(Laufzeit-Verifikation der Funktionslogik erfolgt indirekt in Task 3, wenn die Route sie über echte HTTP-Aufrufe gegen Twelve Data ausführt — es gibt keine isolierte Testsuite in diesem Projekt.)*

---

### Task 3: Server-Route `src/app/api/quotes/history/route.ts`

**Files:**
- Create: `src/app/api/quotes/history/route.ts`

**Interfaces:**
- Consumes: `toTwelveDataDateTime` aus `@/lib/quotes` (Task 2).
- Produces: `GET /api/quotes/history?symbol=<XXX/YYY>&interval=<TwelveDataInterval>&start=<ISO>&end=<ISO>` → `200 { candles: { time: number; open: number; high: number; low: number; close: number }[] }` bei Erfolg (leeres Array wenn keine Daten), `400` bei fehlenden Query-Params, `500` wenn `TWELVE_DATA_API_KEY` fehlt, `502` bei Twelve-Data-Fehler/Netzwerkfehler. Wird von Task 4 (`TradeChart.tsx`) per `fetch` aufgerufen.

- [ ] **Step 1: Route schreiben**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { toTwelveDataDateTime } from '@/lib/quotes'

interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
}

interface TwelveDataValue {
  datetime: string
  open: string
  high: string
  low: string
  close: string
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get('symbol')
  const interval = searchParams.get('interval')
  const start = searchParams.get('start')
  const end = searchParams.get('end')

  if (!symbol || !interval || !start || !end) {
    return NextResponse.json({ error: 'Missing required query params: symbol, interval, start, end' }, { status: 400 })
  }

  const apiKey = process.env.TWELVE_DATA_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'TWELVE_DATA_API_KEY not configured' }, { status: 500 })
  }

  const url = new URL('https://api.twelvedata.com/time_series')
  url.searchParams.set('symbol', symbol)
  url.searchParams.set('interval', interval)
  url.searchParams.set('start_date', toTwelveDataDateTime(start))
  url.searchParams.set('end_date', toTwelveDataDateTime(end))
  url.searchParams.set('order', 'ASC')
  url.searchParams.set('timezone', 'UTC')
  url.searchParams.set('apikey', apiKey)

  let json: { status?: string; message?: string; values?: TwelveDataValue[] }
  try {
    const res = await fetch(url.toString())
    json = await res.json()
  } catch {
    return NextResponse.json({ error: 'Twelve Data request failed' }, { status: 502 })
  }

  if (json.status === 'error') {
    return NextResponse.json({ error: json.message ?? 'Twelve Data error' }, { status: 502 })
  }

  const values = json.values ?? []
  const candles: Candle[] = values.map(v => ({
    time: Math.floor(new Date(v.datetime.replace(' ', 'T') + 'Z').getTime() / 1000),
    open: parseFloat(v.open),
    high: parseFloat(v.high),
    low: parseFloat(v.low),
    close: parseFloat(v.close),
  }))

  return NextResponse.json({ candles })
}
```

- [ ] **Step 2: TypeScript-Check abwarten**

Automatischer Hook läuft nach dem Schreiben. Erwartung: keine Fehler.

- [ ] **Step 3: Dev-Server sicherstellen**

Falls kein Server auf `localhost:3000` läuft:

```powershell
$proc = Start-Process -FilePath "node" `
  -ArgumentList '"C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run dev' `
  -WindowStyle Hidden -PassThru
Start-Sleep 15
```

Läuft bereits ein Server (Normalfall), diesen Schritt überspringen.

- [ ] **Step 4: Route end-to-end gegen echte Twelve-Data-Daten verifizieren**

Zeitfenster der letzten 4 Stunden berechnen und die Route über den Playwright-Treiber abfragen (nicht `curl`/`Invoke-WebRequest` verwenden — funktioniert laut `run-alphatrack`-Skill nicht zuverlässig gegen Next.js-Dev-API-Routen):

```powershell
$end = (Get-Date).ToUniversalTime().ToString("o")
$start = (Get-Date).ToUniversalTime().AddHours(-4).ToString("o")
$path = "/api/quotes/history?symbol=EUR%2FUSD&interval=5min&start=$([uri]::EscapeDataString($start))&end=$([uri]::EscapeDataString($end))"
node ".claude\skills\run-alphatrack\driver.mjs" api $path
```

Erwartung: JSON mit `{"candles":[...]}`, Array mit mehreren Kerzen (`time`/`open`/`high`/`low`/`close` als Zahlen). Ist der Forex-Markt gerade geschlossen (Wochenende) und das Array leer, das Zeitfenster auf einen zurückliegenden Wochentag verschieben und erneut prüfen (`$end = ... AddDays(-2)` etc.) — Ziel ist zu bestätigen, dass die Route bei validen Handelszeiten Kerzen liefert.

- [ ] **Step 5: Fehlerfall verifizieren**

```powershell
node ".claude\skills\run-alphatrack\driver.mjs" api "/api/quotes/history?symbol=EUR%2FUSD&interval=5min"
```

Erwartung: `{"error":"Missing required query params: symbol, interval, start, end"}` mit Status 400.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/quotes/history/route.ts
git commit -m "feat: add Twelve Data OHLC history API route"
```

---

### Task 4: Chart-Komponente `src/components/dashboard/TradeChart.tsx`

**Files:**
- Create: `src/components/dashboard/TradeChart.tsx`

**Interfaces:**
- Consumes: `Trade` aus `@/types/trade`; `mapToForexSymbol`, `computeChartWindow` aus `@/lib/quotes` (Task 2); `GET /api/quotes/history` (Task 3); `useTheme` aus `next-themes`; `createChart`, `LineStyle`, `UTCTimestamp`, `CandlestickData` aus `lightweight-charts` (Task 1).
- Produces: `export default function TradeChart({ trade }: { trade: Trade }): JSX.Element` — wird von Task 5 in `TradeDetailModal.tsx` eingebunden.

- [ ] **Step 1: Komponente schreiben**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import { createChart, IChartApi, LineStyle, UTCTimestamp, CandlestickData } from 'lightweight-charts'
import { Trade } from '@/types/trade'
import { mapToForexSymbol, computeChartWindow } from '@/lib/quotes'

interface Props {
  trade: Trade
}

type ChartState = 'loading' | 'unsupported' | 'no-data' | 'error' | 'ready'

interface RawCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
}

const MESSAGES: Record<Exclude<ChartState, 'ready'>, string> = {
  loading: 'Lade Kursdaten…',
  unsupported: 'Chart für dieses Instrument wird aktuell nicht unterstützt.',
  'no-data': 'Für diesen Zeitraum sind keine Kursdaten verfügbar.',
  error: 'Kursdaten konnten nicht geladen werden.',
}

export default function TradeChart({ trade }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { resolvedTheme } = useTheme()
  const [state, setState] = useState<ChartState>('loading')

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const symbol = mapToForexSymbol(trade.instrument)
    if (!symbol) {
      setState('unsupported')
      return
    }
    if (!trade.closeTime) {
      setState('no-data')
      return
    }

    setState('loading')
    container.innerHTML = ''

    const win = computeChartWindow(trade.date, trade.closeTime)
    const url = `/api/quotes/history?symbol=${encodeURIComponent(symbol)}&interval=${win.interval}&start=${encodeURIComponent(win.start.toISOString())}&end=${encodeURIComponent(win.end.toISOString())}`

    let cancelled = false
    let chart: IChartApi | null = null

    const handleResize = () => {
      if (chart) chart.applyOptions({ width: container.clientWidth, height: container.clientHeight })
    }

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error('request-failed')
        return res.json() as Promise<{ candles: RawCandle[] }>
      })
      .then(data => {
        if (cancelled) return
        if (!data.candles || data.candles.length === 0) {
          setState('no-data')
          return
        }

        const isDark = resolvedTheme === 'dark'
        chart = createChart(container, {
          width: container.clientWidth,
          height: container.clientHeight,
          layout: {
            background: { color: 'transparent' },
            textColor: isDark ? '#a1a1aa' : '#52525b',
          },
          grid: {
            vertLines: { color: isDark ? '#27272a' : '#e4e4e7' },
            horzLines: { color: isDark ? '#27272a' : '#e4e4e7' },
          },
          timeScale: { timeVisible: true, secondsVisible: false },
        })

        const series = chart.addCandlestickSeries({
          upColor: '#22c55e',
          downColor: '#ef4444',
          borderVisible: false,
          wickUpColor: '#22c55e',
          wickDownColor: '#ef4444',
        })

        const candles: CandlestickData[] = data.candles.map(c => ({
          time: c.time as unknown as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }))
        series.setData(candles)

        const entryTime = Math.floor(new Date(trade.date).getTime() / 1000) as unknown as UTCTimestamp
        const exitTime = Math.floor(new Date(trade.closeTime as string).getTime() / 1000) as unknown as UTCTimestamp

        series.setMarkers([
          {
            time: entryTime,
            position: trade.type === 'long' ? 'belowBar' : 'aboveBar',
            color: trade.type === 'long' ? '#22c55e' : '#f97316',
            shape: trade.type === 'long' ? 'arrowUp' : 'arrowDown',
            text: `Entry ${trade.entry}`,
          },
          {
            time: exitTime,
            position: trade.type === 'long' ? 'aboveBar' : 'belowBar',
            color: '#60a5fa',
            shape: 'circle',
            text: `Exit ${trade.exit ?? ''}`,
          },
        ])

        if (trade.sl != null) {
          series.createPriceLine({
            price: trade.sl,
            color: '#ef4444',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: 'SL',
          })
        }
        if (trade.tp != null) {
          series.createPriceLine({
            price: trade.tp,
            color: '#22c55e',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: 'TP',
          })
        }

        chart.timeScale().fitContent()
        window.addEventListener('resize', handleResize)
        setState('ready')
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })

    return () => {
      cancelled = true
      window.removeEventListener('resize', handleResize)
      chart?.remove()
      chart = null
      container.innerHTML = ''
    }
  }, [trade, resolvedTheme])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {state !== 'ready' && (
        <div
          style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--surface-2)', color: 'var(--text-3)', fontSize: 13, fontWeight: 600,
            textAlign: 'center', padding: 20,
          }}
        >
          {MESSAGES[state]}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript-Check abwarten**

Automatischer Hook läuft nach dem Schreiben. Erwartung: keine Fehler. Falls `lightweight-charts`-Typen (`UTCTimestamp`, `CandlestickData`, `IChartApi`, `LineStyle`) nicht gefunden werden, prüfen ob Task 1 (`npm install`) tatsächlich durchgelaufen ist.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/TradeChart.tsx
git commit -m "feat: add TradeChart component with entry/exit markers"
```

*(Visuelle Verifikation der Komponente erfolgt in Task 5 im echten Modal — es gibt keinen Komponenten-Test-Runner in diesem Projekt.)*

---

### Task 5: `TradeDetailModal.tsx` auf `TradeChart` umstellen

**Files:**
- Modify: `src/components/dashboard/TradeDetailModal.tsx`

**Interfaces:**
- Consumes: `TradeChart` aus `./TradeChart` (Task 4).

- [ ] **Step 1: Import ergänzen und `toTvSymbol` entfernen**

Bestehender Code (Zeilen 1–20):

```tsx
'use client'

import { useEffect } from 'react'
import { X, ArrowLeft } from 'lucide-react'
import { Trade } from '@/types/trade'
import { currencySymbol } from '@/lib/currency'

interface TradeDetailModalProps {
  trade: Trade
  currency: string
  onBack: () => void
  onClose: () => void
}

function toTvSymbol(instrument: string): string {
  const base = instrument.split(/[._]/)[0].replace(/[a-z]+$/, '')
  const clean = base.replace(/[^A-Za-z]/g, '').toUpperCase()
  if (/^[A-Z]{6}$/.test(clean)) return `FX:${clean}`
  return clean
}
```

Ersetzen durch:

```tsx
'use client'

import { useEffect } from 'react'
import { X, ArrowLeft } from 'lucide-react'
import { Trade } from '@/types/trade'
import { currencySymbol } from '@/lib/currency'
import TradeChart from './TradeChart'

interface TradeDetailModalProps {
  trade: Trade
  currency: string
  onBack: () => void
  onClose: () => void
}
```

- [ ] **Step 2: `tvSrc`-Variable entfernen**

Bestehender Code:

```tsx
  const netPnl = (trade.pnl ?? 0) - (trade.commission ?? 0) - (trade.swap ?? 0)
  const tvSrc = `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(toTvSymbol(trade.instrument))}&interval=15&theme=dark&style=1&locale=de&hide_side_toolbar=0&allow_symbol_change=0&save_image=0`
```

Ersetzen durch:

```tsx
  const netPnl = (trade.pnl ?? 0) - (trade.commission ?? 0) - (trade.swap ?? 0)
```

- [ ] **Step 3: iframe durch TradeChart ersetzen**

Bestehender Code:

```tsx
          {/* Right: TradingView Chart */}
          <div style={{ flex: 1, minWidth: 0, padding: 12 }}>
            <iframe
              src={tvSrc}
              sandbox="allow-scripts allow-same-origin"
              referrerPolicy="no-referrer"
              style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8, display: 'block' }}
              title={`Chart ${trade.instrument}`}
            />
          </div>
```

Ersetzen durch:

```tsx
          {/* Right: Chart */}
          <div style={{ flex: 1, minWidth: 0, padding: 12 }}>
            <TradeChart trade={trade} />
          </div>
```

- [ ] **Step 4: TypeScript-Check abwarten**

Automatischer Hook läuft nach dem Schreiben. Erwartung: keine Fehler (insbesondere kein "unused variable" für `toTvSymbol`/`tvSrc`, da beide entfernt wurden).

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/TradeDetailModal.tsx
git commit -m "feat: render entry/exit chart markers in trade detail modal"
```

---

### Task 6: Visuelle End-to-End-Verifikation im Browser

**Files:** keine (reine Verifikation)

**Interfaces:** keine.

- [ ] **Step 1: Dev-Server sicherstellen**

Falls nicht bereits gestartet (siehe Task 3, Step 3).

- [ ] **Step 2: Trade-Daten mit Forex-Instrument identifizieren**

```powershell
node ".claude\skills\run-alphatrack\driver.mjs" api /api/trades
```

Aus der JSON-Antwort einen abgeschlossenen Trade mit Forex-Instrument (z.B. `EUR/USD`, `GBP/USD`) und dessen `date` (Datum, Format `YYYY-MM-DD`) notieren, um im Kalender den richtigen Tag anzuklicken.

- [ ] **Step 3: Im Kalender bis zum Trade-Detail-Modal navigieren und Screenshot aufnehmen**

Playwright-MCP-Tools verwenden (nicht `driver.mjs`, da mehrere Klicks nötig sind):

1. `browser_navigate` zu `http://localhost:3000/dashboard`
2. `browser_snapshot`, um die Zelle des in Step 2 notierten Kalendertags zu finden
3. `browser_click` auf diese Tageszelle → `DayModal` öffnet sich
4. `browser_snapshot`, um die Zeile des Forex-Trades im `DayModal` zu finden
5. `browser_click` auf diese Trade-Zeile → `TradeDetailModal` öffnet sich
6. `browser_take_screenshot` vom vollen Modal

- [ ] **Step 4: Screenshot inhaltlich prüfen**

Screenshot mit `Read` öffnen und visuell bestätigen:
- Candlestick-Chart ist sichtbar (kein leeres/graues Feld, keine Fehlermeldung)
- Ein Entry-Marker (Pfeil) und ein Exit-Marker (Kreis) sind im Chart erkennbar
- Falls der Trade `sl`/`tp` gesetzt hat: gestrichelte rote/grüne Linien sind sichtbar

Ist stattdessen eine Fehlermeldung sichtbar ("keine Kursdaten verfügbar" o.ä.), prüfen ob der gewählte Trade weit genug in der Vergangenheit liegt für den Twelve-Data-Tarif — ggf. einen jüngeren Forex-Trade aus Step 2 wählen und Step 3–4 wiederholen.

- [ ] **Step 5: Nicht unterstütztes Instrument prüfen**

Denselben Ablauf (Step 3) mit einem Nicht-Forex-Trade (z.B. `DAX`, `BTC/USDT`) wiederholen. Erwartung: Meldung "Chart für dieses Instrument wird aktuell nicht unterstützt." anstelle eines Charts, restliche Trade-Felder links normal sichtbar.

- [ ] **Step 6: Screenshots aufräumen**

Temporäre Screenshot-Dateien aus diesem Verifikationsschritt löschen (siehe Projekt-Konvention: temporäre Screenshots nach Aufgabenabschluss immer löschen).

```powershell
Remove-Item ".claude\skills\run-alphatrack\ss.png" -ErrorAction SilentlyContinue
```

---

## Spec Coverage Check

- Symbol-Mapping nur Forex → Task 2 (`mapToForexSymbol`) + Task 6 Step 5.
- Zeitfenster/Intervall aus Trade-Dauer → Task 2 (`computeChartWindow`).
- Server-seitiger API-Key, Twelve-Data-Aufruf → Task 3.
- Candlesticks + Entry/Exit-Marker + SL/TP-Linien → Task 4.
- Ersetzen des iframes in `TradeDetailModal.tsx` → Task 5.
- Drei Fehlerfälle (nicht unterstützt / keine Daten / API-Fehler) → Task 4 (`MESSAGES`) + Task 3 (Statuscodes) + Task 6 Step 4–5.
- `TradingViewWidget.tsx`/Analyse-Seite unverändert → keine Task berührt diese Dateien.
