'use client'

import { memo } from 'react'
import { motion } from 'framer-motion'

interface Props {
  avgRR: number
  maxDrawdown: number
}

function RiskBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div style={{ width: '100%', height: 3, borderRadius: 99, background: 'var(--surface-3)', overflow: 'hidden' }}>
      <motion.div
        style={{ height: '100%', borderRadius: 99, background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
      />
    </div>
  )
}

function RiskCard({ avgRR, maxDrawdown }: Props) {
  const rrColor = avgRR >= 2 ? 'var(--green)' : avgRR >= 1 ? 'var(--accent)' : 'var(--red)'
  const ddColor = maxDrawdown > 15 ? 'var(--red)' : maxDrawdown > 8 ? 'var(--amber)' : 'var(--green)'

  return (
    <motion.div
      className="rounded-2xl flex flex-col h-full"
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        boxShadow: 'var(--card-shadow)', padding: 16,
        position: 'relative', overflow: 'hidden',
      }}
      whileHover={{ boxShadow: 'var(--card-shadow-hover)', y: -1 }}
      transition={{ duration: 0.15 }}
    >
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: 'linear-gradient(90deg,transparent,rgba(59,130,246,0.15),transparent)',
      }} />

      <p style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: 10 }}>
        Risiko
      </p>

      <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
        <div>
          <p style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 3 }}>Avg R:R</p>
          <p style={{ fontSize: 22, fontWeight: 800, color: rrColor, letterSpacing: '-0.02em', lineHeight: 1, fontFamily: 'var(--font-dm-mono)', fontVariantNumeric: 'tabular-nums' }}>
            1:{avgRR.toFixed(1)}
          </p>
        </div>
        <div>
          <p style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 3 }}>Max DD</p>
          <p style={{ fontSize: 22, fontWeight: 800, color: ddColor, letterSpacing: '-0.02em', lineHeight: 1, fontFamily: 'var(--font-dm-mono)', fontVariantNumeric: 'tabular-nums' }}>
            -{maxDrawdown.toFixed(1)}%
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 9, color: 'var(--text-3)' }}>Risk/Reward</span>
            <span style={{ fontSize: 9, color: rrColor, fontFamily: 'var(--font-dm-mono)' }}>1:{avgRR.toFixed(2)}</span>
          </div>
          <RiskBar value={avgRR} max={4} color={rrColor} />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 9, color: 'var(--text-3)' }}>Drawdown</span>
            <span style={{ fontSize: 9, color: ddColor, fontFamily: 'var(--font-dm-mono)' }}>{maxDrawdown.toFixed(1)}%</span>
          </div>
          <RiskBar value={maxDrawdown} max={30} color={ddColor} />
        </div>
      </div>
    </motion.div>
  )
}

export default memo(RiskCard)
