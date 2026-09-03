'use client'

import { motion } from 'framer-motion'
import { AnalyseResult } from '@/app/api/analyse/route'
import { TrendingUp, TrendingDown, Minus, Target, ShieldAlert, Crosshair, BarChart2, Info, Activity } from 'lucide-react'
import { useTranslations } from 'next-intl'

const BIAS_CONFIG = {
  Long: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', icon: TrendingUp, label: 'Long' },
  Short: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: TrendingDown, label: 'Short' },
  Neutral: { color: 'var(--text-2)', bg: 'var(--surface-2)', icon: Minus, label: 'Neutral' },
}

const CONFIDENCE_COLOR = {
  Hoch: '#22c55e',
  Mittel: '#f59e0b',
  Niedrig: '#ef4444',
}

interface CardProps {
  icon: React.ElementType
  label: string
  value: string
  valueColor?: string
  valueBg?: string
  delay: number
}

function MetricCard({ icon: Icon, label, value, valueColor, valueBg, delay }: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="flex flex-col gap-2 p-4 rounded-xl border"
      style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center gap-1.5">
        <Icon size={13} style={{ color: 'var(--text-3)' }} />
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
          {label}
        </span>
      </div>
      <span
        className="text-lg font-bold"
        style={{ color: valueColor ?? 'var(--text-1)', background: valueBg, borderRadius: valueBg ? 6 : undefined, padding: valueBg ? '2px 8px' : undefined, display: 'inline-block' }}
      >
        {value}
      </span>
    </motion.div>
  )
}

interface Props {
  result: AnalyseResult & { currentPrice?: string }
}

export default function AnalysisResult({ result }: Props) {
  const t = useTranslations('analyse.result')
  const bias = BIAS_CONFIG[result.bias]
  const BiasIcon = bias.icon
  const confidenceLabel = result.confidence === 'Hoch'
    ? t('confidenceHigh')
    : result.confidence === 'Mittel'
      ? t('confidenceMedium')
      : t('confidenceLow')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold" style={{ color: 'var(--text-2)' }}>
          {t('resultHeading')}
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full border" style={{ color: 'var(--text-3)', borderColor: 'var(--border)' }}>
          {result.timeframe}
        </span>
      </div>

      {/* Aktueller Kurs */}
      {result.currentPrice && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
        >
          <Activity size={14} style={{ color: 'var(--accent)' }} />
          <span className="text-xs" style={{ color: 'var(--text-3)' }}>{t('currentPriceLabel')}</span>
          <span className="ml-auto text-sm font-bold font-mono" style={{ color: 'var(--text-1)' }}>
            {result.currentPrice}
          </span>
        </motion.div>
      )}

      {/* Bias prominent */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-3 px-5 py-4 rounded-xl border"
        style={{ background: bias.bg, borderColor: bias.color + '40' }}
      >
        <BiasIcon size={28} style={{ color: bias.color }} strokeWidth={2.5} />
        <div>
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: bias.color, opacity: 0.8 }}>{t('marketBiasLabel')}</p>
          <p className="text-2xl font-bold" style={{ color: bias.color }}>{bias.label}</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-xs" style={{ color: 'var(--text-3)' }}>{t('confidenceLabel')}</span>
          <span className="text-sm font-bold" style={{ color: CONFIDENCE_COLOR[result.confidence] }}>
            {confidenceLabel}
          </span>
        </div>
      </motion.div>

      {/* Metriken Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard icon={Crosshair} label={t('entryZoneLabel')} value={result.entry_zone} delay={0.05} />
        <MetricCard icon={ShieldAlert} label={t('stopLossLabel')} value={result.stop_loss} valueColor="#ef4444" delay={0.1} />
        <MetricCard icon={Target} label={t('takeProfitLabel')} value={result.take_profit} valueColor="#22c55e" delay={0.15} />
        <MetricCard icon={BarChart2} label={t('riskRewardLabel')} value={result.risk_reward} delay={0.2} />
      </div>

      {/* Begründung */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.25 }}
        className="flex gap-3 p-4 rounded-xl border"
        style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
      >
        <Info size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--text-3)' }} />
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
          {result.reasoning}
        </p>
      </motion.div>
    </div>
  )
}
