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
      className="rounded-2xl h-full"
      style={{
        background: 'var(--surface)', padding: 16,
        border: '1px solid rgba(245,158,11,0.25)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
        position: 'relative', overflow: 'hidden',
      }}
    >
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: 'linear-gradient(90deg,transparent,rgba(245,158,11,0.3),transparent)',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)',
        }}>
          <AlertTriangle size={14} style={{ color: 'var(--amber)' }} />
        </div>
        <div>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)', marginBottom: 1 }}>
            Lange offene Positionen
          </h3>
          <p style={{ fontSize: 10, color: 'var(--text-3)' }}>
            {critical.length} Trade{critical.length !== 1 ? 's' : ''} seit über {CRITICAL_DAYS} Tagen offen
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {critical.map(({ trade: t, days }) => (
          <div
            key={t.id}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '9px 12px', borderRadius: 10,
              background: 'var(--surface-2)',
              borderLeft: `3px solid ${days >= 7 ? 'var(--red)' : 'var(--amber)'}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Clock size={13} style={{ color: days >= 7 ? 'var(--red)' : 'var(--amber)', flexShrink: 0 }} />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>{t.instrument}</span>
                  <span style={{
                    fontSize: 9, padding: '1px 6px', borderRadius: 4, fontWeight: 600,
                    background: t.type === 'long' ? 'rgba(0,217,126,0.10)' : 'rgba(255,69,96,0.10)',
                    border: t.type === 'long' ? '1px solid rgba(0,217,126,0.18)' : '1px solid rgba(255,69,96,0.18)',
                    color: t.type === 'long' ? 'var(--green)' : 'var(--red)',
                  }}>
                    {t.type === 'long' ? 'Long' : 'Short'}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2, fontFamily: 'var(--font-dm-mono)' }}>
                  {new Date(t.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {t.entry !== undefined && <span style={{ marginLeft: 6 }}>@ {t.entry}</span>}
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: days >= 7 ? 'var(--red)' : 'var(--amber)', fontFamily: 'var(--font-dm-mono)' }}>
                {days}d offen
              </div>
              {t.sl !== undefined && (
                <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-dm-mono)' }}>SL: {t.sl}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

export default memo(CriticalOpenTradesCard)
