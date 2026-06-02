import React from 'react'
import { Trade } from '@/types/trade'
import { Strategy } from '@/types/strategy'
import { currencySymbol } from '@/lib/currency'

export interface VisibleSections {
  pnl: boolean
  prices: boolean
  sltp: boolean
  rrLots: boolean
  strategy: boolean
}

interface Props {
  trade: Trade
  broker: string
  currency: string
  startCapital: number
  strategies: Strategy[]
  visible: VisibleSections
}

const C = {
  bg1: '#080b12',
  bg2: '#0d1a2d',
  border: '#1a2a40',
  text1: '#f1f5f9',
  text2: '#94a3b8',
  text3: '#475569',
  green: '#00d97e',
  greenBg: 'rgba(0,217,126,0.12)',
  greenBorder: 'rgba(0,217,126,0.28)',
  red: '#ff4560',
  redBg: 'rgba(255,69,96,0.12)',
  redBorder: 'rgba(255,69,96,0.28)',
  accent: '#06d6a0',
  accent2: '#00e5ff',
}

function fmt(n: number | undefined, decimals = 2) {
  if (n === undefined) return '-'
  return n.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 12, color: C.text3, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ fontSize: 14, color: valueColor ?? C.text1, fontFamily: 'monospace', fontWeight: 600 }}>{value}</span>
    </div>
  )
}

