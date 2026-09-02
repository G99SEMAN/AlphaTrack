'use client'

import { memo, useMemo } from 'react'
import { motion } from 'framer-motion'
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts'
import InfoTooltip from '@/components/statistiken/InfoTooltip'
import { useTranslations } from 'next-intl'

interface Props {
  winRate: number        // 0-100
  profitFactor: number   // e.g. 1.8
  avgWin: number         // positive €
  avgLoss: number        // negative €
  maxDrawdown: number    // 0-100 %
  maxDrawdownAbs: number // größter Drawdown in € (für Recovery Factor)
  netPnl: number         // € (für Recovery Factor)
  trades: { pnl?: number; date: string; status: string }[]
}

const MIN_TRADES_FOR_FULL_SCORE = 20

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v))
}

export function computeAlphaScore(props: Props, t: ReturnType<typeof useTranslations<'dashboard.alphaScore'>>): {
  scores: { axis: string; value: number; tooltip: string }[]
  overall: number
  tradeCount: number
  isProvisional: boolean
} {
  const { winRate, profitFactor, avgWin, avgLoss, maxDrawdown, maxDrawdownAbs, netPnl, trades } = props

  // 1. Win Rate (10%): 30% = 0, 70% = 100
  const winScore = clamp((winRate - 30) / 40 * 100)

  // 2. Profit Factor (25%): PF 0.5 = 0, PF 3.0 = 100
  const pfScore = clamp((profitFactor - 0.5) / 2.5 * 100)

  // 3. Avg Win/Loss ratio (10%): ratio 1=33, 3=100
  const ratio = avgLoss < 0 ? avgWin / Math.abs(avgLoss) : avgWin > 0 ? 3 : 0
  const wlScore = clamp(ratio / 3 * 100)

  // 4. Recovery Factor (20%): Netto-Gewinn ÷ größter Drawdown in €. RF 0 = 0, RF 3+ = 100
  let rfScore: number
  if (maxDrawdownAbs > 0) {
    const recoveryFactor = netPnl / maxDrawdownAbs
    rfScore = clamp(recoveryFactor / 3 * 100)
  } else {
    rfScore = netPnl > 0 ? 100 : 50
  }

  // 5. Max Drawdown (20%): 0% = 100, 20%+ = 0 (invers)
  const ddScore = clamp(100 - maxDrawdown * 5)

  // 6. Consistency (15%): % profitabler Handelstage
  const closedTrades = trades.filter(t => t.status === 'closed' && t.pnl !== undefined)
  const dayMap = new Map<string, number>()
  for (const t of closedTrades) {
    const d = t.date.slice(0, 10)
    dayMap.set(d, (dayMap.get(d) ?? 0) + (t.pnl ?? 0))
  }
  const tradingDays = dayMap.size
  const profitableDays = [...dayMap.values()].filter(v => v > 0).length
  const consistencyScore = tradingDays > 0 ? clamp((profitableDays / tradingDays) * 100) : 0

  const weights = [0.10, 0.25, 0.10, 0.20, 0.20, 0.15]
  const rawScores = [winScore, pfScore, wlScore, rfScore, ddScore, consistencyScore]
  const overall = rawScores.reduce((sum, s, i) => sum + s * weights[i], 0)

  const tradeCount = closedTrades.length

  return {
    scores: [
      { axis: t('axisWinRate'), value: Math.round(winScore), tooltip: t('axisWinRateTooltip') },
      { axis: t('axisProfitFactor'), value: Math.round(pfScore), tooltip: t('axisProfitFactorTooltip') },
      { axis: t('axisAvgWinLoss'), value: Math.round(wlScore), tooltip: t('axisAvgWinLossTooltip') },
      { axis: t('axisRecovery'), value: Math.round(rfScore), tooltip: t('axisRecoveryTooltip') },
      { axis: t('axisMaxDrawdown'), value: Math.round(ddScore), tooltip: t('axisMaxDrawdownTooltip') },
      { axis: t('axisConsistency'), value: Math.round(consistencyScore), tooltip: t('axisConsistencyTooltip') },
    ],
    overall: Math.round(overall),
    tradeCount,
    isProvisional: tradeCount < MIN_TRADES_FOR_FULL_SCORE,
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
  const t = useTranslations('dashboard.alphaScore')
  const { scores, overall, tradeCount, isProvisional } = useMemo(() => computeAlphaScore(props, t), [props, t])

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

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        <p style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
          {t('title')}
        </p>
        <InfoTooltip text={t('overallTooltip')} />
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
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 600 }}>{t('yourScore')}</span>
          {isProvisional && (
            <span
              title={t('provisionalTitle', { count: tradeCount, total: MIN_TRADES_FOR_FULL_SCORE })}
              style={{
                fontSize: 8, fontWeight: 700, color: 'var(--amber)',
                background: 'rgba(245,158,11,0.12)', borderRadius: 99,
                padding: '1px 6px', letterSpacing: '0.02em',
              }}
            >
              {t('provisional', { count: tradeCount, total: MIN_TRADES_FOR_FULL_SCORE })}
            </span>
          )}
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
            <div key={s.axis} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <span style={{ fontSize: 9, color: 'var(--text-3)' }}>{s.axis}</span>
                <InfoTooltip text={s.tooltip} />
              </span>
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
