# Calendar Day Popup & Trade Detail Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a clickable day popup to the trading calendar showing day stats and a trade list, and a trade detail modal with all trade fields and an embedded TradingView chart.

**Architecture:** Two new `'use client'` components (`DayModal`, `TradeDetailModal`) rendered via local React state inside the existing `TradingCalendar` component. No new API routes — all data flows from the `trades` prop already passed to `TradingCalendar`.

**Tech Stack:** React 18, TypeScript, inline styles with CSS custom properties (existing pattern), SVG for mini P&L curve, TradingView iframe widget

## Global Constraints

- All colors via CSS custom properties (`var(--surface)`, `var(--surface-2)`, `var(--border)`, `var(--border-subtle)`, `var(--text-1)`, `var(--text-2)`, `var(--text-3)`, `var(--green)`, `var(--red)`, `var(--accent)`, `var(--accent-bg)`)
- No new npm dependencies
- TypeScript — no `any` types
- `'use client'` directive on all new components
- Follow existing inline-style pattern from `TradingCalendar.tsx`
- `trade.pnl` = gross P&L from broker; Net P&L = `(trade.pnl ?? 0) - (trade.commission ?? 0) - (trade.swap ?? 0)`
- Import `currencySymbol` from `@/lib/currency` for the currency symbol
- Import `Trade` type from `@/types/trade`

---

### Task 1: DayModal component

**Files:**
- Create: `src/components/dashboard/DayModal.tsx`

**Interfaces:**
- Produces: `export default function DayModal(props: DayModalProps)`
- Props consumed by Task 3:
  ```typescript
  interface DayModalProps {
    day: string            // YYYY-MM-DD
    trades: Trade[]        // pre-filtered: status=closed, pnl defined, date matches day
    currency: string
    onClose: () => void
    onSelectTrade: (trade: Trade) => void
  }
  ```

- [ ] **Step 1: Create `src/components/dashboard/DayModal.tsx`**

```tsx
'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { Trade } from '@/types/trade'
import { currencySymbol } from '@/lib/currency'

interface DayModalProps {
  day: string
  trades: Trade[]
  currency: string
  onClose: () => void
  onSelectTrade: (trade: Trade) => void
}

function fmtDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('de-DE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function fmtTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function fmtPnl(val: number, sym: string): string {
  const prefix = val >= 0 ? '+' : '-'
  return `${prefix}${sym}${Math.abs(val).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function StatCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '8px 12px' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: color ?? 'var(--text-1)', fontFamily: 'var(--font-dm-mono)' }}>
        {value}
      </div>
    </div>
  )
}