const TradeShareCard = React.forwardRef<HTMLDivElement, Props>(
  function TradeShareCard({ trade, broker, currency, startCapital, strategies, visible }, ref) {
    const isLong = trade.type === 'long'
    const hasPnl = trade.pnl !== undefined
    const pnlPositive = (trade.pnl ?? 0) >= 0
    const pnlColor = hasPnl ? (pnlPositive ? C.green : C.red) : C.text2
    const pnlPct = hasPnl && startCapital > 0 ? ((trade.pnl! / startCapital) * 100) : null
    const strategy = trade.strategyId ? strategies.find(s => s.id === trade.strategyId) : undefined
    const date = new Date(trade.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

    const showStats = visible.prices || visible.sltp || visible.rrLots
    const showStrategyRow = visible.strategy && (strategy || (trade.tags && trade.tags.length > 0))

    return (
      <div
        ref={ref}
        style={{
          width: 400,
          background: `linear-gradient(160deg, ${C.bg1} 0%, ${C.bg2} 100%)`,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Top accent line */}
        <div style={{ height: 3, background: `linear-gradient(90deg, ${C.accent}, ${C.accent2})` }} />

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Inline LogoMark SVG */}
            <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
              <defs>
                <linearGradient id="sc-bg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#0a0f1e" />
                  <stop offset="100%" stopColor="#0f1f3d" />
                </linearGradient>
                <linearGradient id="sc-line" x1="5" y1="28" x2="35" y2="12" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#00c9a7" />
                  <stop offset="50%" stopColor="#06d6a0" />
                  <stop offset="100%" stopColor="#00e5ff" />
                </linearGradient>
              </defs>
              <rect width="40" height="40" rx="9" ry="9" fill="url(#sc-bg)" />
              <path d="M 5 28 C 7 26, 9 24, 11 23 C 12.5 22.2, 13.5 23.5, 14.5 22 C 15.2 21, 15.8 18.5, 16.8 19.5 C 17.5 20.2, 17.8 21.5, 18.5 20.5 C 19.2 19.5, 19.5 17, 20.5 13 C 21 11, 21.8 10.5, 22.5 12 L 35 29"
                stroke="url(#sc-line)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <circle cx="20.5" cy="13" r="1.6" fill="#06d6a0" />
              <rect width="40" height="40" rx="9" ry="9" fill="none" stroke="#ffffff" strokeOpacity="0.06" strokeWidth="0.8" />
            </svg>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text1, letterSpacing: '-0.01em' }}>
              Alpha<span style={{ color: C.accent }}>Track</span>
            </span>
          </div>
          <span style={{ fontSize: 10, color: C.text3, letterSpacing: '0.04em' }}>alphatrack.local</span>
        </div>

        {/* Instrument + Direction */}
        <div style={{ padding: '0 24px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 32, fontWeight: 800, color: C.text1, letterSpacing: '-0.03em', lineHeight: 1 }}>
                {trade.instrument}
              </div>
              <div style={{ fontSize: 12, color: C.text3, marginTop: 6 }}>{date}</div>
            </div>
            <div style={{
              padding: '6px 14px',
              borderRadius: 999,
              background: isLong ? C.greenBg : C.redBg,
              border: `1px solid ${isLong ? C.greenBorder : C.redBorder}`,
              fontSize: 11,
              fontWeight: 700,
              color: isLong ? C.green : C.red,
              letterSpacing: '0.08em',
              whiteSpace: 'nowrap',
              marginTop: 4,
            }}>
              {isLong ? '▲ LONG' : '▼ SHORT'}
            </div>
          </div>
        </div>

        {/* P&L */}
        {visible.pnl && hasPnl && (
          <div style={{
            margin: '0 24px 20px',
            padding: '16px 20px',
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 11, color: C.text3, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                Ergebnis
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: pnlColor, fontFamily: 'monospace', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {pnlPositive ? '+' : ''}{fmt(trade.pnl)} {currencySymbol(currency)}
              </div>
            </div>
            {pnlPct !== null && (
              <div style={{
                padding: '8px 14px',
                borderRadius: 10,
                background: pnlPositive ? C.greenBg : C.redBg,
                border: `1px solid ${pnlPositive ? C.greenBorder : C.redBorder}`,
                fontSize: 18,
                fontWeight: 800,
                color: pnlColor,
                fontFamily: 'monospace',
              }}>
                {pnlPositive ? '+' : ''}{fmt(pnlPct, 2)}%
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        {showStats && (
          <div style={{ margin: '0 24px 20px' }}>
            {visible.prices && <Row label="Entry" value={fmt(trade.entry, 4)} />}
            {visible.prices && <Row label="Exit" value={trade.exit !== undefined ? fmt(trade.exit, 4) : '-'} />}
            {visible.sltp && <Row label="Stop Loss" value={trade.sl !== undefined ? fmt(trade.sl, 4) : '-'} />}
            {visible.sltp && <Row label="Take Profit" value={trade.tp !== undefined ? fmt(trade.tp, 4) : '-'} />}
            {visible.rrLots && <Row label="Risk / Reward" value={trade.rr !== undefined ? `1 : ${fmt(trade.rr, 1)}` : '-'} valueColor={C.accent} />}
            {visible.rrLots && <Row label="Lots" value={fmt(trade.size, 2)} />}
          </div>
        )}

        {/* Strategy & Tags */}
        {showStrategyRow && (
          <div style={{ margin: '0 24px 20px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {strategy && (
              <span style={{
                padding: '5px 12px', borderRadius: 999,
                background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)',
                fontSize: 11, color: '#60a5fa', fontWeight: 600,
              }}>
                {strategy.name}
              </span>
            )}
            {trade.tags?.map(tag => (
              <span key={tag} style={{
                padding: '5px 12px', borderRadius: 999,
                background: 'rgba(148,163,184,0.08)', border: `1px solid ${C.border}`,
                fontSize: 11, color: C.text3, fontWeight: 500,
              }}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{
          padding: '12px 24px',
          background: 'rgba(0,0,0,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: `1px solid ${C.border}`,
        }}>
          <span style={{ fontSize: 11, color: C.text3, fontWeight: 500 }}>{broker}</span>
          <div style={{ width: 40, height: 2, background: `linear-gradient(90deg, ${C.accent}, ${C.accent2})`, borderRadius: 99 }} />
        </div>
      </div>
    )
  }
)

export default TradeShareCard
