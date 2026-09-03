'use client'

import { useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import { motion } from 'framer-motion'
import { currencySymbol } from '@/lib/currency'
import { HourlyStats } from '@/lib/statsExtended'
import InfoTooltip from './InfoTooltip'
import { useTranslations } from 'next-intl'

interface Props { data: HourlyStats[]; currency: string }

function CustomTooltip({ active, payload, currency }: { active?: boolean; payload?: { value: number; payload: HourlyStats }[]; currency: string }) {
  const t = useTranslations('statistiken.hourlyChart')
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  const sym = currencySymbol(currency)
  return (
    <div className="px-3 py-2 rounded-lg text-xs" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
      <p className="font-semibold mb-1.5" style={{ color: 'var(--text-2)' }}>{row.label} · {row.trades} {t('tooltipTradesSuffix')}</p>
      <p className="font-mono" style={{ color: row.totalPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
        {t('totalLabel')} {row.totalPnl >= 0 ? '+' : ''}{row.totalPnl.toLocaleString('de-DE', { minimumFractionDigits: 2 })} {sym}
      </p>
      <p className="font-mono" style={{ color: 'var(--text-3)' }}>
        {t('avgPerTradeLabel')} {row.avgPnl >= 0 ? '+' : ''}{row.avgPnl.toLocaleString('de-DE', { minimumFractionDigits: 2 })} {sym}
      </p>
      <p className="font-mono mt-0.5" style={{ color: row.winRate >= 50 ? 'var(--green)' : 'var(--red)' }}>
        {t('winRateLabel')} {row.winRate.toFixed(1)}%
      </p>
    </div>
  )
}

export default function HourlyChart({ data, currency }: Props) {
  const t = useTranslations('statistiken.hourlyChart')
  const sym = currencySymbol(currency)

  const formatTick = useCallback((v: number) => {
    if (v === 0) return `0${sym}`
    const abs = Math.abs(v)
    const prefix = v >= 0 ? '+' : '-'
    return abs >= 10
      ? `${prefix}${abs.toFixed(0)}${sym}`
      : `${prefix}${abs.toFixed(1)}${sym}`
  }, [sym])

  if (data.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="rounded-2xl p-5 flex flex-col gap-4"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}
    >
      <div className="flex items-center gap-1.5">
        <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
          {t('title')}
        </p>
        <InfoTooltip text={t('tooltip')} />
      </div>

      {/* Balkendiagramm */}
      <div style={{ height: 220 }}>
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
              width={54}
            />
            <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1} />
            <Tooltip content={<CustomTooltip currency={currency} />} cursor={false} />
            <Bar dataKey="totalPnl" radius={[4, 4, 0, 0]} maxBarSize={32}>
              {data.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.totalPnl >= 0 ? 'var(--green)' : 'var(--red)'}
                  fillOpacity={0.85}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Win-Rate + Trade-Anzahl pro Stunde */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <p className="text-[9px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-3)' }}>
          {t('winRateAndCountLabel')}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {data.map(d => {
            const wr = d.winRate
            const color = wr >= 55 ? 'var(--green)' : wr >= 45 ? '#f59e0b' : 'var(--red)'
            return (
              <div
                key={d.label}
                className="flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-subtle)',
                  minWidth: 42,
                }}
              >
                <span className="font-mono text-[9px]" style={{ color: 'var(--text-3)' }}>
                  {d.label}
                </span>
                <span className="font-bold text-[11px]" style={{ color }}>
                  {d.winRate.toFixed(0)}%
                </span>
                <span className="text-[9px]" style={{ color: 'var(--text-3)' }}>
                  {d.trades}×
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}
