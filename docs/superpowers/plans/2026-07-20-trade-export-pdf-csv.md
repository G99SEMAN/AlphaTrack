# Trade-Export (PDF-Steuerreport + CSV) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trades-Seite bekommt einen "Exportieren"-Button, über den Trades als PDF-Steuerreport (mit Jahres-Zusammenfassung, nur geschlossene Trades) oder als CSV-Rohdatenexport heruntergeladen werden können.

**Architecture:** Neue POST-Route `/api/journal/export` generiert die Datei serverseitig aus einer vom Client übergebenen Trade-ID-Liste (Filterung/Jahr-Logik läuft komplett im neuen `ExportModal`, wiederverwendet die bereits vorhandene Journal-Filterlogik). CSV wird ohne Zusatzbibliothek als String gebaut; PDF wird mit `@react-pdf/renderer` serverseitig zu einem Buffer gerendert (kein Headless-Browser/Chromium im NAS-Docker-Image).

**Tech Stack:** Next.js 15 (App Router, Route Handlers), React 19, `@react-pdf/renderer` (neu), TypeScript, framer-motion (Modal-Animation, bestehendes Muster), lucide-react (Icons).

**Referenz-Spec:** `docs/superpowers/specs/2026-07-20-trade-export-pdf-csv-design.md`

## Global Constraints

- Es gibt in diesem Projekt **keine automatisierte Testsuite** (kein Jest/Vitest/Playwright-Testrunner, kein `npm test`) — siehe `CLAUDE.md` Abschnitt "Testen". Statt "Write failing test"-Schritten wird in jedem Task mit realen Tools gegen den laufenden Dev-Server verifiziert.
- TypeScript-Check läuft **automatisch** nach jedem Edit/Write via Hook (`.claude/hooks/ts-check.py`, führt `npx tsc --noEmit` aus und blockiert bei Fehlern) — kein manueller `tsc`-Aufruf nötig, aber ein Edit, der den Hook nicht auslöst (z.B. `npm install`), muss trotzdem am Ende jedes Tasks durch einen echten Dev-Server-Request verifiziert werden.
- **`curl` / `Invoke-WebRequest` funktionieren laut `.claude/skills/run-alphatrack/SKILL.md` nicht zuverlässig gegen Next.js-API-Routen im Dev-Modus auf Windows.** Für GET-Routen den Driver (`node .claude/skills/run-alphatrack/driver.mjs api <path>`) nutzen. Die neue Export-Route ist aber `POST` — dafür die Playwright-MCP-Tools (`mcp__playwright__browser_navigate` + `mcp__playwright__browser_evaluate`) verwenden: Diese führen `fetch(...)` im echten Browser-Kontext der laufenden App aus, was das Windows/curl-Problem umgeht.
- Voraussetzung für alle Verifikationsschritte: Dev-Server läuft bereits auf `http://localhost:3000` (`npm run dev`). Falls nicht: gemäß `run-alphatrack`-SKILL.md Abschnitt "Server selbst starten" hochfahren.
- Alle neuen UI-Texte auf Deutsch, konsistent mit bestehendem Journal (`src/components/journal/*`).
- Farben/Spacing/Modal-Struktur folgen dem bestehenden Muster aus `src/components/journal/ImportModal.tsx` (CSS-Variablen wie `var(--surface)`, `var(--border)`, `var(--accent)`, `createPortal`, `motion.div`-Overlay).

---

## Task 1: CSV-Export-Builder + Export-API-Route (CSV-Pfad)

**Files:**
- Create: `src/lib/trade-export-csv.ts`
- Create: `src/app/api/journal/export/route.ts`

