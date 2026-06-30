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
