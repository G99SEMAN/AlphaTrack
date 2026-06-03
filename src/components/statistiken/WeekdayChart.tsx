'use client'

import { useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import { motion } from 'framer-motion'
import { currencySymbol } from '@/lib/currency'
import { WeekdayStats } from '@/lib/statsExtended'
import InfoTooltip from './InfoTooltip'

interface Props { data: WeekdayStats[]; currency: string }

function CustomTooltip({ active, payload, label, currency }: { active?: boolean; payload?: { value: number; dataKey: string; payload: WeekdayStats }[]; label?: string; currency: string }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="px-3 py-2 rounded-lg text-xs" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
      <p className="font-semibold mb-1" style={{ color: 'var(--text-2)' }}>{label} ({row.trades} Trades)</p>
      <p className="font-mono" style={{ color: row.avgPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
        Ø {row.avgPnl >= 0 ? '+' : ''}{row.avgPnl.toLocaleString('de-DE', { minimumFractionDigits: 2 })} {currencySymbol(currency)}
      </p>
      <p className="font-mono mt-0.5" style={{ color: 'var(--accent)' }}>
        Win Rate: {row.winRate.toFixed(1)}%
      </p>
    </div>
  )
}

export default function WeekdayChart({ data, currency }: Props) {
  const formatTick = useCallback((v: number) => `${v >= 0 ? '+' : ''}${v}€`, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="rounded-2xl p-5 flex flex-col gap-4 h-full"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}
    >
      <div className="flex items-center gap-1.5">
        <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
          Wochentags-Analyse — Ø P&L pro Tag
        </p>
        <InfoTooltip text="Performance nach Wochentag. Zeigt an welchen Tagen du am profitabelsten tradest." />
      </div>

      <div className="flex-1" style={{ minHeight: 'clamp(120px, 28vw, 160px)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="day"
              tick={{ fill: 'var(--text-3)', fontSize: 9, fontFamily: 'inherit' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'var(--text-3)', fontSize: 9, fontFamily: 'monospace' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatTick}
              width={46}
            />
            <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1} />
            <Tooltip content={<CustomTooltip currency={currency} />} cursor={false} />
            <Bar dataKey="avgPnl" radius={[4, 4, 0, 0]}>
              {data.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.trades === 0 ? 'var(--surface-3)' : entry.avgPnl >= 0 ? 'var(--green)' : 'var(--red)'}
                  fillOpacity={entry.trades === 0 ? 0.3 : 0.85}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Win Rate Mini-Leiste */}
      <div className="flex gap-1" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        {data.map(d => (
          <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${d.winRate}%`,
                  background: d.winRate >= 50 ? 'var(--accent)' : 'var(--text-3)',
                }}
              />
            </div>
            <span className="text-xs font-mono" style={{ color: 'var(--text-3)', fontSize: 10 }}>
              {d.trades > 0 ? `${d.winRate.toFixed(0)}%` : '-'}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
