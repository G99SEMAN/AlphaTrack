'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Trade } from '@/types/trade'
import { currencySymbol } from '@/lib/currency'

interface Props {
  trades: Trade[]
  currency: string
}

const ROWS = 6

export default function RecentTradesCard({ trades, currency }: Props) {
  const [tab, setTab] = useState<'recent' | 'open'>('recent')
  const sym = currencySymbol(currency)

  const recentTrades = useMemo(() =>
    [...trades]
      .filter(t => t.status === 'closed' && t.pnl !== undefined)
      .sort((a, b) => new Date(b.closeTime ?? b.date).getTime() - new Date(a.closeTime ?? a.date).getTime())
      .slice(0, ROWS),
    [trades]
  )

  const openTrades = useMemo(() =>
    trades.filter(t => t.status === 'open'),
    [trades]
  )

  function fmtDate(s: string): string {
    return s.slice(0, 10).split('-').reverse().join('.')
  }

  function fmtPnl(v: number): string {
    return `${v >= 0 ? '+' : ''}${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${sym}`
  }

  return (
    <div
      className="rounded-2xl flex flex-col"
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        boxShadow: 'var(--card-shadow)', overflow: 'hidden',
      }}
    >
      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {(['recent', 'open'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '10px 8px',
              fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              background: 'none', border: 'none', cursor: 'pointer',
              color: tab === t ? 'var(--accent)' : 'var(--text-3)',
              borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
              transition: 'color 0.15s',
              marginBottom: -1,
            }}
          >
            {t === 'recent' ? 'Letzte Trades' : `Offene Pos. (${openTrades.length})`}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1 }}>
        {tab === 'recent' ? (
          recentTrades.length === 0 ? (
            <p style={{ padding: '20px 16px', fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>
              Keine geschlossenen Trades
            </p>
          ) : (
            recentTrades.map(t => {
              const pnl = t.pnl ?? 0
              return (
                <div
                  key={t.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '7px 14px', borderBottom: '1px solid var(--border)',
                  }}
                >
                  <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-dm-mono)', minWidth: 56 }}>
                    {fmtDate(t.closeTime ?? t.date)}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', flex: 1, textAlign: 'center' }}>
                    {t.instrument}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-dm-mono)',
                    color: pnl >= 0 ? 'var(--green)' : 'var(--red)',
                    minWidth: 80, textAlign: 'right',
                  }}>
                    {fmtPnl(pnl)}
                  </span>
                </div>
              )
            })
          )
        ) : (
          openTrades.length === 0 ? (
            <p style={{ padding: '20px 16px', fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>
              Keine offenen Positionen
            </p>
          ) : (
            openTrades.slice(0, ROWS).map(t => {
              const pnl = t.pnl ?? 0
              return (
                <div
                  key={t.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '7px 14px', borderBottom: '1px solid var(--border)',
                  }}
                >
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                    padding: '2px 5px', borderRadius: 4,
                    background: t.type === 'long' ? 'var(--green-bg)' : 'var(--red-bg)',
                    color: t.type === 'long' ? 'var(--green)' : 'var(--red)',
                  }}>
                    {t.type === 'long' ? 'BUY' : 'SELL'}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', flex: 1, textAlign: 'center' }}>
                    {t.instrument}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-dm-mono)',
                    color: pnl >= 0 ? 'var(--green)' : pnl < 0 ? 'var(--red)' : 'var(--text-3)',
                  }}>
                    {t.pnl !== undefined ? fmtPnl(pnl) : '—'}
                  </span>
                </div>
              )
            })
          )
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
        <Link href="/journal" style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
          Alle Trades anzeigen →
        </Link>
      </div>
    </div>
  )
}
