'use client'

import { useMemo, memo } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Clock } from 'lucide-react'
import { Trade } from '@/types/trade'

const CRITICAL_DAYS = 3
const MS_PER_DAY = 86400000

interface Props {
  trades: Trade[]
  currency: string
}

function CriticalOpenTradesCard({ trades, currency }: Props) {
  const critical = useMemo(() => {
    const now = Date.now()
    return trades
      .filter(t => t.status === 'open')
      .map(t => ({ trade: t, days: Math.floor((now - new Date(t.date).getTime()) / MS_PER_DAY) }))
      .filter(({ days }) => days >= CRITICAL_DAYS)
      .sort((a, b) => b.days - a.days)
  }, [trades])

  if (critical.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-5"
      style={{
        background: 'var(--surface)',
        border: '1px solid rgba(245, 158, 11, 0.35)',
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(245, 158, 11, 0.15)' }}
        >
          <AlertTriangle size={16} style={{ color: '#f59e0b' }} />
        </div>
        <div>
          <h3 className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>
            Lange offene Positionen
          </h3>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>
            {critical.length} Trade{critical.length !== 1 ? 's' : ''} seit über {CRITICAL_DAYS} Tagen offen
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {critical.map(({ trade: t, days }) => (
            <div
              key={t.id}
              className="flex items-center justify-between p-3 rounded-xl"
              style={{ background: 'var(--surface-2)' }}
            >
              <div className="flex items-center gap-3">
                <Clock size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
                      {t.instrument}
                    </span>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-md font-medium"
                      style={{
                        background: t.type === 'long' ? 'var(--green-bg)' : 'var(--red-bg)',
                        color: t.type === 'long' ? 'var(--green)' : 'var(--red)',
                      }}
                    >
                      {t.type === 'long' ? 'Long' : 'Short'}
                    </span>
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                    Eröffnet:{' '}
                    {new Date(t.date).toLocaleDateString('de-DE', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                    {t.entry !== undefined && (
                      <span className="ml-1.5 font-mono">@ {t.entry}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div
                  className="font-mono font-bold text-sm"
                  style={{ color: days >= 7 ? 'var(--red)' : '#f59e0b' }}
                >
                  {days}d offen
                </div>
                {t.sl !== undefined && t.entry !== undefined && (
                  <div className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-3)' }}>
                    SL: {t.sl}
                  </div>
                )}
              </div>
            </div>
          ))}
      </div>
    </motion.div>
  )
}

export default memo(CriticalOpenTradesCard)
