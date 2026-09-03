'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Activity, TrendingUp, TrendingDown, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { Trade } from '@/types/trade'
import { BotEntry } from '@/types/bot'
import { useTranslations } from 'next-intl'

interface Props {
  profileId: string
  bots?: BotEntry[]
  initialTrades?: Trade[]
}

export default function LiveTradeFeed({ profileId, bots = [], initialTrades = [] }: Props) {
  const t = useTranslations('bridge.tradeFeed')
  const botNames = new Map(bots.map(b => [b.id, b.name]))

  function resolveSourceLabel(trade: Trade): string | null {
    if (!trade.sourceId && !trade.botId) return null
    const sid = trade.sourceId ?? trade.botId
    if (sid === 'bridge/tradeexecuter') return 'Bridge'
    return botNames.get(sid!) ?? t('botFallback')
  }
  const [trades, setTrades] = useState<Trade[]>(initialTrades)

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch(`/api/bridge/trades?profileId=${encodeURIComponent(profileId)}`)
      if (res.ok) {
        const data = await res.json()
        setTrades(data.trades ?? [])
      }
    } catch { /* silent */ }
  }, [profileId])

  useEffect(() => {
    fetch_()
    const id = setInterval(fetch_, 10_000)
    return () => clearInterval(id)
  }, [fetch_])

  // Letzte 8 Trades: nach zuletzt-aktiv sortiert (closeTime für geschlossene, date für offene)
  const recent = [...trades]
    .sort((a, b) => {
      const tA = new Date(a.closeTime ?? a.date).getTime()
      const tB = new Date(b.closeTime ?? b.date).getTime()
      return tB - tA
    })
    .slice(0, 8)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 }}
      className="rounded-2xl flex flex-col"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', minHeight: 280 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-5 pt-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <Activity size={14} style={{ color: 'var(--text-3)' }} />
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
          {t('heading')}
        </p>
        <Link href="/bridge/trades"
          className="ml-auto flex items-center gap-1 text-xs font-semibold cursor-pointer transition-opacity hover:opacity-80"
          style={{ color: '#ef4444' }}>
          {t('allTradesLink')}
          <ExternalLink size={11} />
        </Link>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto" style={{ maxHeight: 340 }}>
        {recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-28">
            <Activity size={22} style={{ color: 'var(--text-3)', marginBottom: 8 }} />
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>{t('noTrades')}</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {recent.map((trade, i) => {
              const isLong = trade.type === 'long'
              const isOpen = trade.status === 'open'
              const pnl = trade.pnl ?? 0
              const sourceLabel = resolveSourceLabel(trade)
              const time = new Date(trade.date).toLocaleString('de-DE', {
                day: '2-digit', month: '2-digit',
                hour: '2-digit', minute: '2-digit',
              })

              return (
                <div key={trade.id} className="flex items-center gap-3 px-5 py-2.5"
                  style={i > 0 ? { borderTop: '1px solid var(--border)' } : undefined}>
                  <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                    style={{ background: isLong ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)' }}>
                    {isLong
                      ? <TrendingUp size={11} style={{ color: '#22c55e' }} />
                      : <TrendingDown size={11} style={{ color: '#ef4444' }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold font-mono" style={{ color: 'var(--text-1)' }}>
                        {trade.instrument}
                      </span>
                      <span className="text-xs px-1 rounded font-semibold leading-none py-0.5"
                        style={{
                          background: isOpen ? 'rgba(245,158,11,0.1)' : 'var(--bg)',
                          color: isOpen ? '#f59e0b' : 'var(--text-3)',
                        }}>
                        {isOpen ? t('statusOpen') : t('statusClosed')}
                      </span>
                      {sourceLabel && (
                        <span className="text-xs px-1.5 rounded font-medium leading-none py-0.5"
                          style={{ background: 'var(--bg)', color: 'var(--text-3)' }}>
                          {sourceLabel}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-3)' }}>
                      {time} · {trade.size} Lot
                    </p>
                  </div>
                  <span className="text-xs font-bold font-mono shrink-0"
                    style={{ color: isOpen ? '#f59e0b' : pnl >= 0 ? '#22c55e' : '#ef4444' }}>
                    {isOpen ? '---' : `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}`}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </motion.div>
  )
}
