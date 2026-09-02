'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { TrendingUp, TrendingDown, X, RefreshCw, Activity, Bot } from 'lucide-react'
import { useBotStatus } from '@/context/BotStatusContext'
import { useTradingLock } from '@/context/TradingLockContext'
import { resolveBotLabel } from '@/lib/bot-source'
import { useTranslations } from 'next-intl'

interface LivePosition {
  ticket: number
  date: string
  instrument: string
  type: 'long' | 'short'
  entry: number
  currentPrice: number
  size: number
  sl: number | null
  tp: number | null
  pnl: number
  swap: number
  botId?: string | null
}

export default function LivePositionsWidget() {
  const t = useTranslations('journal.livePositions')
  const { bots } = useBotStatus()
  const { isUnlocked } = useTradingLock()

  const bridge = bots.find(b => (!b.bot.type || b.bot.type === 'bridge') && b.status?.connectionState !== 'offline')
  const bridgeId = bridge?.bot.id ?? null

  const [positions, setPositions] = useState<LivePosition[]>([])
  const [loading, setLoading] = useState(false)
  const [confirmTicket, setConfirmTicket] = useState<number | null>(null)
  const [closingTicket, setClosingTicket] = useState<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchPositions = useCallback(async () => {
    if (!bridgeId) { setPositions([]); return }
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setLoading(true)
    try {
      const res = await fetch(`/api/bridge/positions?bridgeId=${bridgeId}`, { signal: abortRef.current.signal })
      if (res.ok) setPositions((await res.json()).positions ?? [])
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
    } finally { setLoading(false) }
  }, [bridgeId])

  useEffect(() => {
    fetchPositions()
    const id = setInterval(fetchPositions, 5000)
    return () => clearInterval(id)
  }, [fetchPositions])

  async function closePosition(ticket: number) {
    if (!bridgeId) return
    setClosingTicket(ticket)
    setConfirmTicket(null)
    try {
      await fetch('/api/bridge/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bridgeId, command: 'close_position', payload: { ticket } }),
      })
      await fetchPositions()
    } catch { /* silent */ }
    setClosingTicket(null)
  }

  const totalPnl = positions.reduce((s, p) => s + p.pnl, 0)

  return (
    <div className="mb-5 rounded-2xl overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <span className="rounded-full block shrink-0"
            style={{
              width: 7, height: 7,
              background: bridgeId ? 'var(--green)' : '#64748b',
              boxShadow: bridgeId ? '0 0 5px var(--green)' : 'none',
            }} />
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>
            {t('title')}
          </p>
          {positions.length > 0 && (
            <span className="text-xs font-mono px-1.5 py-0.5 rounded"
              style={{ background: 'var(--bg)', color: 'var(--text-3)' }}>
              {positions.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {positions.length > 0 && (
            <p className="text-xs font-black font-mono"
              style={{ color: totalPnl >= 0 ? 'var(--green)' : '#ef4444' }}>
              {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}
            </p>
          )}
          <button onClick={fetchPositions} disabled={loading}
            className="opacity-50 hover:opacity-100 transition-opacity cursor-pointer"
            style={{ color: 'var(--text-3)' }}>
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Inhalt */}
      {positions.length === 0 ? (
        <div className="flex items-center gap-2 px-4 py-3">
          <Activity size={13} style={{ color: 'var(--text-3)', opacity: 0.5 }} />
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>
            {bridgeId ? t('noPositions') : t('noBridge')}
          </p>
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {positions.map(pos => {
            const isLong = pos.type === 'long'
            const pnlPos = pos.pnl >= 0
            const pnlColor = pnlPos ? 'var(--green)' : '#ef4444'
            const isConfirming = confirmTicket === pos.ticket
            const isClosing = closingTicket === pos.ticket
            const botLabel = resolveBotLabel(pos.botId, bots.map(b => ({ id: b.bot.id, name: b.bot.name })))

            return (
              <div key={pos.ticket}
                className="flex items-center gap-3 px-4 py-2.5 text-xs"
                style={{ background: pnlPos ? 'rgba(0,217,126,0.02)' : 'rgba(239,68,68,0.02)' }}>

                {/* Richtung */}
                <div className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center"
                  style={{ background: isLong ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)' }}>
                  {isLong
                    ? <TrendingUp size={11} style={{ color: '#22c55e' }} />
                    : <TrendingDown size={11} style={{ color: '#ef4444' }} />}
                </div>

                {/* Instrument + Typ */}
                <span className="font-black font-mono w-20 shrink-0" style={{ color: 'var(--text-1)' }}>
                  {pos.instrument}
                </span>
                {botLabel && (
                  <span
                    className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold shrink-0 max-w-32 truncate"
                    style={{ background: 'rgba(59,130,246,0.12)', color: 'var(--accent)', border: '1px solid rgba(59,130,246,0.25)' }}
                    title={`Quelle: ${botLabel}`}
                  >
                    <Bot size={10} className="shrink-0" />
                    {botLabel}
                  </span>
                )}
                <span className="font-semibold shrink-0"
                  style={{ color: isLong ? '#22c55e' : '#ef4444' }}>
                  {isLong ? 'LONG' : 'SHORT'}
                </span>
                <span style={{ color: 'var(--text-3)' }}>{pos.size}L</span>

                {/* Preise */}
                <span className="hidden sm:block font-mono" style={{ color: 'var(--text-3)' }}>
                  {pos.entry.toFixed(5)}
                </span>
                <span className="hidden sm:block font-mono font-bold" style={{ color: pnlColor }}>
                  {pos.currentPrice.toFixed(5)}
                </span>

                {/* P&L */}
                <span className="font-black font-mono ml-auto" style={{ color: pnlColor }}>
                  {pnlPos ? '+' : ''}{pos.pnl.toFixed(2)}
                </span>

                {/* Close */}
                {isClosing ? (
                  <RefreshCw size={12} className="animate-spin shrink-0" style={{ color: 'var(--text-3)' }} />
                ) : isConfirming ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => closePosition(pos.ticket)}
                      disabled={!isUnlocked}
                      className="px-2 py-1 rounded text-xs font-black cursor-pointer"
                      style={{ background: '#ef4444', color: '#fff' }}>
                      OK
                    </button>
                    <button
                      onClick={() => setConfirmTicket(null)}
                      className="px-2 py-1 rounded text-xs cursor-pointer"
                      style={{ background: 'var(--bg)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmTicket(pos.ticket)}
                    disabled={!isUnlocked}
                    title={!isUnlocked ? t('closeTooltipDisabled') : t('closeTooltipEnabled')}
                    className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md cursor-pointer transition-all disabled:opacity-30"
                    style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <X size={11} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