function MiniChart({ trades }: { trades: Trade[] }) {
  const sorted = [...trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const points: number[] = [0]
  let running = 0
  for (const t of sorted) {
    running += (t.pnl ?? 0) - (t.commission ?? 0) - (t.swap ?? 0)
    points.push(running)
  }
  if (points.length < 2) return null

  const W = 500, H = 90, PAD = 8
  const minV = Math.min(...points)
  const maxV = Math.max(...points)
  const range = maxV - minV || 1
  const n = points.length
  const toX = (i: number) => PAD + (i / (n - 1)) * (W - PAD * 2)
  const toY = (v: number) => H - PAD - ((v - minV) / range) * (H - PAD * 2)

  const lineParts = points.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`)
  const linePath = lineParts.join(' ')
  const areaPath = `${linePath} L ${toX(n - 1).toFixed(1)} ${H} L ${toX(0).toFixed(1)} ${H} Z`
  const isPositive = points[points.length - 1] >= 0

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 90, display: 'block' }}>
      <path d={areaPath} fill={isPositive ? 'rgba(0,217,126,0.15)' : 'rgba(255,69,96,0.15)'} />
      <path d={linePath} fill="none" stroke={isPositive ? 'var(--green)' : 'var(--red)'} strokeWidth={2} strokeLinejoin="round" />
    </svg>
  )
}

export default function DayModal({ day, trades, currency, onClose, onSelectTrade }: DayModalProps) {
  const sym = currencySymbol(currency)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const grossPnl = trades.reduce((s, t) => s + (t.pnl ?? 0), 0)
  const totalCosts = trades.reduce((s, t) => s + (t.commission ?? 0) + (t.swap ?? 0), 0)
  const netPnl = grossPnl - totalCosts
  const winners = trades.filter(t => (t.pnl ?? 0) > 0)
  const losers = trades.filter(t => (t.pnl ?? 0) <= 0)
  const winrate = trades.length > 0 ? (winners.length / trades.length) * 100 : 0
  const totalVolume = trades.reduce((s, t) => s + (t.size ?? 0), 0)
  const grossWins = winners.reduce((s, t) => s + (t.pnl ?? 0), 0)
  const grossLossAbs = Math.abs(losers.reduce((s, t) => s + (t.pnl ?? 0), 0))
  const profitFactor = grossLossAbs > 0 ? grossWins / grossLossAbs : grossWins > 0 ? Infinity : 0

  const sortedTrades = [...trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 620, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', marginBottom: 4 }}>{fmtDay(day)}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: netPnl >= 0 ? 'var(--green)' : 'var(--red)', fontFamily: 'var(--font-dm-mono)' }}>
              Net P&amp;L {fmtPnl(netPnl, sym)}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-2)', flexShrink: 0 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Mini Chart */}
        <div style={{ padding: '12px 20px 0', flexShrink: 0 }}>
          <MiniChart trades={trades} />
        </div>

        {/* Stats Grid */}
        <div style={{ padding: '12px 20px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, flexShrink: 0 }}>
          <StatCell label="Total Trades" value={String(trades.length)} />
          <StatCell label="Winners" value={String(winners.length)} />
          <StatCell label="Losers" value={String(losers.length)} />
          <StatCell label="Winrate" value={`${winrate.toFixed(0)}%`} />
          <StatCell label="Gross P&L" value={fmtPnl(grossPnl, sym)} color={grossPnl >= 0 ? 'var(--green)' : 'var(--red)'} />
          <StatCell label="Volumen" value={totalVolume.toLocaleString('de-DE', { maximumFractionDigits: 2 })} />
          <StatCell label="Kosten" value={`${sym}${totalCosts.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
          <StatCell label="Profit Factor" value={isFinite(profitFactor) ? profitFactor.toFixed(2) : '∞'} />
        </div>

        {/* Trade List */}
        <div style={{ flex: 1, overflowY: 'auto', borderTop: '1px solid var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', position: 'sticky', top: 0 }}>
                {['Uhrzeit', 'Instrument', 'Side', 'Net P&L', 'R:R'].map(h => (
                  <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedTrades.map(trade => {
                const tradeNet = (trade.pnl ?? 0) - (trade.commission ?? 0) - (trade.swap ?? 0)
                return (
                  <tr
                    key={trade.id}
                    onClick={() => onSelectTrade(trade)}
                    style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', transition: 'background 0.12s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-2)', fontFamily: 'var(--font-dm-mono)' }}>
                      {fmtTime(trade.date)}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
                      {trade.instrument}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                        background: trade.type === 'long' ? 'rgba(59,130,246,0.15)' : 'rgba(255,120,50,0.15)',
                        color: trade.type === 'long' ? '#60a5fa' : '#fb923c',
                      }}>
                        {trade.type === 'long' ? 'LONG' : 'SHORT'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 700, color: tradeNet >= 0 ? 'var(--green)' : 'var(--red)', fontFamily: 'var(--font-dm-mono)' }}>
                      {fmtPnl(tradeNet, sym)}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-2)', fontFamily: 'var(--font-dm-mono)' }}>
                      {trade.rr != null ? `${trade.rr.toFixed(2)}R` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 20px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`  
Expected: No errors relating to `DayModal.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/DayModal.tsx
git commit -m "feat(dashboard): add DayModal component for calendar day summary"
```

---

### Task 2: TradeDetailModal component

**Files:**
- Create: `src/components/dashboard/TradeDetailModal.tsx`

**Interfaces:**
- Produces: `export default function TradeDetailModal(props: TradeDetailModalProps)`
- Props consumed by Task 3:
  ```typescript
  interface TradeDetailModalProps {
    trade: Trade
    currency: string
    onBack: () => void   // closes only this modal; DayModal remains open
    onClose: () => void  // closes both modals
  }
  ```

- [ ] **Step 1: Create `src/components/dashboard/TradeDetailModal.tsx`**

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
  const clean = instrument.replace(/[^A-Za-z]/g, '').toUpperCase()
  if (/^[A-Z]{6}$/.test(clean)) return `FX:${clean}`
  return clean
}

function fmtDuration(open: string, close?: string): string {
  if (!close) return '—'
  const ms = new Date(close).getTime() - new Date(open).getTime()
  if (ms <= 0) return '—'
  const mins = Math.floor(ms / 60000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function fmtNum(val: number | undefined, decimals = 2): string {
  if (val == null) return '—'
  return val.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function FieldRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', borderRadius: 8, background: 'var(--surface-2)' }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </span>
      <span style={{ fontSize: 13, fontWeight: 700, color: color ?? 'var(--text-1)', fontFamily: 'var(--font-dm-mono)' }}>
        {value}
      </span>
    </div>
  )
}

export default function TradeDetailModal({ trade, currency, onBack, onClose }: TradeDetailModalProps) {
  const sym = currencySymbol(currency)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onBack() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onBack])

  const netPnl = (trade.pnl ?? 0) - (trade.commission ?? 0) - (trade.swap ?? 0)
  const tvSrc = `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(toTvSymbol(trade.instrument))}&interval=15&theme=dark&style=1&locale=de&hide_side_toolbar=0&allow_symbol_change=0&save_image=0`

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
      onClick={onBack}
    >
      <div
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, width: '90vw', maxWidth: 1200, height: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 64px rgba(0,0,0,0.5)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <button
            onClick={onBack}
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: 'var(--text-2)', fontSize: 13, fontWeight: 600, flexShrink: 0 }}
          >
            <ArrowLeft size={14} />
            Zurück
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)' }}>{trade.instrument}</span>
            <span style={{ fontSize: 13, color: 'var(--text-3)', marginLeft: 12 }}>{fmtDateTime(trade.date)}</span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-2)', flexShrink: 0 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

          {/* Left: Trade Fields */}
          <div style={{ width: 280, flexShrink: 0, overflowY: 'auto', borderRight: '1px solid var(--border)', padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <FieldRow label="Net P&L" value={`${netPnl >= 0 ? '+' : ''}${sym}${Math.abs(netPnl).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} color={netPnl >= 0 ? 'var(--green)' : 'var(--red)'} />
            <FieldRow label="Gross P&L" value={`${sym}${fmtNum(trade.pnl)}`} />
            <FieldRow
              label="Side"
              value={trade.type === 'long' ? 'LONG' : 'SHORT'}
              color={trade.type === 'long' ? '#60a5fa' : '#fb923c'}
            />
            <FieldRow label="Entry" value={fmtNum(trade.entry)} />
            <FieldRow label="Exit" value={fmtNum(trade.exit)} />
            <FieldRow label="Stop Loss" value={fmtNum(trade.sl)} />
            <FieldRow label="Take Profit" value={fmtNum(trade.tp)} />
            <FieldRow label="Size" value={fmtNum(trade.size)} />
            <FieldRow label="Commission" value={trade.commission != null ? `${sym}${fmtNum(trade.commission)}` : '—'} />
            <FieldRow label="Swap" value={trade.swap != null ? `${sym}${fmtNum(trade.swap)}` : '—'} />
            <FieldRow label="R:R" value={trade.rr != null ? `${fmtNum(trade.rr)}R` : '—'} />
            <FieldRow label="Laufzeit" value={fmtDuration(trade.date, trade.closeTime)} />
            <FieldRow label="Eröffnet" value={fmtDateTime(trade.date)} />
            <FieldRow label="Geschlossen" value={trade.closeTime ? fmtDateTime(trade.closeTime) : '—'} />

            {trade.notes && (
              <div style={{ marginTop: 4, padding: '10px 12px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Notes</div>
                <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5, margin: 0 }}>{trade.notes}</p>
              </div>
            )}

            {trade.tags && trade.tags.length > 0 && (
              <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {trade.tags.map(tag => (
                  <span key={tag} style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: 'var(--accent-bg)', color: 'var(--accent)' }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Right: TradingView Chart */}
          <div style={{ flex: 1, minWidth: 0, padding: 12 }}>
            <iframe
              src={tvSrc}
              style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8, display: 'block' }}
              title={`Chart ${trade.instrument}`}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`  
Expected: No errors relating to `TradeDetailModal.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/TradeDetailModal.tsx
git commit -m "feat(dashboard): add TradeDetailModal with TradingView chart embed"
```

---

### Task 3: TradingCalendar integration

**Files:**
- Modify: `src/components/dashboard/TradingCalendar.tsx`

**Interfaces:**
- Consumes from Task 1: `DayModal` (default export from `./DayModal`)
- Consumes from Task 2: `TradeDetailModal` (default export from `./TradeDetailModal`)
- `Props` interface unchanged — no external API changes

- [ ] **Step 1: Add imports and state**

At the top of `TradingCalendar.tsx`, add two imports after the existing imports:

```typescript
import DayModal from './DayModal'
import TradeDetailModal from './TradeDetailModal'
```

Inside `function TradingCalendar(...)`, after the existing `useState` calls for `year` and `month`, add:

```typescript
const [selectedDay, setSelectedDay] = useState<string | null>(null)
const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)
```

- [ ] **Step 2: Make day cells clickable**

Find the `<motion.div>` for each day cell (the one that starts with `key={di}` and has `aspectRatio: '1 / 0.85'`). Make two changes:

1. Change `cursor: data ? 'default' : 'default'` → `cursor: data ? 'pointer' : 'default'`
2. Add `onClick` prop: `onClick={data ? () => setSelectedDay(key) : undefined}`

The updated opening tag becomes:

```tsx
<motion.div
  key={di}
  onClick={data ? () => setSelectedDay(key) : undefined}
  style={{
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

- [ ] **Step 3: Render modals**

At the end of the `return` statement in `TradingCalendar`, just before the final `</motion.div>`, add both modals:

```tsx
      {selectedDay && (
        <DayModal
          day={selectedDay}
          trades={trades.filter(t =>
            t.status === 'closed' &&
            t.pnl !== undefined &&
            (t.closeTime ?? t.date).slice(0, 10) === selectedDay
          )}
          currency={currency}
          onClose={() => setSelectedDay(null)}
          onSelectTrade={(trade) => setSelectedTrade(trade)}
        />
      )}

      {selectedTrade && (
        <TradeDetailModal
          trade={selectedTrade}
          currency={currency}
          onBack={() => setSelectedTrade(null)}
          onClose={() => { setSelectedTrade(null); setSelectedDay(null) }}
        />
      )}
    </motion.div>
  )
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`  
Expected: No errors

- [ ] **Step 5: Manual browser test**

Start the dev server: `npm run dev`

Test each scenario:

1. **Golden path:**
   - Open http://localhost:3000/dashboard
   - Click a colored calendar day → DayModal opens with correct date, Net P&L, mini chart, stats, trade list
   - Click a trade row → TradeDetailModal opens on top, TradingView chart loads for the correct instrument
   - Click "Zurück" → TradeDetailModal closes, DayModal stays open
   - Click "Schließen" in DayModal → both modals closed

2. **Keyboard:**
   - With TradeDetailModal open: press Escape → only TradeDetailModal closes (DayModal stays)
   - With DayModal open: press Escape → DayModal closes

3. **Backdrop click:**
   - Click outside DayModal → DayModal closes
   - Click outside TradeDetailModal → TradeDetailModal closes (DayModal stays)

4. **Empty days:** Click a day without trades → nothing happens (no cursor pointer visible)

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/TradingCalendar.tsx
git commit -m "feat(dashboard): wire DayModal and TradeDetailModal into TradingCalendar"
```
