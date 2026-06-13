'use client'

import { memo } from 'react'
import { motion } from 'framer-motion'
import { currencySymbol } from '@/lib/currency'

interface DataPoint { date: string; value: number }

interface Props {
  totalPnl: number
  monthlyPnl: number
  dailyPnl: number
  netPnl: number
  netMonthlyPnl: number
  netDailyPnl: number
  totalCosts: number
  currency: string
  equityCurve?: DataPoint[]
  startCapital?: number
}

function fmt(val: number, currency: string) {
  const sym = currencySymbol(currency)
  const sign = val >= 0 ? '+' : ''
  return `${sign}${val.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${sym}`
}

function smoothCubicPath(pts: [number, number][]): string {
  if (pts.length < 2) return ''
  let d = `M ${pts[0][0]},${pts[0][1]}`
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1]
    const [cx, cy] = pts[i]
    const cpx = px + (cx - px) * 0.5
    d += ` C ${cpx},${py} ${cpx},${cy} ${cx},${cy}`
  }
  return d
}

function Sparkline({ data, startCapital, positive }: { data: DataPoint[]; startCapital: number; positive: boolean }) {
  if (data.length < 2) return null
  const rawValues = [startCapital, ...data.map(d => d.value)]
  const min = Math.min(...rawValues)
  const max = Math.max(...rawValues)
  const range = max - min || 1
  const w = 400
  const h = 64
  // Leichtes vertikales Padding damit die Linie nicht an den Rand klebt
  const vPad = h * 0.08
  const pts: [number, number][] = rawValues.map((v, i) => [
    (i / (rawValues.length - 1)) * w,
    h - vPad - ((v - min) / range) * (h - vPad * 2),
  ])
  const color = positive ? 'var(--green)' : 'var(--red)'
  const linePath = smoothCubicPath(pts)
  const areaPath = `${linePath} L ${w},${h} L 0,${h} Z`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 64 }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={positive ? 0.22 : 0.15} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#sparkGrad)" />
      <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function PnLCard({ totalPnl, monthlyPnl, dailyPnl, netPnl, netMonthlyPnl, netDailyPnl, totalCosts, currency, equityCurve = [], startCapital = 0 }: Props) {
  const positive = netPnl >= 0
  const hasCosts = totalCosts > 0
  const color = positive ? 'var(--green)' : 'var(--red)'

  return (
    <motion.div
      className="rounded-2xl flex flex-col h-full"
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        boxShadow: 'var(--card-shadow)', padding: 16,
        position: 'relative', overflow: 'hidden',
      }}
      whileHover={{ boxShadow: 'var(--card-shadow-hover)', y: -1 }}
      transition={{ duration: 0.15 }}
    >
      {/* Top-Glow */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: 'linear-gradient(90deg,transparent,rgba(59,130,246,0.18),transparent)',
      }} />

      {/* Label */}
      <p style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: 10 }}>
        {hasCosts ? 'Netto P&L · Gesamt' : 'P&L · Gesamt'}
      </p>

      {/* Hero-Zahl */}
      <motion.p
        style={{
          fontSize: 32, fontWeight: 800, color, letterSpacing: '-0.04em', lineHeight: 1,
          fontFamily: 'var(--font-dm-mono)', fontVariantNumeric: 'tabular-nums',
          marginBottom: 8,
        }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        {fmt(netPnl, currency)}
      </motion.p>

      {/* Badge-Zeile */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {hasCosts && (
          <span style={{
            fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
            background: 'rgba(255,69,96,0.08)', border: '1px solid rgba(255,69,96,0.18)', color: 'var(--red)',
            fontFamily: 'var(--font-dm-mono)',
          }}>
            Kosten: -{totalCosts.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} {currencySymbol(currency)}
          </span>
        )}
        {netDailyPnl !== 0 && (
          <span style={{
            fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
            background: netDailyPnl >= 0 ? 'rgba(0,217,126,0.08)' : 'rgba(255,69,96,0.08)',
            border: netDailyPnl >= 0 ? '1px solid rgba(0,217,126,0.18)' : '1px solid rgba(255,69,96,0.18)',
            color: netDailyPnl >= 0 ? 'var(--green)' : 'var(--red)',
            fontFamily: 'var(--font-dm-mono)',
          }}>
            Heute: {fmt(netDailyPnl, currency)}
          </span>
        )}
      </div>

      {/* Sparkline */}
      {equityCurve.length >= 2 && (
        <div style={{ marginBottom: 12 }}>
          <Sparkline data={equityCurve} startCapital={startCapital} positive={positive} />
        </div>
      )}

      {/* Stats Footer */}
      <div style={{ display: 'flex', gap: 20, paddingTop: 10, borderTop: '1px solid var(--border)', marginTop: 'auto' }}>
        <div>
          <p style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 3 }}>Diesen Monat</p>
          <p style={{ fontSize: 13, fontWeight: 700, color: netMonthlyPnl >= 0 ? 'var(--green)' : 'var(--red)', fontFamily: 'var(--font-dm-mono)', fontVariantNumeric: 'tabular-nums' }}>
            {fmt(netMonthlyPnl, currency)}
          </p>
        </div>
        <div>
          <p style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 3 }}>Brutto</p>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', fontFamily: 'var(--font-dm-mono)', fontVariantNumeric: 'tabular-nums' }}>
            {fmt(totalPnl, currency)}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

export default memo(PnLCard)
