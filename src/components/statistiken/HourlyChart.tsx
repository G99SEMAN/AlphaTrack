'use client'

import { useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import { motion } from 'framer-motion'
import { currencySymbol } from '@/lib/currency'
import { HourlyStats } from '@/lib/statsExtended'
import InfoTooltip from './InfoTooltip'

interface Props { data: HourlyStats[]; currency: string }

function CustomTooltip({ active, payload, currency }: { active?: boolean; payload?: { value: number; payload: HourlyStats }[]; currency: string }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="px-3 py-2 rounded-lg text-xs" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
      <p className="font-semibold mb-1" style={{ color: 'var(--text-2)' }}>{row.label} ({row.trades} Trades)</p>
      <p className="font-mono" style={{ color: row.avgPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
        Ø {row.avgPnl >= 0 ? '+' : ''}{row.avgPnl.toLocaleString('de-DE', { minimumFractionDigits: 2 })} {currencySymbol(currency)}
      </p>
      <p className="font-mono mt-0.5" style={{ color: 'var(--accent)' }}>
        Win Rate: {row.winRate.toFixed(1)}%
      </p>
    </div>
  )
}

export default function HourlyChart({ data, currency }: Props) {
  const sym = currencySymbol(currency)
  const formatTick = useCallback((v: number) => `${v >= 0 ? '+' : ''}${v}${sym}`, [sym])

  if (data.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="rounded-2xl p-5 flex flex-col gap-4 h-full"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}
    >
      <div className="flex items-center gap-1.5">
        <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
          Stunden-Analyse — Ø P&L pro Stunde
        </p>
        <InfoTooltip text="Performance nach Tageszeit (Schlussstunde des Trades). Ideal für Session-Analyse." />
      </div>

      <div className="flex-1" style={{ minHeight: 'clamp(120px, 28vw, 160px)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="label"
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
                  fill={entry.avgPnl >= 0 ? 'var(--green)' : 'var(--red)'}
                  fillOpacity={0.85}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex gap-1 flex-wrap" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        {data.map(d => (
          <div key={d.label} className="flex flex-col items-center gap-1" style={{ minWidth: 28 }}>
            <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)', minWidth: 20 }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${d.winRate}%`,
                  background: d.winRate >= 50 ? 'var(--accent)' : 'var(--text-3)',
                }}
              />
            </div>
            <span className="font-mono" style={{ color: 'var(--text-3)', fontSize: 9 }}>
              {d.winRate.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