**Interfaces:**
- Produces: `buildTradeCsv(trades: Trade[], bots: BotEntry[], strategies: Strategy[]): string` — reine Funktion, erzeugt CSV-String inkl. UTF-8-BOM.
- Produces: `POST /api/journal/export` mit Body `{ format: 'csv' | 'pdf', tradeIds: string[], year?: number | 'all' }` → bei `format: 'csv'` liefert die Route den fertigen CSV-Text mit `Content-Type: text/csv; charset=utf-8` und `Content-Disposition: attachment`. Bei `format: 'pdf'` liefert dieser Task noch `501` (wird in Task 2 ersetzt).
- Consumes: `getActiveProfile()`, `getProfileTrades(profileId)` aus `src/lib/profiles.ts`; `getProfileStrategies(profileId)` aus `src/lib/strategies.ts`; `getBots()` aus `src/lib/bot-data.ts`; `resolveBotLabel(sourceId, bots)` aus `src/lib/bot-source.ts` (alle bereits vorhanden, unverändert).

- [ ] **Step 1: `buildTradeCsv` implementieren**

```ts
// src/lib/trade-export-csv.ts
import { Trade } from '@/types/trade'
import { Strategy } from '@/types/strategy'
import { BotEntry } from '@/types/bot'
import { resolveBotLabel } from '@/lib/bot-source'

const CSV_HEADERS = [
  'Datum', 'Schlussdatum', 'Instrument', 'Typ', 'Status', 'Entry', 'Exit', 'Size',
  'TP', 'SL', 'P&L', 'Kommission', 'Swap', 'Netto-Ergebnis', 'RR', 'Strategie', 'Quelle', 'Tags', 'Notizen',
]

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function statusLabel(status: Trade['status']): string {
  if (status === 'open') return 'Offen'
  if (status === 'cancelled') return 'Storniert'
  return 'Geschlossen'
}

export function buildTradeCsv(trades: Trade[], bots: BotEntry[], strategies: Strategy[]): string {
  const rows = trades.map(t => {
    const netto = t.pnl !== undefined
      ? t.pnl - (t.commission ?? 0) - (t.swap ?? 0)
      : undefined
    const strategyName = strategies.find(s => s.id === t.strategyId)?.name ?? ''
    const quelle = resolveBotLabel(t.sourceId, bots) ?? ''

    const fields = [
      t.date,
      t.closeTime ?? '',
      t.instrument,
      t.type === 'long' ? 'Long' : 'Short',
      statusLabel(t.status),
      String(t.entry),
      t.exit !== undefined ? String(t.exit) : '',
      String(t.size),
      t.tp !== undefined ? String(t.tp) : '',
      t.sl !== undefined ? String(t.sl) : '',
      t.pnl !== undefined ? t.pnl.toFixed(2) : '',
      t.commission !== undefined ? t.commission.toFixed(2) : '',
      t.swap !== undefined ? t.swap.toFixed(2) : '',
      netto !== undefined ? netto.toFixed(2) : '',
      t.rr !== undefined ? String(t.rr) : '',
      strategyName,
      quelle,
      (t.tags ?? []).join(';'),
      t.notes ?? '',
    ]
    return fields.map(v => csvEscape(v)).join(',')
  })

  const BOM = '\uFEFF'
  return BOM + [CSV_HEADERS.join(','), ...rows].join('\r\n')
}
```

- [ ] **Step 2: Export-API-Route mit CSV-Pfad implementieren**

