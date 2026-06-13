'use client'

import { memo } from 'react'
import { motion } from 'framer-motion'
import { Flame, Snowflake } from 'lucide-react'

interface Props {
  winRate: number
  totalTrades: number
  openTrades: number
  currentStreak: number
}

function WinRateCard({ winRate, totalTrades, openTrades, currentStreak }: Props) {
  const isWinStreak = currentStreak > 0
  const streakAbs = Math.abs(currentStreak)

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
        Win Rate
      </p>

      <motion.p
        style={{
          fontSize: 28, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.03em', lineHeight: 1,
          fontFamily: 'var(--font-dm-mono)', fontVariantNumeric: 'tabular-nums', marginBottom: 6,
        }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        {winRate.toFixed(1)}%
      </motion.p>

      <p style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 12 }}>
        {totalTrades} Trades{openTrades > 0 ? ` · ${openTrades} offen` : ''}
      </p>

      <div style={{ paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 'auto' }}>
        {isWinStreak
          ? <Flame size={13} style={{ color: 'var(--green)', flexShrink: 0 }} />
          : <Snowflake size={13} style={{ color: 'var(--red)', flexShrink: 0 }} />
        }
        <span style={{ fontSize: 11, color: 'var(--text-2)' }}>
          {isWinStreak ? `${streakAbs}× Gewinn-Streak` : `${streakAbs}× Verlust-Streak`}
        </span>
      </div>
    </motion.div>
  )
}

export default memo(WinRateCard)
