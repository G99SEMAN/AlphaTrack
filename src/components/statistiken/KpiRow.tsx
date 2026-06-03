'use client'

import { memo } from 'react'
import { motion } from 'framer-motion'
import { currencySymbol } from '@/lib/currency'
import InfoTooltip from './InfoTooltip'

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
        label="Profit Factor"
        value={pfLabel}
        sub={profitFactor >= 1.5 ? 'Sehr gut (Ziel: >1.5)' : profitFactor >= 1 ? 'Solide (Ziel: >1.5)' : 'Unter Break-even'}
        color={pfColor}
        delay={0}
        tooltip="Summe aller Gewinne ÷ Summe aller Verluste. Ziel: >1.5. >2.0 gilt als exzellent."
      />
      <KpiCard
        label="Erwartungswert"
        value={`${expSign}${expectancy.toLocaleString('de-DE', { minimumFractionDigits: 2 })} ${currencySymbol(currency)}`}
        sub="Erwarteter Gewinn je Trade"
        color={expColor}
        delay={0.04}
        tooltip="Durchschnittlicher erwarteter Gewinn pro Trade. Positiv = System verdient langfristig."
      />
      <KpiCard
        label="Gewinn / Verlust"
        value={`${winLossRatio.toFixed(2)}`}
        sub={`Ø+${avgWin.toLocaleString('de-DE', { minimumFractionDigits: 2 })} / Ø${avgLoss.toLocaleString('de-DE', { minimumFractionDigits: 2 })} ${currencySymbol(currency)}`}
        color={ratioColor}
        delay={0.08}
        tooltip="Durchschnittlicher Gewinn ÷ durchschnittlicher Verlust (absolut). >1.5 empfohlen."
      />
      <KpiCard
        label="Kosten-Quote"
        value={`${costRatio.toFixed(1)}%`}
        sub="Provision+Swap / |Brutto-P&L|"
        color={costColor}
        delay={0.12}
        tooltip="Provision + Swap + Spread als % des Brutto-P&L. <10% ist sehr gut."
      />
      <KpiCard
        label="Gesamt-ROI"
        value={`${roiSign}${roi.toFixed(2)}%`}
        sub="Netto-P&L / eingesetztes Kapital"
        color={roiColor}
        delay={0.16}
        tooltip="Netto-P&L ÷ eingesetztes Startkapital × 100."
      />
      <KpiCard
        label="Trades / Tag"
        value={avgTradesPerDay.toFixed(2)}
        sub="Ø Trades pro Kalendertag"
        color="var(--text-1)"
        delay={0.20}
        tooltip="Durchschnittliche Trades pro Kalendertag seit dem ersten Trade."
      />
    </div>
  )
}

export default memo(KpiRow)
