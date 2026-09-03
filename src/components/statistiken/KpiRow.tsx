'use client'

import { memo } from 'react'
import { motion } from 'framer-motion'
import { currencySymbol } from '@/lib/currency'
import InfoTooltip from './InfoTooltip'
import { useTranslations } from 'next-intl'

interface Props {
  profitFactor: number
  expectancy: number
  avgWin: number
  avgLoss: number
  winLossRatio: number
  costRatio: number
  roi: number
  avgTradesPerDay: number
  currency: string
}

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  color: string
  delay: number
  tooltip: string
}

function KpiCard({ label, value, sub, color, delay, tooltip }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="rounded-xl px-3 py-3 sm:px-4 sm:py-3.5 flex flex-col gap-1"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide leading-tight" style={{ color: 'var(--text-3)' }}>
          {label}
        </p>
        <InfoTooltip text={tooltip} />
      </div>
      <p className="text-base sm:text-xl font-bold font-mono leading-tight break-all" style={{ color }}>
        {value}
      </p>
      {sub && (
        <p className="hidden sm:block text-xs" style={{ color: 'var(--text-3)' }}>{sub}</p>
      )}
    </motion.div>
  )
}

function KpiRow({ profitFactor, expectancy, avgWin, avgLoss, winLossRatio, costRatio, roi, avgTradesPerDay, currency }: Props) {
  const t = useTranslations('statistiken.kpiRow')
  const pfLabel = profitFactor >= 99 ? '∞' : profitFactor.toFixed(2)
  const pfColor = profitFactor >= 1.5 ? 'var(--green)' : profitFactor >= 1 ? '#f59e0b' : 'var(--red)'

  const expColor = expectancy >= 0 ? 'var(--green)' : 'var(--red)'
  const expSign = expectancy >= 0 ? '+' : ''

  const ratioColor = winLossRatio >= 1.5 ? 'var(--green)' : winLossRatio >= 1 ? '#f59e0b' : 'var(--red)'

  const costColor = costRatio <= 10 ? 'var(--green)' : costRatio <= 25 ? '#f59e0b' : 'var(--red)'

  const roiColor = roi >= 0 ? 'var(--green)' : 'var(--red)'
  const roiSign = roi >= 0 ? '+' : ''

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <KpiCard
        label={t('pfLabel')}
        value={pfLabel}
        sub={profitFactor >= 1.5 ? t('pfSubGood') : profitFactor >= 1 ? t('pfSubOk') : t('pfSubBad')}
        color={pfColor}
        delay={0}
        tooltip={t('pfTooltip')}
      />
      <KpiCard
        label={t('expLabel')}
        value={`${expSign}${expectancy.toLocaleString('de-DE', { minimumFractionDigits: 2 })} ${currencySymbol(currency)}`}
        sub={t('expSub')}
        color={expColor}
        delay={0.04}
        tooltip={t('expTooltip')}
      />
      <KpiCard
        label={t('wlLabel')}
        value={`${winLossRatio.toFixed(2)}`}
        sub={`Ø+${avgWin.toLocaleString('de-DE', { minimumFractionDigits: 2 })} / Ø${avgLoss.toLocaleString('de-DE', { minimumFractionDigits: 2 })} ${currencySymbol(currency)}`}
        color={ratioColor}
        delay={0.08}
        tooltip={t('wlTooltip')}
      />
      <KpiCard
        label={t('costLabel')}
        value={`${costRatio.toFixed(1)}%`}
        sub={t('costSub')}
        color={costColor}
        delay={0.12}
        tooltip={t('costTooltip')}
      />
      <KpiCard
        label={t('roiLabel')}
        value={`${roiSign}${roi.toFixed(2)}%`}
        sub={t('roiSub')}
        color={roiColor}
        delay={0.16}
        tooltip={t('roiTooltip')}
      />
      <KpiCard
        label={t('tpdLabel')}
        value={avgTradesPerDay.toFixed(2)}
        sub={t('tpdSub')}
        color="var(--text-1)"
        delay={0.20}
        tooltip={t('tpdTooltip')}
      />
    </div>
  )
}

export default memo(KpiRow)