```ts
// src/app/api/journal/export/route.ts
import { NextResponse } from 'next/server'
import { getActiveProfile, getProfileTrades } from '@/lib/profiles'
import { getProfileStrategies } from '@/lib/strategies'
import { getBots } from '@/lib/bot-data'
import { buildTradeCsv } from '@/lib/trade-export-csv'

export async function POST(req: Request) {
  try {
    const body = await req.json() as { format?: string; tradeIds?: string[]; year?: number | 'all' }
    const { format, tradeIds } = body

    if (format !== 'csv' && format !== 'pdf') {
      return NextResponse.json({ error: 'Ungültiges Format' }, { status: 400 })
    }
    if (!Array.isArray(tradeIds) || tradeIds.length === 0) {
      return NextResponse.json({ error: 'Keine Trades ausgewählt' }, { status: 400 })
    }

    const profile = getActiveProfile()
    if (!profile) {
      return NextResponse.json({ error: 'Kein aktives Profil' }, { status: 400 })
    }

    const idSet = new Set(tradeIds)
    const trades = getProfileTrades(profile.id).filter(t => idSet.has(t.id))
    if (trades.length === 0) {
      return NextResponse.json({ error: 'Keine passenden Trades gefunden' }, { status: 404 })
    }

    const date = new Date().toISOString().slice(0, 10)

    if (format === 'csv') {
      const strategies = getProfileStrategies(profile.id)
      const bots = getBots().filter(bot => bot.type === 'bot')
      const csv = buildTradeCsv(trades, bots, strategies)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="alphatrack-trades-${date}.csv"`,
        },
      })
    }

    // PDF-Pfad folgt in Task 2
    return NextResponse.json({ error: 'PDF-Export noch nicht verfügbar' }, { status: 501 })
  } catch (err) {
    console.error('Export-Fehler:', err)
    return NextResponse.json({ error: 'Export fehlgeschlagen' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Verifizieren, dass der TypeScript-Hook beide Dateien akzeptiert hat**

Die Hook-Ausgabe nach den beiden Writes darf keinen Fehler enthalten. Falls doch: Fehler lesen und Datei korrigieren, bevor weitergemacht wird.

- [ ] **Step 4: CSV-Export end-to-end gegen den laufenden Dev-Server verifizieren**

Dev-Server muss auf `http://localhost:3000` laufen. Mit `mcp__playwright__browser_navigate` zu `http://localhost:3000/trades` navigieren, dann mit `mcp__playwright__browser_evaluate` folgendes Skript ausführen:

```js
async () => {
  const tradesRes = await fetch('/api/trades')
  const { trades } = await tradesRes.json()
  if (trades.length === 0) return { error: 'keine Trades in aktivem Profil vorhanden' }
  const id = trades[0].id

  const res = await fetch('/api/journal/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ format: 'csv', tradeIds: [id] }),
  })
  const text = await res.text()
  return {
    status: res.status,
    contentType: res.headers.get('content-type'),
    disposition: res.headers.get('content-disposition'),
    startsWithBom: text.charCodeAt(0) === 0xFEFF,
    firstLine: text.slice(1).split('\r\n')[0],
  }
}
```

Erwartung: `status: 200`, `contentType` beginnt mit `text/csv`, `disposition` enthält `attachment; filename="alphatrack-trades-`, `startsWithBom: true`, `firstLine` ist exakt `Datum,Schlussdatum,Instrument,Typ,Status,Entry,Exit,Size,TP,SL,P&L,Kommission,Swap,Netto-Ergebnis,RR,Strategie,Quelle,Tags,Notizen`.

Zusätzlich mit einer leeren `tradeIds`-Liste (`{ format: 'csv', tradeIds: [] }`) aufrufen → Erwartung: `status: 400`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/trade-export-csv.ts src/app/api/journal/export/route.ts
git commit -m "feat: CSV-Trade-Export-Route hinzufügen"
```

---

## Task 2: PDF-Steuerreport-Builder + Export-API-Route (PDF-Pfad)

**Files:**
- Create: `src/lib/trade-export-pdf.tsx`
- Modify: `src/app/api/journal/export/route.ts` (PDF-Zweig aus Task 1 ersetzen)
- Modify: `package.json` (neue Dependency)

**Interfaces:**
- Consumes: `Trade`, `Profile` (aus `@/types/trade`, `@/types/profile`), `currencySymbol(currency)` aus `@/lib/currency`.
- Produces: `buildTradePdf(trades: Trade[], profile: Profile, yearLabel: string): Promise<Buffer>` — rendert ein PDF-Dokument via `@react-pdf/renderer` und liefert die fertigen Bytes. Erwartet, dass `trades` bereits auf `status === 'closed'` gefiltert ist (Filterung passiert im Client, siehe Task 3).

- [ ] **Step 1: `@react-pdf/renderer` installieren**

```bash
npm install @react-pdf/renderer
```

- [ ] **Step 2: PDF-Dokument-Komponente + `buildTradePdf` implementieren**

```tsx
// src/lib/trade-export-pdf.tsx
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { Trade } from '@/types/trade'
import { Profile } from '@/types/profile'
import { currencySymbol } from '@/lib/currency'

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: 'Helvetica' },
  header: { marginBottom: 16 },
  title: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 9, color: '#666666' },
  summaryBox: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16, padding: 10, backgroundColor: '#f3f4f6', borderRadius: 4 },
  summaryItem: { minWidth: 110, marginRight: 12 },
  summaryLabel: { fontSize: 7, color: '#666666', textTransform: 'uppercase', marginBottom: 2 },
  summaryValue: { fontSize: 11, fontWeight: 'bold' },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: '#f3f4f6', paddingVertical: 5, fontWeight: 'bold' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#dddddd', paddingVertical: 4 },
  cell: { paddingHorizontal: 3 },
  colDate: { width: '13%' },
  colInstrument: { width: '14%' },
  colType: { width: '8%' },
  colEntry: { width: '11%', textAlign: 'right' },
  colExit: { width: '11%', textAlign: 'right' },
  colSize: { width: '9%', textAlign: 'right' },
  colPnl: { width: '11%', textAlign: 'right' },
  colCosts: { width: '11%', textAlign: 'right' },
  colNetto: { width: '12%', textAlign: 'right' },
  footer: { position: 'absolute', bottom: 20, left: 32, right: 32, fontSize: 7, color: '#888888', borderTopWidth: 0.5, borderTopColor: '#dddddd', paddingTop: 6 },
  pageNumber: { position: 'absolute', bottom: 20, right: 32, fontSize: 7, color: '#888888' },
})

