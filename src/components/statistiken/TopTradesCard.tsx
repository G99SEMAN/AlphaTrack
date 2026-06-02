'use client'

import { motion } from 'framer-motion'
import { Trophy } from 'lucide-react'
import { TopTradeEntry } from '@/lib/statsExtended'

interface Props {
  trades: TopTradeEntry[]
  currency: string
}

export default function TopTradesCard({ trades, currency }: Props) {
  if (trades.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-5 h-full"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--green-bg)' }}
        >
          <Trophy size={16} style={{ color: 'var(--green)' }} />
        </div>
        <h3 className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>
          Beste Trades
        </h3>
      </div>

      <div className="flex flex-col gap-2">
        {trades.map((t, i) => (
          <div
            key={t.id}
            className="flex items-center justify-between p-3 rounded-xl"
            style={{ background: 'var(--surface-2)' }}
          >
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <span
                className="text-xs font-bold w-5 text-center tabular-nums shrink-0"
                style={{ color: 'var(--text-3)' }}
              >
                #{i + 1}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
                    {t.instrument}
                  </span>
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-md font-medium shrink-0"
                    style={{
                      background: t.type === 'long' ? 'var(--green-bg)' : 'var(--red-bg)',
                      color: t.type === 'long' ? 'var(--green)' : 'var(--red)',
                    }}
                  >
                    {t.type === 'long' ? 'Long' : 'Short'}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                  <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                    {new Date(t.date).toLocaleDateString('de-DE', {
                      day: '2-digit',
                      month: 'short',
                      year: '2-digit',
                    })}
                  </span>
                  {t.strategyName && (
                    <span className="text-xs hidden sm:inline" style={{ color: 'var(--text-3)' }}>
                      · {t.strategyName}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div
                className="font-mono font-semibold text-sm"
                style={{ color: 'var(--green)' }}
              >
                +{t.pnl.toLocaleString('de-DE', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                {currency}
              </div>
              {t.rr !== undefined && t.rr > 0 && (
                <div className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-3)' }}>
                  {t.rr.toFixed(2)}R
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
