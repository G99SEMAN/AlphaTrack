'use client'

import { useMemo, memo } from 'react'
import { motion } from 'framer-motion'
import { Trade } from '@/types/trade'
import { ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react'

interface Props { trades: Trade[] }

function fmt(val: number) {
  const sign = val >= 0 ? '+' : ''
  return `${sign}${val.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`
}

function RecentTradesCard({ trades }: Props) {
  const recent = useMemo(() =>
    [...trades]
      .sort((a, b) => a.date > b.date ? -1 : a.date < b.date ? 1 : 0)
      .slice(0, 5),
    [trades]
  )

  return (
    <motion.div
      className="rounded-2xl p-5 flex flex-col gap-4 h-full"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--card-shadow)',
      }}
      whileHover={{ boxShadow: 'var(--card-shadow-hover)' }}
      transition={{ duration: 0.15 }}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
          Letzte Trades
        </p>
        <span className="text-xs px-2 py-1 rounded-md" style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}>
          {trades.length} gesamt
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {recent.map((trade, i) => {
          const isLong = trade.type === 'long'
          const pnlPos = (trade.pnl ?? 0) >= 0
          const isOpen = trade.status === 'open'

          return (
            <motion.div
              key={trade.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
              style={{ background: 'var(--surface-2)' }}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              {/* Richtungs-Icon */}
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: isLong ? 'var(--green-bg)' : 'var(--red-bg)' }}
              >
                {isLong
                  ? <ArrowUpRight size={14} style={{ color: 'var(--green)' }} />
                  : <ArrowDownRight size={14} style={{ color: 'var(--red)' }} />
                }
              </div>

              {/* Instrument + Datum */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-1)' }}>
                  {trade.instrument}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                  {new Date(trade.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                  {' · '}{trade.type === 'long' ? 'Long' : 'Short'}
                </p>
              </div>

              {/* P&L */}
              <div className="text-right">
                {isOpen ? (
                  <div className="flex items-center gap-1">
                    <Clock size={11} style={{ color: 'var(--accent)' }} />
                    <span className="text-xs font-mono" style={{ color: 'var(--accent)' }}>Offen</span>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-mono font-semibold" style={{ color: pnlPos ? 'var(--green)' : 'var(--red)' }}>
                      {fmt(trade.pnl ?? 0)}
                    </p>
                    {trade.rr && (
                      <p className="text-xs font-mono" style={{ color: 'var(--text-3)' }}>
                        1:{trade.rr.toFixed(1)}
                      </p>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}

export default memo(RecentTradesCard)
