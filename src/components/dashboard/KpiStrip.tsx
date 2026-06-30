'use client'

import { memo, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { currencySymbol } from '@/lib/currency'

interface Props {
  netPnl: number
  totalTrades: number
  profitFactor: number
  winRate: number
  openTrades: number
  avgWin: number
  avgLoss: number
  currency: string
}

function fmt(val: number, currency: string) {
  const sym = currencySymbol(currency)
  const abs = Math.abs(val)
  const sign = val >= 0 ? '+' : '−'
  const formatted = abs >= 1000
    ? `${sign}${(abs / 1000).toFixed(1)}K`
    : `${sign}${abs.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  return `${formatted} ${sym}`
}

// Kleiner Donut-Ring für Profit Factor
function DonutRing({ value, max = 4 }: { value: number; max?: number }) {
  const [animated, setAnimated] = useState(false)
  useEffect(() => { setAnimated(true) }, [])

  const size = 56
  const strokeWidth = 5
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const pct = Math.min(value / max, 1)
  const offset = circ * (1 - (animated ? pct : 0))

  const color = value >= 2 ? '#00d97e' : value >= 1 ? '#f59e0b' : '#ff4560'

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', transition: 'all 0.3s' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
      />
    </svg>
  )
}

// Halbkreis-Gauge für Win Rate
function WinGauge({ winRate, total, open }: { winRate: number; total: number; open: number }) {
  const [animated, setAnimated] = useState(false)
  useEffect(() => { setAnimated(true) }, [])

  const wins = Math.round((winRate / 100) * (total - open))
  const losses = (total - open) - wins

  const size = 56
  const strokeWidth = 6
  const r = (size - strokeWidth) / 2
  const circ = Math.PI * r // half circle
  const pct = animated ? winRate / 100 : 0

  const winColor = '#00d97e'
  const lossColor = '#ff4560'
  const neutralColor = '#f59e0b'

  // Three arc segments on a half-circle
  const winOffset = circ * (1 - pct)
  const lossOffset = circ * pct

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={size} height={size / 2 + strokeWidth} style={{ overflow: 'visible' }}>
        {/* background arc */}
        <path
          d={`M ${strokeWidth / 2} ${size / 2} A ${r} ${r} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
          fill="none" stroke="var(--surface-3)" strokeWidth={strokeWidth} strokeLinecap="round"
        />
        {/* win arc (green) */}
        <path
          d={`M ${strokeWidth / 2} ${size / 2} A ${r} ${r} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
          fill="none" stroke={winColor} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={winOffset}
          style={{ transition: 'stroke-dashoffset 0.8s ease-out', transformOrigin: '50% 100%' }}
        />
      </svg>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <span style={{ fontSize: 9, color: winColor, fontFamily: 'var(--font-dm-mono)' }}>{wins}</span>
        {open > 0 && <span style={{ fontSize: 9, color: neutralColor, fontFamily: 'var(--font-dm-mono)' }}>{open}</span>}
        <span style={{ fontSize: 9, color: lossColor, fontFamily: 'var(--font-dm-mono)' }}>{losses}</span>
      </div>
    </div>
  )
}

// Horizontaler Avg Win/Loss Balken
function AvgBar({ avgWin, avgLoss, currency }: { avgWin: number; avgLoss: number; currency: string }) {
  const [animated, setAnimated] = useState(false)
  useEffect(() => { setAnimated(true) }, [])

  const absLoss = Math.abs(avgLoss)
  const total = avgWin + absLoss
  const winPct = total > 0 ? (avgWin / total) * 100 : 50
  const sym = currencySymbol(currency)

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: '#00d97e', fontFamily: 'var(--font-dm-mono)' }}>
          +{avgWin.toLocaleString('de-DE', { maximumFractionDigits: 0 })} {sym}
        </span>
        <span style={{ fontSize: 10, fontWeight: 600, color: '#ff4560', fontFamily: 'var(--font-dm-mono)' }}>
          -{absLoss.toLocaleString('de-DE', { maximumFractionDigits: 0 })} {sym}
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 99, background: 'var(--surface-3)', overflow: 'hidden', display: 'flex' }}>
        <motion.div
          style={{ height: '100%', background: 'linear-gradient(90deg, #00d97e, #00b868)', borderRadius: '99px 0 0 99px' }}
          initial={{ width: 0 }}
          animate={{ width: animated ? `${winPct}%` : 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
        <motion.div
          style={{ height: '100%', background: 'linear-gradient(90deg, #ff4560, #cc2040)', borderRadius: '0 99px 99px 0', flex: 1 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        />
      </div>
    </div>
  )
}

function KpiCard({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      className="rounded-2xl flex flex-col"
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        boxShadow: 'var(--card-shadow)', padding: '14px 16px',
        position: 'relative', overflow: 'hidden', flex: 1, minWidth: 0,
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      whileHover={{ boxShadow: 'var(--card-shadow-hover)', y: -1 }}
    >
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: 'linear-gradient(90deg,transparent,rgba(59,130,246,0.18),transparent)',
      }} />
      {children}
    </motion.div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>
      {children}
    </p>
  )
}

function KpiStrip({ netPnl, totalTrades, profitFactor, winRate, openTrades, avgWin, avgLoss, currency }: Props) {
  const pnlColor = netPnl >= 0 ? 'var(--green)' : 'var(--red)'
  const pfColor = profitFactor >= 2 ? 'var(--green)' : profitFactor >= 1 ? 'var(--amber)' : 'var(--red)'

  return (
    <div style={{ display: 'flex', gap: 12 }}>
      {/* 1 — Net P&L */}
      <KpiCard delay={0}>
        <Label>Net P&amp;L</Label>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <motion.p
              style={{ fontSize: 26, fontWeight: 800, color: pnlColor, letterSpacing: '-0.04em', lineHeight: 1, fontFamily: 'var(--font-dm-mono)', fontVariantNumeric: 'tabular-nums' }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              {fmt(netPnl, currency)}
            </motion.p>
            <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 5, fontFamily: 'var(--font-dm-mono)' }}>
              {totalTrades} Trades
            </p>
          </div>
        </div>
      </KpiCard>

      {/* 2 — Profit Factor */}
      <KpiCard delay={0.06}>
        <Label>Profit Factor</Label>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <motion.p
              style={{ fontSize: 26, fontWeight: 800, color: pfColor, letterSpacing: '-0.04em', lineHeight: 1, fontFamily: 'var(--font-dm-mono)', fontVariantNumeric: 'tabular-nums' }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.16 }}
            >
              {profitFactor >= 99 ? '∞' : profitFactor.toFixed(2)}
            </motion.p>
            <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 5 }}>
              {profitFactor >= 2 ? 'Sehr gut' : profitFactor >= 1.5 ? 'Gut' : profitFactor >= 1 ? 'Profitabel' : 'Verlust'}
            </p>
          </div>
          <DonutRing value={profitFactor} max={4} />
        </div>
      </KpiCard>

      {/* 3 — Win Rate */}
      <KpiCard delay={0.12}>
        <Label>Trade Win %</Label>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <motion.p
              style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.04em', lineHeight: 1, fontFamily: 'var(--font-dm-mono)', fontVariantNumeric: 'tabular-nums' }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.22 }}
            >
              {winRate.toFixed(2)}%
            </motion.p>
            <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 5 }}>
              {openTrades > 0 ? `${openTrades} offen` : 'Alle geschlossen'}
            </p>
          </div>
          <WinGauge winRate={winRate} total={totalTrades} open={openTrades} />
        </div>
      </KpiCard>

      {/* 4 — Avg Win/Loss */}
      <KpiCard delay={0.18}>
        <Label>Avg Win / Loss Trade</Label>
        <motion.p
          style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.04em', lineHeight: 1, fontFamily: 'var(--font-dm-mono)', fontVariantNumeric: 'tabular-nums', marginBottom: 10 }}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.28 }}
        >
          {avgWin > 0 && avgLoss < 0 ? (avgWin / Math.abs(avgLoss)).toFixed(2) : '—'}
        </motion.p>
        {avgWin > 0 || avgLoss < 0
          ? <AvgBar avgWin={avgWin} avgLoss={avgLoss} currency={currency} />
          : <p style={{ fontSize: 10, color: 'var(--text-3)' }}>Noch keine Daten</p>
        }
      </KpiCard>
    </div>
  )
}

export default memo(KpiStrip)
