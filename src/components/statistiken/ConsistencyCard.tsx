'use client'

import { motion } from 'framer-motion'
import { Target } from 'lucide-react'
import InfoTooltip from './InfoTooltip'
import { useTranslations } from 'next-intl'

interface Props {
  consistencyScore: number
  profitableWeeks: number
  totalWeeks: number
}

export default function ConsistencyCard({ consistencyScore, profitableWeeks, totalWeeks }: Props) {
  const t = useTranslations('statistiken.consistencyCard')
  const color = consistencyScore >= 70 ? 'var(--green)' : consistencyScore >= 50 ? '#f59e0b' : 'var(--red)'
  const bgColor = consistencyScore >= 70 ? 'var(--green-bg)' : consistencyScore >= 50 ? 'rgba(245,158,11,0.1)' : 'var(--red-bg)'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-2xl p-5 flex flex-col gap-4"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
            {t('title')}
          </p>
          <InfoTooltip text={t('tooltip')} />
        </div>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: bgColor }}>
          <Target size={15} style={{ color }} />
        </div>
      </div>

      <div className="flex items-end gap-3">
        <p className="text-3xl font-bold font-mono" style={{ color }}>
          {totalWeeks > 0 ? `${consistencyScore.toFixed(0)}%` : '-'}
        </p>
        <p className="text-sm mb-1" style={{ color: 'var(--text-3)' }}>
          {t('weeksLabel', { profitable: profitableWeeks, total: totalWeeks })}
        </p>
      </div>

      <div>
        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: color }}
            initial={{ width: 0 }}
            animate={{ width: `${consistencyScore}%` }}
            transition={{ duration: 0.7, delay: 0.35, ease: 'easeOut' }}
          />
        </div>
        <p className="text-xs mt-1.5" style={{ color: 'var(--text-3)' }}>
          {consistencyScore >= 70 ? t('statusGood') : consistencyScore >= 50 ? t('statusOk') : t('statusBad')}
        </p>
      </div>
    </motion.div>
  )
}
