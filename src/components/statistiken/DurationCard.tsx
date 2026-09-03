'use client'

import { motion } from 'framer-motion'
import { Clock } from 'lucide-react'
import InfoTooltip from './InfoTooltip'
import { useTranslations } from 'next-intl'

interface Props {
  avgDurationMinutes: number
  avgDurationLongMinutes: number
  avgDurationShortMinutes: number
}

function formatDuration(minutes: number, t: ReturnType<typeof useTranslations<'statistiken.durationCard'>>): string {
  if (minutes <= 0) return '-'
  if (minutes < 60) return `${Math.round(minutes)} ${t('minutesUnit')}`
  if (minutes < 1440) return `${(minutes / 60).toFixed(1)} ${t('hoursUnit')}`
  return `${(minutes / 1440).toFixed(1)} ${t('daysUnit')}`
}

export default function DurationCard({ avgDurationMinutes, avgDurationLongMinutes, avgDurationShortMinutes }: Props) {
  const t = useTranslations('statistiken.durationCard')
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
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
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--surface-2)' }}>
          <Clock size={15} style={{ color: 'var(--text-3)' }} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
          <p className="text-xs mb-1 uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{t('totalAvgLabel')}</p>
          <p className="text-base font-bold font-mono" style={{ color: 'var(--text-1)' }}>
            {formatDuration(avgDurationMinutes, t)}
          </p>
        </div>
        <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
          <p className="text-xs mb-1 uppercase tracking-wide" style={{ color: 'var(--green)' }}>{t('longAvgLabel')}</p>
          <p className="text-base font-bold font-mono" style={{ color: 'var(--text-1)' }}>
            {formatDuration(avgDurationLongMinutes, t)}
          </p>
        </div>
        <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
          <p className="text-xs mb-1 uppercase tracking-wide" style={{ color: 'var(--red)' }}>{t('shortAvgLabel')}</p>
          <p className="text-base font-bold font-mono" style={{ color: 'var(--text-1)' }}>
            {formatDuration(avgDurationShortMinutes, t)}
          </p>
        </div>
      </div>

      <p className="text-xs" style={{ color: 'var(--text-3)' }}>
        {t('footnote')}
      </p>
    </motion.div>
  )
}
