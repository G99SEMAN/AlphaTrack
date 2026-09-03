'use client'

import { motion } from 'framer-motion'
import { TrendingDown } from 'lucide-react'
import InfoTooltip from './InfoTooltip'
import { useTranslations } from 'next-intl'

interface Props {
  maxDrawdown: number
  recoveryFactor: number
}

export default function DrawdownCard({ maxDrawdown, recoveryFactor }: Props) {
  const t = useTranslations('statistiken.drawdownCard')
  const ddColor = maxDrawdown <= 10 ? 'var(--green)' : maxDrawdown <= 25 ? '#f59e0b' : 'var(--red)'
  const rfColor = recoveryFactor >= 2 ? 'var(--green)' : recoveryFactor >= 1 ? '#f59e0b' : 'var(--red)'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="rounded-2xl p-5 flex flex-col gap-4"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
            {t('maxDrawdownLabel')}
          </p>
          <InfoTooltip text={t('tooltip')} />
        </div>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--red-bg)' }}>
          <TrendingDown size={15} style={{ color: 'var(--red)' }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>{t('maxDrawdownLabel')}</p>
          <p className="text-2xl font-bold font-mono" style={{ color: ddColor }}>
            -{maxDrawdown.toFixed(1)}%
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
            {maxDrawdown <= 10 ? t('ddSubGood') : maxDrawdown <= 25 ? t('ddSubOk') : t('ddSubBad')}
          </p>
        </div>
        <div>
          <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>{t('recoveryFactorLabel')}</p>
          <p className="text-2xl font-bold font-mono" style={{ color: rfColor }}>
            {recoveryFactor > 0 ? recoveryFactor.toFixed(2) : '-'}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
            {recoveryFactor >= 2 ? t('rfSubGood') : recoveryFactor >= 1 ? t('rfSubOk') : recoveryFactor > 0 ? t('rfSubWeak') : t('rfSubNA')}
          </p>
        </div>
      </div>

      <div>
        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: ddColor }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, maxDrawdown)}%` }}
            transition={{ duration: 0.7, delay: 0.3, ease: 'easeOut' }}
          />
        </div>
      </div>
    </motion.div>
  )
}
