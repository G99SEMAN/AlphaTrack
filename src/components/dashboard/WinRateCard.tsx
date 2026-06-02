'use client'

import { memo } from 'react'
import { motion } from 'framer-motion'
import { Target, Flame, Snowflake } from 'lucide-react'

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
      className="rounded-2xl p-5 flex flex-col gap-4 h-full"

      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--card-shadow)',
      }}
      whileHover={{ boxShadow: 'var(--card-shadow-hover)', y: -1 }}
      transition={{ duration: 0.15 }}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
          Win Rate
        </p>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--accent-bg)' }}
        >
          <Target size={15} style={{ color: 'var(--accent)' }} />
        </div>
      </div>

      {/* Kreisdiagramm */}
      <div className="flex items-center gap-4">
        <div className="relative w-16 h-16 shrink-0">
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--surface-3)" strokeWidth="3" />
            <motion.circle
              cx="18" cy="18" r="15.9" fill="none"
              stroke="var(--accent)" strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${winRate} ${100 - winRate}`}
              strokeDashoffset="0"
              initial={{ strokeDasharray: '0 100' }}
              animate={{ strokeDasharray: `${winRate} ${100 - winRate}` }}
              transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold font-mono" style={{ color: 'var(--text-1)' }}>
              {winRate.toFixed(0)}%
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-2xl font-bold font-mono leading-none" style={{ color: 'var(--text-1)' }}>
            {winRate.toFixed(1)}%
          </p>
          <p className="text-xs" style={{ color: 'var(--text-2)' }}>
            {totalTrades} Trades geschlossen
          </p>
          {openTrades > 0 && (
            <p className="text-xs" style={{ color: 'var(--accent)' }}>
              {openTrades} offen
            </p>
          )}
        </div>
      </div>

      {/* Streak */}
      <div
        className="flex items-center gap-2 pt-3"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        {isWinStreak
          ? <Flame size={15} style={{ color: 'var(--green)' }} />
          : <Snowflake size={15} style={{ color: 'var(--red)' }} />
        }
        <span className="text-xs" style={{ color: 'var(--text-2)' }}>
          {isWinStreak
            ? `${streakAbs}x Gewinn-Streak`
            : `${streakAbs}x Verlust-Streak`
          }
        </span>
      </div>
    </motion.div>
  )
}

export default memo(WinRateCard)
