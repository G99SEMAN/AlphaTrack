'use client'

import { useMemo, memo } from 'react'
import { motion } from 'framer-motion'
import { Trade } from '@/types/trade'
import { BotEntry } from '@/types/bot'
import { ArrowUpRight, ArrowDownRight, Bot } from 'lucide-react'

interface Props { trades: Trade[]; bots?: BotEntry[] }

function RecentTradesCard({ trades, bots = [] }: Props) {
  const botNames = useMemo(() => new Map(bots.map(b => [b.id, b.name])), [bots])

  function resolveSourceLabel(trade: Trade): string | null {
    const sid = trade.sourceId ?? trade.botId
    if (!sid) return null
    if (sid === 'bridge/tradeexecuter') return 'Bridge'
    return botNames.get(sid) ?? 'Bot'
  }

  const recent = useMemo(() =>
    trades
      .filter(t => t.status === 'closed')
      .sort((a, b) => {
        const aClose = a.closeTime ?? a.date
        const bClose = b.closeTime ?? b.date
        return aClose > bClose ? -1 : aClose < bClose ? 1 : 0
      })
      .slice(0, 5),
    [trades]
  )

  return (
    <motion.div
      className="rounded-2xl flex flex-col h-full"
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        boxShadow: 'var(--card-shadow)', padding: 16,
        position: 'relative', overflow: 'hidden',
      }}
      whileHover={{ boxShadow: 'var(--card-shadow-hover)' }}
      transition={{ duration: 0.15 }}
    >
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: 'linear-gradient(90deg,transparent,rgba(59,130,246,0.15),transparent)',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <p style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.16em' }}>
          Letzte Trades
        </p>
        <span style={{
          fontSize: 9, padding: '2px 7px', borderRadius: 5,
          background: 'var(--surface-2)', color: 'var(--text-3)',
          fontFamily: 'var(--font-dm-mono)',
        }}>
          {trades.filter(t => t.status === 'closed').length} geschlossen
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {recent.map((trade, i) => {
          const isLong = trade.type === 'long'
          const pnlPos = (trade.pnl ?? 0) >= 0
          const sourceLabel = resolveSourceLabel(trade)
          const displayDate = trade.closeTime ? new Date(trade.closeTime) : new Date(trade.date)

          return (
            <motion.div
              key={trade.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 10,
                background: 'var(--surface-2)', border: '1px solid var(--border-subtle)',
              }}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <div style={{
                width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isLong ? 'rgba(0,217,126,0.10)' : 'rgba(255,69,96,0.10)',
                border: isLong ? '1px solid rgba(0,217,126,0.18)' : '1px solid rgba(255,69,96,0.18)',
              }}>
                {isLong
                  ? <ArrowUpRight size={13} style={{ color: 'var(--green)' }} />
                  : <ArrowDownRight size={13} style={{ color: 'var(--red)' }} />
                }
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {trade.instrument}
                  </p>
                  {sourceLabel && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      fontSize: 8, fontWeight: 600, padding: '1px 5px', borderRadius: 4,
                      background: 'rgba(59,130,246,0.10)', color: 'var(--accent)',
                    }}>
                      <Bot size={8} />
                      {sourceLabel}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--font-dm-mono)' }}>
                  {displayDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                  {' '}{displayDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                  {' · '}{isLong ? 'Long' : 'Short'}
                </p>
              </div>

              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: pnlPos ? 'var(--green)' : 'var(--red)', fontFamily: 'var(--font-dm-mono)', fontVariantNumeric: 'tabular-nums' }}>
                  {(trade.pnl ?? 0) >= 0 ? '+' : ''}{(trade.pnl ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
                </p>
                {trade.rr && (
                  <p style={{ fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--font-dm-mono)' }}>1:{trade.rr.toFixed(1)}</p>
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
