'use client'

import { memo } from 'react'
import { motion } from 'framer-motion'
import { Scale, AlertTriangle } from 'lucide-react'

interface Props {
  avgRR: number
  maxDrawdown: number
}

function RiskBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
      />
    </div>
  )
}

function RiskCard({ avgRR, maxDrawdown }: Props) {
  const rrColor = avgRR >= 2 ? 'var(--green)' : avgRR >= 1 ? 'var(--accent)' : 'var(--red)'
  const ddColor = maxDrawdown > 15 ? 'var(--red)' : maxDrawdown > 8 ? '#f59e0b' : 'var(--green)'

  return (
    <motion.div
      className="rounded-2xl p-5 flex flex-col gap-4 h-full"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--card-shadow)',
      }}
      whileHover={{ boxShadow: 'var(--card-shadow-hover)', y: -1 }}
      transition={{ duration: 0.15 }}
    >
      <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
        Risiko-Kennzahlen
      </p>

      <div className="flex flex-col gap-4">
        {/* R/R */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Scale size={13} style={{ color: 'var(--text-3)' }} />
              <span className="text-xs" style={{ color: 'var(--text-2)' }}>Avg. Risk/Reward</span>
            </div>
            <span className="text-sm font-bold font-mono" style={{ color: rrColor }}>
              1:{avgRR.toFixed(2)}
            </span>
          </div>
          <RiskBar value={avgRR} max={4} color={rrColor} />
        </div>

        {/* Drawdown */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={13} style={{ color: 'var(--text-3)' }} />
              <span className="text-xs" style={{ color: 'var(--text-2)' }}>Max. Drawdown</span>
            </div>
            <span className="text-sm font-bold font-mono" style={{ color: ddColor }}>
              -{maxDrawdown.toFixed(1)}%
            </span>
          </div>
          <RiskBar value={maxDrawdown} max={30} color={ddColor} />
        </div>
      </div>

      <div
        className="pt-3 text-xs"
        style={{ borderTop: '1px solid var(--border)', color: 'var(--text-3)' }}
      >
        {avgRR >= 2
          ? 'Sehr gutes R/R-Verhaltnis. Weiter so!'
          : avgRR >= 1
          ? 'Solides R/R-Verhaltnis. Ziel: >= 2.'
          : 'R/R verbessern - Ziele großer setzen.'}
      </div>
    </motion.div>
  )
}

export default memo(RiskCard)