function fmt(n: number): string {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

interface Props {
  trades: Trade[]
  profile: Profile
  yearLabel: string
}

function TradeReportDocument({ trades, profile, yearLabel }: Props) {
  const symbol = currencySymbol(profile.currency)
  const closed = trades.filter(t => t.pnl !== undefined)
  const gross = closed.reduce((acc, t) => {
    const pnl = t.pnl ?? 0
    if (pnl >= 0) acc.win += pnl
    else acc.loss += pnl
    return acc
  }, { win: 0, loss: 0 })
  const totalCosts = closed.reduce((s, t) => s + (t.commission ?? 0) + (t.swap ?? 0), 0)
  const netResult = gross.win + gross.loss - totalCosts
  const sorted = [...trades].sort((a, b) => {
    const aClose = a.closeTime ?? a.date
    const bClose = b.closeTime ?? b.date
    return aClose < bClose ? -1 : aClose > bClose ? 1 : 0
  })

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Steuerreport – {profile.name}</Text>
          <Text style={styles.subtitle}>
            {profile.broker ? `Broker: ${profile.broker} · ` : ''}Konto: {profile.currency} · Zeitraum: {yearLabel} · Exportiert am {new Date().toLocaleDateString('de-DE')}
          </Text>
        </View>

        <View style={styles.summaryBox}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Anzahl Trades</Text>
            <Text style={styles.summaryValue}>{closed.length}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Bruttogewinn</Text>
            <Text style={styles.summaryValue}>+{fmt(gross.win)} {symbol}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Bruttoverlust</Text>
            <Text style={styles.summaryValue}>{fmt(gross.loss)} {symbol}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Kommission + Swap</Text>
            <Text style={styles.summaryValue}>-{fmt(totalCosts)} {symbol}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Netto-Ergebnis</Text>
            <Text style={styles.summaryValue}>{netResult >= 0 ? '+' : ''}{fmt(netResult)} {symbol}</Text>
          </View>
        </View>

        <View>
          <View style={styles.tableHeaderRow} fixed>
            <Text style={[styles.cell, styles.colDate]}>Datum</Text>
            <Text style={[styles.cell, styles.colInstrument]}>Instrument</Text>
            <Text style={[styles.cell, styles.colType]}>Typ</Text>
            <Text style={[styles.cell, styles.colEntry]}>Entry</Text>
            <Text style={[styles.cell, styles.colExit]}>Exit</Text>
            <Text style={[styles.cell, styles.colSize]}>Size</Text>
            <Text style={[styles.cell, styles.colPnl]}>P&L</Text>
            <Text style={[styles.cell, styles.colCosts]}>Kosten</Text>
            <Text style={[styles.cell, styles.colNetto]}>Netto</Text>
          </View>
          {sorted.map(t => {
            const costs = (t.commission ?? 0) + (t.swap ?? 0)
            const netto = t.pnl !== undefined ? t.pnl - costs : undefined
            return (
              <View style={styles.tableRow} key={t.id} wrap={false}>
                <Text style={[styles.cell, styles.colDate]}>{fmtDate(t.closeTime ?? t.date)}</Text>
                <Text style={[styles.cell, styles.colInstrument]}>{t.instrument}</Text>
                <Text style={[styles.cell, styles.colType]}>{t.type === 'long' ? 'Long' : 'Short'}</Text>
                <Text style={[styles.cell, styles.colEntry]}>{t.entry}</Text>
                <Text style={[styles.cell, styles.colExit]}>{t.exit ?? '-'}</Text>
                <Text style={[styles.cell, styles.colSize]}>{t.size}</Text>
                <Text style={[styles.cell, styles.colPnl]}>{t.pnl !== undefined ? fmt(t.pnl) : '-'}</Text>
                <Text style={[styles.cell, styles.colCosts]}>{fmt(costs)}</Text>
                <Text style={[styles.cell, styles.colNetto]}>{netto !== undefined ? fmt(netto) : '-'}</Text>
              </View>
            )
          })}
        </View>

        <Text style={styles.footer} fixed>
          Dies ist kein amtliches Steuerdokument. Bitte in Zusammenarbeit mit einem Steuerberater prüfen. Bei Fremdwährungskonten ist ggf. eine manuelle Umrechnung zum Tageskurs erforderlich.
        </Text>
        <Text
          style={styles.pageNumber}
          fixed
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
        />
      </Page>
    </Document>
  )
}

