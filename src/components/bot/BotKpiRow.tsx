'use client'

import { motion } from 'framer-motion'
import { Trade } from '@/types/trade'
import { currencySymbol } from '@/lib/currency'

interface Props {
  trades: Trade[]
  currency: string
}

interface KpiCardProps {
  label: string
  value: string
  color: string
  delay: number
}

function KpiCard({ label, value, color, delay }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="rounded-xl px-4 py-3 flex flex-col gap-1"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{label}</p>
      <p className="text-xl font-bold font-mono leading-tight" style={{ color }}>{value}</p>
    </motion.div>
  )
}

export default function BotKpiRow({ trades, currency }: Props) {
  const closed = trades.filter(t => t.status === 'closed' && t.pnl !== undefined)
  const open = trades.filter(t => t.status === 'open')
  const wins = closed.filter(t => (t.pnl ?? 0) >= 0)
  const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0
  const totalPnl = closed.reduce((s, t) => s + (t.pnl ?? 0), 0)
  const pnlSign = totalPnl >= 0 ? '+' : ''

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <KpiCard
        label="Trades gesamt"
        value={String(trades.length)}
        color="var(--text-1)"
        delay={0}
      />
      <KpiCard
        label="Winrate"
        value={closed.length > 0 ? `${winRate.toFixed(1)}%` : '-'}
        color={winRate >= 50 ? 'var(--green)' : winRate > 0 ? '#f59e0b' : 'var(--text-3)'}
        delay={0.04}
      />
      <KpiCard
        label={`Net PnL (${currencySymbol(currency)})`}
        value={closed.length > 0 ? `${pnlSign}${totalPnl.toLocaleString('de-DE', { minimumFractionDigits: 2 })}` : '-'}
        color={totalPnl >= 0 ? 'var(--green)' : 'var(--red)'}
        delay={0.08}
      />
      <KpiCard
        label="Offene Positionen"
        value={String(open.length)}
        color={open.length > 0 ? '#f59e0b' : 'var(--text-3)'}
        delay={0.12}
      />
    </div>
  )
}
