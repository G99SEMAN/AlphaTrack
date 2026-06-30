'use client'

import { memo, useMemo } from 'react'
import { motion } from 'framer-motion'
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts'

interface Props {
  winRate: number        // 0-100
  profitFactor: number   // e.g. 1.8
  avgWin: number         // positive €
  avgLoss: number        // negative €
  maxDrawdown: number    // 0-100 %
  netPnl: number         // € (for recovery factor)
  trades: { pnl?: number; date: string; status: string }[]
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v))
}

export function computeAlphaScore(props: Props): {
  scores: { axis: string; value: number }[]
  overall: number
} {
  const { winRate, profitFactor, avgWin, avgLoss, maxDrawdown, netPnl, trades } = props

  // 1. Win Rate (20%): 30% = 0, 70% = 100
  const winScore = clamp((winRate - 30) / 40 * 100)

  // 2. Profit Factor (25%): PF 0.5 = 0, PF 3.0 = 100
  const pfScore = clamp((profitFactor - 0.5) / 2.5 * 100)

  // 3. Avg Win/Loss ratio (20%): ratio 1=33, 3=100
  const ratio = avgLoss < 0 ? avgWin / Math.abs(avgLoss) : avgWin > 0 ? 3 : 0
  const wlScore = clamp(ratio / 3 * 100)

  // 4. Recovery Factor (15%): RF = netPnl / maxDrawdownAbs
  // We approximate max drawdown absolute from maxDrawdown % and netPnl
  // Simpler: use netPnl / (maxDrawdown/100 * (netPnl + 1)) — just use the ratio
  let rfScore = 50
  if (maxDrawdown > 0) {
    const rf = netPnl > 0 ? netPnl / (maxDrawdown * 10) : 0
    rfScore = clamp(rf / 3 * 100)
  } else if (netPnl > 0) {
    rfScore = 100
  }

  // 5. Max Drawdown (10%): 0% = 100, 20%+ = 0 (inverse)
  const ddScore = clamp(100 - maxDrawdown * 5)

  // 6. Consistency (10%): % profitable trading days
  const closedTrades = trades.filter(t => t.status === 'closed' && t.pnl !== undefined)
  const dayMap = new Map<string, number>()
  for (const t of closedTrades) {
    const d = t.date.slice(0, 10)
    dayMap.set(d, (dayMap.get(d) ?? 0) + (t.pnl ?? 0))
  }
  const tradingDays = dayMap.size
  const profitableDays = [...dayMap.values()].filter(v => v > 0).length
  const consistencyScore = tradingDays > 0 ? clamp((profitableDays / tradingDays) * 100) : 0

  const weights = [0.20, 0.25, 0.20, 0.15, 0.10, 0.10]
  const rawScores = [winScore, pfScore, wlScore, rfScore, ddScore, consistencyScore]
  const overall = rawScores.reduce((sum, s, i) => sum + s * weights[i], 0)

  return {
    scores: [
      { axis: 'Win %', value: Math.round(winScore) },
      { axis: 'Profit Factor', value: Math.round(pfScore) },
      { axis: 'Avg Win/Loss', value: Math.round(wlScore) },
      { axis: 'Recovery', value: Math.round(rfScore) },
      { axis: 'Max DD', value: Math.round(ddScore) },
      { axis: 'Konsistenz', value: Math.round(consistencyScore) },
    ],
    overall: Math.round(overall),
  }
}

function ScoreBar({ score }: { score: number }) {
  const pct = score
  // Color interpolation: 0=red, 50=yellow, 80+=green
  const color = score >= 70 ? '#00d97e' : score >= 45 ? '#f59e0b' : '#ff4560'

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 9, color: 'var(--text-3)' }}>0</span>
        <span style={{ fontSize: 9, color: 'var(--text-3)' }}>100</span>
      </div>
      <div style={{ height: 8, borderRadius: 99, background: 'var(--surface-3)', overflow: 'hidden', position: 'relative' }}>
        {/* gradient background */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(90deg, #ff4560 0%, #f59e0b 40%, #00d97e 80%, #00d97e 100%)',
          opacity: 0.25,
        }} />
        {/* score indicator */}
        <motion.div
          style={{
            position: 'absolute', top: 0, bottom: 0,
            width: 3, borderRadius: 99,
            background: color,
            boxShadow: `0 0 6px ${color}`,
          }}
          initial={{ left: 0 }}
          animate={{ left: `calc(${pct}% - 1.5px)` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
        />
      </div>
    </div>
  )
}

function AlphaScoreChart(props: Props) {
  const { scores, overall } = useMemo(() => computeAlphaScore(props), [props])

  const scoreColor = overall >= 70 ? 'var(--green)' : overall >= 45 ? 'var(--amber)' : 'var(--red)'

  const chartData = scores.map(s => ({ subject: s.axis, A: s.value, fullMark: 100 }))

  return (
    <motion.div
      className="rounded-2xl flex flex-col"
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        boxShadow: 'var(--card-shadow)', padding: 16,
        position: 'relative', overflow: 'hidden',
      }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.2 }}
    >
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: 'linear-gradient(90deg,transparent,rgba(139,92,246,0.25),transparent)',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <p style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
          Alpha Score
        </p>
      </div>

      {/* Radar Chart */}
      <div style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
            <PolarGrid
              stroke="rgba(139,92,246,0.15)"
              gridType="polygon"
            />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: 'var(--text-3)', fontSize: 9, fontWeight: 600 }}
              tickLine={false}
            />
            <Radar
              name="Score"
              dataKey="A"
              stroke="rgba(139,92,246,0.8)"
              fill="rgba(139,92,246,0.22)"
              strokeWidth={1.5}
              dot={{ fill: 'rgba(139,92,246,0.9)', r: 3, strokeWidth: 0 }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Score number + bar */}
      <div style={{ marginTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 600 }}>Dein Alpha Score</span>
        </div>
        <motion.p
          style={{
            fontSize: 28, fontWeight: 800, color: scoreColor,
            letterSpacing: '-0.04em', lineHeight: 1,
            fontFamily: 'var(--font-dm-mono)', fontVariantNumeric: 'tabular-nums',
            marginBottom: 10,
          }}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          {overall}
        </motion.p>
        <ScoreBar score={overall} />

        {/* Axis breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          {scores.map(s => (
            <div key={s.axis} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 9, color: 'var(--text-3)' }}>{s.axis}</span>
              <span style={{
                fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-dm-mono)',
                color: s.value >= 70 ? 'var(--green)' : s.value >= 45 ? 'var(--amber)' : 'var(--red)',
              }}>
                {s.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

export default memo(AlphaScoreChart)
