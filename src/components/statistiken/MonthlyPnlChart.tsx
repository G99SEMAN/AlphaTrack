'use client'

import { useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import { motion } from 'framer-motion'
import { currencySymbol } from '@/lib/currency'
import InfoTooltip from './InfoTooltip'
import { useTranslations } from 'next-intl'

interface DataPoint { month: string; pnl: number; trades: number }
interface Props { data: DataPoint[]; currency: string }

function CustomTooltip({ active, payload, label, currency }: { active?: boolean; payload?: { value: number; payload: DataPoint }[]; label?: string; currency: string }) {
  const t = useTranslations('statistiken.monthlyPnlChart')
  if (!active || !payload?.length) return null
  const { pnl, trades } = payload[0].payload
  return (
    <div className="px-3 py-2 rounded-lg text-xs" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
      <p className="font-semibold mb-1" style={{ color: 'var(--text-2)' }}>{label}</p>
      <p className="font-mono font-bold" style={{ color: pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
        {pnl >= 0 ? '+' : ''}{pnl.toLocaleString('de-DE', { minimumFractionDigits: 2 })} {currencySymbol(currency)}
      </p>
      <p style={{ color: 'var(--text-3)' }}>{trades} {t('tooltipTradesSuffix')}</p>
    </div>
  )
}

export default function MonthlyPnlChart({ data, currency }: Props) {
  const t = useTranslations('statistiken.monthlyPnlChart')
  const formatTick = useCallback((v: number) => `${v >= 0 ? '+' : ''}${v}€`, [])

  if (data.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="rounded-2xl p-5 flex flex-col gap-4 h-full"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
              {t('title')}
            </p>
            <InfoTooltip text={t('tooltip')} />
          </div>
          <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text-2)' }}>
            {data.length} {data.length === 1 ? t('monthSingular') : t('monthPlural')}
          </p>
        </div>
        <div className="hidden xs:flex items-center gap-3 text-xs" style={{ color: 'var(--text-3)' }}>
          <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--green)' }} /> {t('legendGain')}</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--red)' }} /> {t('legendLoss')}</span>
        </div>
        <div className="flex xs:hidden items-center gap-2 text-xs" style={{ color: 'var(--text-3)' }}>
          <span className="inline-block w-2 h-2 rounded-sm" style={{ background: 'var(--green)' }} />
          <span className="inline-block w-2 h-2 rounded-sm" style={{ background: 'var(--red)' }} />
        </div>
      </div>

      <div className="flex-1" style={{ minHeight: 'clamp(140px, 30vw, 180px)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="month"
              tick={{ fill: 'var(--text-3)', fontSize: 9, fontFamily: 'inherit' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'var(--text-3)', fontSize: 9, fontFamily: 'monospace' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatTick}
              width={48}
            />
            <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1} />
            <Tooltip content={<CustomTooltip currency={currency} />} cursor={false} />
            <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.pnl >= 0 ? 'var(--green)' : 'var(--red)'} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  )
}
