'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { motion } from 'framer-motion'
import { RMultipleBucket } from '@/lib/statsExtended'
import InfoTooltip from './InfoTooltip'
import { useTranslations } from 'next-intl'

interface Props { data: RMultipleBucket[]; totalTrades: number }

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  const t = useTranslations('statistiken.rMultipleChart')
  if (!active || !payload?.length) return null
  return (
    <div className="px-3 py-2 rounded-lg text-xs" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
      <p className="font-semibold" style={{ color: 'var(--text-2)' }}>{label}</p>
      <p className="font-mono mt-0.5" style={{ color: 'var(--text-1)' }}>{payload[0].value} {t('tooltipTradesSuffix')}</p>
    </div>
  )
}

export default function RMultipleChart({ data, totalTrades }: Props) {
  const t = useTranslations('statistiken.rMultipleChart')
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="rounded-2xl p-5 flex flex-col gap-4 h-full"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}
    >
      <div>
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
            {t('title')}
          </p>
          <InfoTooltip text={t('tooltip')} />
        </div>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
          {t('tradesWithSlLabel')} {totalTrades}
        </p>
      </div>

      <div className="flex-1" style={{ minHeight: 'clamp(120px, 28vw, 160px)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--text-3)', fontSize: 9, fontFamily: 'monospace' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'var(--text-3)', fontSize: 9, fontFamily: 'inherit' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={26}
            />
            <Tooltip content={<CustomTooltip />} cursor={false} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {data.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.label === '~0' ? 'var(--text-3)' : entry.isPositive ? 'var(--green)' : 'var(--red)'}
                  fillOpacity={0.85}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs" style={{ color: 'var(--text-3)', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
        {t('footnote')}
      </p>
    </motion.div>
  )
}