export async function buildTradePdf(trades: Trade[], profile: Profile, yearLabel: string): Promise<Buffer> {
  return renderToBuffer(<TradeReportDocument trades={trades} profile={profile} yearLabel={yearLabel} />)
}
```

- [ ] **Step 3: PDF-Zweig in der Export-Route aktivieren**

In `src/app/api/journal/export/route.ts` den Import ergänzen und den `501`-Platzhalter ersetzen:

```ts
// Import ergänzen (nach dem bestehenden buildTradeCsv-Import):
import { buildTradePdf } from '@/lib/trade-export-pdf'
```

```ts
// Ersetzt den bisherigen Rückgabewert:
// return NextResponse.json({ error: 'PDF-Export noch nicht verfügbar' }, { status: 501 })

const yearLabel = body.year === undefined || body.year === 'all' ? 'Alle Jahre' : String(body.year)
const pdfBuffer = await buildTradePdf(trades, profile, yearLabel)
return new NextResponse(new Uint8Array(pdfBuffer), {
  headers: {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="alphatrack-steuerreport-${date}.pdf"`,
  },
})
```

- [ ] **Step 4: TypeScript-Hook-Ausgabe prüfen**

Keine Fehler nach den Writes/Edits in diesem Task.

- [ ] **Step 5: PDF-Export end-to-end gegen den laufenden Dev-Server verifizieren**

Dev-Server neu starten, falls er seit Task 1 nicht neu gestartet wurde (neue Route-Datei wurde geändert, nicht nur neu angelegt — bei "stale server"-404s laut SKILL.md neu starten). Mit `mcp__playwright__browser_navigate` zu `http://localhost:3000/trades`, dann `mcp__playwright__browser_evaluate`:

```js
async () => {
  const tradesRes = await fetch('/api/trades')
  const { trades } = await tradesRes.json()
  const closed = trades.find(t => t.status === 'closed')
  if (!closed) return { error: 'kein geschlossener Trade im aktiven Profil vorhanden — vor dem Test einen Trade als geschlossen anlegen' }

  const res = await fetch('/api/journal/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ format: 'pdf', tradeIds: [closed.id], year: 'all' }),
  })
  const buf = await res.arrayBuffer()
  const magic = String.fromCharCode(...new Uint8Array(buf.slice(0, 4)))
  return {
    status: res.status,
    contentType: res.headers.get('content-type'),
    disposition: res.headers.get('content-disposition'),
    byteLength: buf.byteLength,
    magic,
  }
}
```

Erwartung: `status: 200`, `contentType: 'application/pdf'`, `disposition` enthält `attachment; filename="alphatrack-steuerreport-`, `byteLength > 0`, `magic: '%PDF'`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/trade-export-pdf.tsx src/app/api/journal/export/route.ts
git commit -m "feat: PDF-Steuerreport-Export hinzufügen"
```

---

## Task 3: ExportModal-Komponente

**Files:**
- Create: `src/components/journal/ExportModal.tsx`

**Interfaces:**
- Consumes: `Trade` (`@/types/trade`); `POST /api/journal/export` aus Task 1+2.
- Produces: `export default function ExportModal(props: { trades: Trade[]; filtered: Trade[]; onClose: () => void }): JSX.Element` — `trades` = alle Profil-Trades (ungefiltert), `filtered` = aktuell im Journal sichtbare Trades (Status/Richtung/Bot/Suche). Wird in Task 4 aus `JournalClient.tsx` eingebunden.

- [ ] **Step 1: Komponente implementieren**

```tsx
// src/components/journal/ExportModal.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { X, FileText, Table, AlertCircle, Download } from 'lucide-react'
import { Trade } from '@/types/trade'

interface Props {
  trades: Trade[]
  filtered: Trade[]
  onClose: () => void
}

type ExportFormat = 'pdf' | 'csv'

function tradeYear(t: Trade): number {
  return new Date(t.closeTime ?? t.date).getFullYear()
}

export default function ExportModal({ trades, filtered, onClose }: Props) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const availableYears = useMemo(() => {
    const years = new Set(trades.map(tradeYear))
    return Array.from(years).sort((a, b) => b - a)
  }, [trades])

  const [format, setFormat] = useState<ExportFormat>('pdf')
  const [year, setYear] = useState<number | 'all'>(availableYears[0] ?? 'all')
  const [useJournalFilters, setUseJournalFilters] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const finalTrades = useMemo(() => {
    const basis = useJournalFilters ? filtered : trades
    const yearFiltered = year === 'all' ? basis : basis.filter(t => tradeYear(t) === year)
    return format === 'pdf' ? yearFiltered.filter(t => t.status === 'closed') : yearFiltered
  }, [trades, filtered, useJournalFilters, year, format])

  async function handleExport() {
    if (finalTrades.length === 0) return
    setIsExporting(true)
    setError(null)
    try {
      const res = await fetch('/api/journal/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format, year, tradeIds: finalTrades.map(t => t.id) }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Export fehlgeschlagen')
      }
      const blob = await res.blob()
      const date = new Date().toISOString().slice(0, 10)
      const ext = format === 'pdf' ? 'pdf' : 'csv'
      const filenamePrefix = format === 'pdf' ? 'alphatrack-steuerreport' : 'alphatrack-trades'
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${filenamePrefix}-${date}.${ext}`
      a.click()
      URL.revokeObjectURL(a.href)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export fehlgeschlagen')
    } finally {
      setIsExporting(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', zIndex: 9999 }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        onClick={e => e.stopPropagation()}
        className="w-full rounded-xl overflow-hidden flex flex-col"
        style={{ maxWidth: 440, background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 className="text-base font-bold" style={{ color: 'var(--text-1)' }}>Trades exportieren</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Als PDF-Steuerreport oder CSV-Rohdaten herunterladen</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer"
            style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Format */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-3)' }}>Format</p>
            <div className="flex gap-2">
              {([
                { val: 'pdf' as const, label: 'PDF (Steuerreport)', icon: FileText },
                { val: 'csv' as const, label: 'CSV (Rohdaten)', icon: Table },
              ]).map(({ val, label, icon: Icon }) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setFormat(val)}
                  className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all"
                  style={{
                    background: format === val ? 'var(--accent-bg)' : 'var(--surface-2)',
                    color: format === val ? 'var(--accent)' : 'var(--text-2)',
                    border: `1.5px solid ${format === val ? 'var(--accent)' : 'var(--border)'}`,
                  }}
                >
                  <Icon size={15} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Jahr */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-3)' }}>Jahr</p>
            <select
              value={year}
              onChange={e => setYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'var(--surface-2)', color: 'var(--text-1)', border: '1px solid var(--border)' }}
            >
              <option value="all">Alle Jahre</option>
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Journal-Filter übernehmen */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useJournalFilters}
              onChange={e => setUseJournalFilters(e.target.checked)}
            />
            <span className="text-sm" style={{ color: 'var(--text-2)' }}>
              Aktuelle Journal-Filter übernehmen (Status, Richtung, Bot, Suche)
            </span>
          </label>

          <p className="text-xs" style={{ color: 'var(--text-3)' }}>
            Für den Steuerreport werden nur geschlossene Trades berücksichtigt.
          </p>

          {finalTrades.length === 0 && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}>
              <AlertCircle size={14} style={{ color: '#f59e0b' }} />
              <p className="text-xs" style={{ color: '#f59e0b' }}>Keine Trades für diese Auswahl</p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <AlertCircle size={14} style={{ color: '#ef4444' }} />
              <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5" style={{ borderTop: '1px solid var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>
            {finalTrades.length} Trade{finalTrades.length !== 1 ? 's' : ''} ausgewählt
          </p>
          <div className="flex items-center gap-2">
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
              disabled={finalTrades.length === 0 || isExporting}
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
              style={{
                background: finalTrades.length > 0 ? 'var(--accent)' : 'var(--surface-2)',
                color: finalTrades.length > 0 ? '#fff' : 'var(--text-3)',
                border: `1px solid ${finalTrades.length > 0 ? 'var(--accent)' : 'var(--border)'}`,
                cursor: finalTrades.length > 0 && !isExporting ? 'pointer' : 'not-allowed',
                opacity: finalTrades.length > 0 && !isExporting ? 1 : 0.6,
              }}
            >
              <Download size={14} />
              {isExporting ? 'Exportiere...' : 'Exportieren'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  )
}
```

- [ ] **Step 2: TypeScript-Hook-Ausgabe prüfen**

Keine Fehler nach dem Write.

- [ ] **Step 3: Commit**

```bash
git add src/components/journal/ExportModal.tsx
git commit -m "feat: ExportModal-Komponente hinzufügen"
```

(Die Verifikation im Browser erfolgt in Task 4, sobald die Komponente über einen Button erreichbar ist.)

---

## Task 4: ExportModal in JournalClient einbinden

**Files:**
- Modify: `src/components/journal/JournalClient.tsx`

**Interfaces:**
- Consumes: `ExportModal` aus Task 3 (`trades`, `filtered`, `onClose` Props).

- [ ] **Step 1: Icon-Import erweitern**

In `src/components/journal/JournalClient.tsx` Zeile 6:

```ts
// Vorher:
import { Plus, Search, SlidersHorizontal, TrendingUp, TrendingDown, BookOpen, Upload } from 'lucide-react'
// Nachher:
import { Plus, Search, SlidersHorizontal, TrendingUp, TrendingDown, BookOpen, Upload, Download } from 'lucide-react'
```

- [ ] **Step 2: `ExportModal`-Import ergänzen**

Nach der bestehenden `ImportModal`-Importzeile (Zeile 14):

```ts
import ImportModal from './ImportModal'
import ExportModal from './ExportModal'
```

- [ ] **Step 3: State für Modal-Sichtbarkeit ergänzen**

Nach `const [showImport, setShowImport] = useState(false)` (Zeile 33):

```ts
const [showImport, setShowImport] = useState(false)
const [showExport, setShowExport] = useState(false)
```

- [ ] **Step 4: Export-Button in die Toolbar einfügen**

Im Action-Buttons-Block, direkt vor dem bestehenden Import-Button (vor Zeile 276 `<button onClick={() => setShowImport(true)}`):

```tsx
<button
  onClick={() => setShowExport(true)}
  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
  style={{
    background: 'var(--surface-2)',
    color: 'var(--text-2)',
    border: '1px solid var(--border)',
  }}
  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)' }}
  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-2)' }}
>
  <Download size={13} />
  <span className="hidden sm:inline">Exportieren</span>
</button>
```

- [ ] **Step 5: Modal rendern**

Nach dem bestehenden `ImportModal`-`AnimatePresence`-Block (nach Zeile 431 `</AnimatePresence>`, vor dem schließenden `</div>` der Komponente):

```tsx
<AnimatePresence>
  {showExport && (
    <ExportModal
      trades={trades}
      filtered={filtered}
      onClose={() => setShowExport(false)}
    />
  )}
</AnimatePresence>
```

- [ ] **Step 6: TypeScript-Hook-Ausgabe prüfen**

Keine Fehler nach den Edits.

- [ ] **Step 7: End-to-End im Browser verifizieren**

Mit `mcp__playwright__browser_navigate` zu `http://localhost:3000/trades` navigieren. Mit `mcp__playwright__browser_snapshot` prüfen, dass ein Button "Exportieren" in der Toolbar sichtbar ist. Mit `mcp__playwright__browser_click` auf den Button klicken, mit `browser_snapshot` prüfen, dass das Modal mit Titel "Trades exportieren", Format-Buttons "PDF (Steuerreport)"/"CSV (Rohdaten)", Jahr-Dropdown und Checkbox erscheint. Mit `mcp__playwright__browser_take_screenshot` einen Screenshot speichern und mit `Read` visuell gegenprüfen (Styling konsistent mit anderen Journal-Modals: dunkle Card, `var(--surface)`-Hintergrund, kein Layout-Bruch).

Anschließend "CSV (Rohdaten)" auswählen, per `browser_click` auf "Exportieren" klicken. Da `<a download>` in Playwright keinen sichtbaren Seitenwechsel auslöst, den Erfolg indirekt bestätigen: Modal muss sich nach dem Klick schließen (`onClose()` wird nach erfolgreichem Export aufgerufen) — mit `browser_snapshot` prüfen, dass "Trades exportieren" nicht mehr im Snapshot auftaucht.

Screenshots im Scratchpad-Verzeichnis ablegen (`C:\Users\G99SEMAN\AppData\Local\Temp\claude\...\scratchpad`, siehe Systemprompt) und nach Abschluss der Verifikation löschen (siehe Projekt-Konvention "Screenshot Cleanup").

- [ ] **Step 8: Commit**

```bash
git add src/components/journal/JournalClient.tsx
git commit -m "feat: Export-Button in Trades-Toolbar einbinden"
```

---

## Spec-Abdeckung (Selbstprüfung)

| Spec-Anforderung | Task |
|---|---|
| Export-Button auf Trades-Seite neben "Trade hinzufügen" | Task 4 |
| Format-Auswahl PDF/CSV im Modal | Task 3 |
| Jahr-Dropdown aus vorhandenen Trades | Task 3 |
| Checkbox "aktuelle Journal-Filter übernehmen" | Task 3 |
| PDF nur geschlossene Trades | Task 3 (Filterlogik) + Task 2 (Report geht von "closed" aus) |
| CSV mit allen Spalten inkl. Status/Quelle/Strategie | Task 1 |
| PDF mit Kopf, Zusammenfassung, Tabelle, Disclaimer, Seitenzahl | Task 2 |
| Keine Fremdwährungsumrechnung, nur Hinweistext | Task 2 (Disclaimer im Footer) |
| Download-Trigger via Blob (wie bestehender ZIP-Export) | Task 3 |
