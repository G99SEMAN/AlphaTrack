'use client'

import { useMemo } from 'react'
import { X } from 'lucide-react'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { BotEntry } from '@/types/bot'
import { Trade } from '@/types/trade'

interface Props {
  botEntry: BotEntry
  trades: Trade[]
  onRemove: () => void
}

function fmtDate(s: string): string {
  const d = new Date(s)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function BotPerfCard({ botEntry, trades, onRemove }: Props) {
  const closedTrades = useMemo(
    () =>
      trades
        .filter(t => t.status === 'closed')
        .sort((a, b) => new Date(a.closeTime || a.date).getTime() - new Date(b.closeTime || b.date).getTime()),
    [trades],
  )

  const { totalPnl, winRate, avgRR, rrCount, chartData } = useMemo(() => {
    let running = 0
    let wins = 0
    let rrSum = 0
    let rrCount = 0
    const points: { date: string; value: number }[] = [{ date: 'Start', value: 0 }]

    for (const t of closedTrades) {
      const pnl = t.pnl ?? 0
      running += pnl
      if (pnl > 0) wins++
      if (t.rr !== undefined) { rrSum += t.rr; rrCount++ }
      points.push({ date: fmtDate(t.closeTime || t.date), value: Math.round(running * 100) / 100 })
    }

    return {
      totalPnl: running,
      winRate: closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0,
      avgRR: rrCount > 0 ? rrSum / rrCount : 0,
      rrCount,
      chartData: points,
    }
  }, [closedTrades])

  const positive = totalPnl >= 0
  const color = positive ? 'var(--green)' : 'var(--red)'
  const gradId = `pg-${botEntry.id}`

  const kpis = [
    { label: 'Win Rate', value: `${winRate.toFixed(1)}%`, color: winRate >= 50 ? 'var(--green)' : 'var(--red)' },
    { label: 'P&L', value: `${totalPnl >= 0 ? '+' : ''}${totalPnl.toLocaleString('de-DE', { maximumFractionDigits: 2 })}€`, color },
    { label: 'Trades', value: String(closedTrades.length), color: 'var(--text-1)' },
    { label: 'Avg RR', value: rrCount > 0 ? avgRR.toFixed(2) : '—', color: 'var(--text-1)' },
  ]

  return (
    <motion.div
      className="rounded-2xl p-5 flex flex-col gap-4"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--card-shadow)',
      }}
      whileHover={{ boxShadow: 'var(--card-shadow-hover)' }}
      transition={{ duration: 0.15 }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold" style={{ color: 'var(--text-1)' }}>{botEntry.name}</p>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>
            {closedTrades.length} {closedTrades.length === 1 ? 'Trade' : 'Trades'}
          </p>
        </div>
        <button
          onClick={onRemove}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--text-3)' }}
          title="Bot entfernen"
          aria-label="Bot entfernen"
        >
          <X size={15} />
        </button>
      </div>

      {closedTrades.length === 0 ? (
        <div
          className="flex items-center justify-center rounded-xl"
          style={{ height: 140, background: 'var(--bg)' }}
        >
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>Noch keine Trades</p>
        </div>
      ) : (
        <>
          <div style={{ height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fill: 'var(--text-3)', fontSize: 9, fontFamily: 'inherit' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: 'var(--text-3)', fontSize: 9, fontFamily: 'monospace' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `${(v as number).toLocaleString('de-DE')}€`}
                  width={58}
                />
                <ReferenceLine y={0} stroke="var(--text-3)" strokeDasharray="3 3" strokeOpacity={0.4} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const val = payload[0].value as number
                    return (
                      <div
                        className="px-2 py-1.5 rounded-lg text-xs"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                      >
                        <p style={{ color: val >= 0 ? 'var(--green)' : 'var(--red)', fontFamily: 'monospace' }}>
                          {val >= 0 ? '+' : ''}{val.toLocaleString('de-DE')}€
                        </p>
                      </div>
                    )
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={2}
                  fill={`url(#${gradId})`}
                  dot={false}
                  activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {kpis.map(kpi => (
              <div key={kpi.label} className="rounded-xl p-2 text-center" style={{ background: 'var(--bg)' }}>
                <p className="text-xs font-mono font-bold leading-tight" style={{ color: kpi.color }}>
                  {kpi.value}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{kpi.label}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </motion.div>
  )
}
