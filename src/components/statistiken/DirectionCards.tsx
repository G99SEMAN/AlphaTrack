'use client'

import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { DirectionStats } from '@/lib/statsExtended'

interface Props {
  long: DirectionStats
  short: DirectionStats
  currency: string
}

function DirCard({ dir, stats, currency, delay }: { dir: 'long' | 'short'; stats: DirectionStats; currency: string; delay: number }) {
  const isLong = dir === 'long'
  const color = isLong ? 'var(--green)' : 'var(--red)'
  const bgColor = isLong ? 'var(--green-bg)' : 'var(--red-bg)'
  const pnlColor = stats.totalPnl >= 0 ? 'var(--green)' : 'var(--red)'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="rounded-2xl p-5 flex flex-col gap-4 h-full"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
          {isLong ? 'Long-Trades' : 'Short-Trades'}
        </p>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: bgColor }}>
          {isLong ? <TrendingUp size={15} style={{ color }} /> : <TrendingDown size={15} style={{ color }} />}
        </div>
      </div>

      {stats.trades === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-3)' }}>Keine Trades</p>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Win Rate Balken */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs" style={{ color: 'var(--text-2)' }}>Win Rate</span>
              <span className="text-sm font-bold font-mono" style={{ color }}>
                {stats.winRate.toFixed(1)}%
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full" style={{ background: 'var(--surface-3)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: color }}
                initial={{ width: 0 }}
                animate={{ width: `${stats.winRate}%` }}
                transition={{ duration: 0.7, delay: delay + 0.2, ease: 'easeOut' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1" style={{ borderTop: '1px solid var(--border)' }}>
            <div>
              <p className="text-xs mb-0.5" style={{ color: 'var(--text-3)' }}>Trades</p>
              <p className="text-base font-bold font-mono" style={{ color: 'var(--text-1)' }}>{stats.trades}</p>
            </div>
            <div>
              <p className="text-xs mb-0.5" style={{ color: 'var(--text-3)' }}>Gesamt P&L</p>
              <p className="text-base font-bold font-mono" style={{ color: pnlColor }}>
                {stats.totalPnl >= 0 ? '+' : ''}{stats.totalPnl.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-xs mb-0.5" style={{ color: 'var(--text-3)' }}>Ø pro Trade</p>
              <p className="text-sm font-semibold font-mono" style={{ color: stats.avgPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {stats.avgPnl >= 0 ? '+' : ''}{stats.avgPnl.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-xs mb-0.5" style={{ color: 'var(--text-3)' }}>Währung</p>
              <p className="text-sm font-semibold font-mono" style={{ color: 'var(--text-2)' }}>{currency}</p>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}

export default function DirectionCards({ long, short, currency }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 h-full">
      <DirCard dir="long" stats={long} currency={currency} delay={0.15} />
      <DirCard dir="short" stats={short} currency={currency} delay={0.2} />
    </div>
  )
}
