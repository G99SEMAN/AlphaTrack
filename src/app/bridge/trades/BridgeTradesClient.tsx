'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity, TrendingUp, TrendingDown, X, AlertTriangle,
  Clock, Layers, RefreshCw
} from 'lucide-react'
import { BotEntry } from '@/types/bot'
import { useTradingLock } from '@/context/TradingLockContext'

const BOT_COLORS = ['#3b82f6', '#a855f7', '#f59e0b', '#06b6d4', '#ec4899', '#84cc16']

function getBotColor(botId: string | undefined, bots: BotEntry[]): string {
  if (!botId) return '#6b7280'
  const idx = bots.findIndex(b => b.id === botId)
  return BOT_COLORS[(idx >= 0 ? idx : 0) % BOT_COLORS.length]
}

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
  botId?: string
  botName?: string
}

interface Props {
  bots: BotEntry[]
  strategyBots: BotEntry[]
}

export default function BridgeTradesClient({ bots, strategyBots }: Props) {
  const { isUnlocked } = useTradingLock()
  const [selectedBotIds, setSelectedBotIds] = useState<Set<string>>(
    new Set(bots.map(b => b.id))
  )
  const [positions, setPositions] = useState<LivePosition[]>([])
  const [loadingPositions, setLoadingPositions] = useState(false)
  const [closeTarget, setCloseTarget] = useState<LivePosition | null>(null)
  const [closingTicket, setClosingTicket] = useState<number | null>(null)
  const [closeResult, setCloseResult] = useState<{ success: boolean; msg: string } | null>(null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const allSelected = selectedBotIds.size === bots.length

  function toggleBot(id: string) {
    setSelectedBotIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        if (next.size === 1) return prev // mindestens einer muss aktiv bleiben
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function selectAll() {
    setSelectedBotIds(new Set(bots.map(b => b.id)))
  }

  const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0)

  function calcRMultiple(pos: LivePosition): string | null {
    if (!pos.sl || pos.sl === 0) return null
    const risk = Math.abs(pos.entry - pos.sl)
    if (risk === 0) return null
    const gain = pos.type === 'long' ? pos.currentPrice - pos.entry : pos.entry - pos.currentPrice
    const r = gain / risk
    return `${r >= 0 ? '+' : ''}${r.toFixed(2)}R`
  }

  const fetchPositions = useCallback(async () => {
    if (selectedBotIds.size === 0) return
    setLoadingPositions(true)
    try {
      const results = await Promise.all(
        [...selectedBotIds].map(async (bridgeId) => {
          const bridge = bots.find(b => b.id === bridgeId)
          const res = await fetch(`/api/bridge/positions?bridgeId=${bridgeId}`)
          if (!res.ok) return []
          const data = await res.json()
          return (data.positions ?? []).map((p: LivePosition) => {
            const strategyBot = p.botId ? strategyBots.find(b => b.id === p.botId) : undefined
            return {
              ...p,
              botId: p.botId ?? bridgeId,
              botName: strategyBot?.name ?? bridge?.name ?? bridgeId,
            }
          })
        })
      )
      setPositions(results.flat())
    } catch { /* silent */ }
    finally { setLoadingPositions(false) }
  }, [selectedBotIds, bots, strategyBots])

  useEffect(() => {
    fetchPositions()
    const id = setInterval(fetchPositions, 5000)
    return () => clearInterval(id)
  }, [fetchPositions])

  async function confirmClose() {
    if (!closeTarget) return
    const bridgeId = closeTarget.botId ?? [...selectedBotIds][0]
    setClosingTicket(closeTarget.ticket)
    setCloseTarget(null)
    try {
      const res = await fetch('/api/bridge/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bridgeId,
          command: 'close_position',
          payload: { ticket: closeTarget.ticket },
        }),
      })
      const data = await res.json()
      const success = data.result?.success ?? data.success ?? res.ok
      setCloseResult({
        success,
        msg: success
          ? `Position #${closeTarget.ticket} geschlossen`
          : (data.result?.error ?? data.error ?? 'Fehler beim Schließen'),
      })
      if (data.success) await fetchPositions()
    } catch {
      setCloseResult({ success: false, msg: 'Netzwerkfehler' })
    }
    setClosingTicket(null)
    setTimeout(() => setCloseResult(null), 5000)
  }

  function formatDuration(openDate: string): string {
    const opened = new Date(openDate).getTime()
    if (isNaN(opened)) return '-'
    const sec = Math.floor((now - opened) / 1000)
    if (sec < 0) return '-'
    if (sec < 60) return `${sec}s`
    if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`
    return `${Math.floor(sec / 86400)}d ${Math.floor((sec % 86400) / 3600)}h`
  }

  return (
    <main className="flex-1 min-w-0 p-4 md:p-6">

      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <Activity size={20} style={{ color: '#ef4444' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Live Trades</h1>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>
            Aktive offene Positionen in Echtzeit
          </p>
        </div>
      </div>

      {/* Filter */}
      {bots.length > 1 && (
        <div className="flex gap-2 mb-5 flex-wrap items-center">
          <span className="text-xs font-semibold uppercase tracking-wider mr-1" style={{ color: 'var(--text-3)' }}>
            Filter
          </span>
          <button onClick={selectAll}
            className="px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-all"
            style={{
              background: allSelected ? 'rgba(239,68,68,0.12)' : 'var(--surface)',
              border: allSelected ? '1px solid rgba(239,68,68,0.4)' : '1px solid var(--border)',
              color: allSelected ? '#ef4444' : 'var(--text-2)',
            }}>
            Alle
          </button>
          {bots.map((bot, i) => {
            const active = selectedBotIds.has(bot.id)
            const dotColor = BOT_COLORS[i % BOT_COLORS.length]
            return (
              <button key={bot.id} onClick={() => toggleBot(bot.id)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-all"
                style={{
                  background: active ? `${dotColor}18` : 'var(--surface)',
                  border: active ? `1px solid ${dotColor}66` : '1px solid var(--border)',
                  color: active ? dotColor : 'var(--text-2)',
                }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dotColor }} />
                {bot.name}
              </button>
            )
          })}
        </div>
      )}

      {bots.length === 0 ? (
        <div className="rounded-2xl p-10 flex flex-col items-center text-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <Activity size={28} style={{ color: 'var(--text-3)', marginBottom: 12 }} />
          <p className="text-sm font-bold mb-1" style={{ color: 'var(--text-1)' }}>Bridge nicht verbunden</p>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>Die Bridge läuft nicht oder hat seit über 2 Minuten keinen Heartbeat gesendet.</p>
        </div>
      ) : (
        <>
          <div className="mb-5 rounded-2xl px-5 py-4 flex items-center gap-6"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-3)' }}>Positionen</p>
                <p className="text-2xl font-black font-mono" style={{ color: 'var(--text-1)' }}>{positions.length}</p>
              </div>
              <div className="w-px self-stretch" style={{ background: 'var(--border)' }} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-3)' }}>Gesamt P&L</p>
                <p className="text-2xl font-black font-mono" style={{ color: totalPnl >= 0 ? '#22c55e' : '#ef4444' }}>
                  {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <button onClick={fetchPositions} disabled={loadingPositions}
                  className="flex items-center gap-1.5 text-xs cursor-pointer opacity-60 hover:opacity-100 transition-opacity"
                  style={{ color: 'var(--text-3)' }}>
                  <RefreshCw size={12} className={loadingPositions ? 'animate-spin' : ''} />
                  Live (5s)
                </button>
              </div>
            </div>

          <section className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
                Offene Positionen
                <span className="ml-2 px-1.5 py-0.5 rounded text-xs font-mono"
                  style={{ background: 'var(--surface)', color: 'var(--text-3)' }}>
                  {positions.length}
                </span>
              </h2>
              {positions.length === 0 && (
                <button onClick={fetchPositions} disabled={loadingPositions}
                  className="flex items-center gap-1.5 text-xs cursor-pointer opacity-60 hover:opacity-100 transition-opacity"
                  style={{ color: 'var(--text-3)' }}>
                  <RefreshCw size={12} className={loadingPositions ? 'animate-spin' : ''} />
                  Live (5s)
                </button>
              )}
            </div>

            {positions.length === 0 ? (
              <div className="rounded-2xl px-6 py-12 flex flex-col items-center text-center"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <Layers size={28} style={{ color: 'var(--text-3)', marginBottom: 10 }} />
                <p className="text-sm font-bold mb-1" style={{ color: 'var(--text-2)' }}>Keine offenen Positionen</p>
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>Die ausgewählten Bots haben aktuell keine aktiven Trades.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                {positions.map(pos => {
                  const isLong = pos.type === 'long'
                  const pnlPositive = pos.pnl >= 0
                  const pnlColor = pnlPositive ? '#22c55e' : '#ef4444'
                  const pnlTint = pnlPositive ? 'rgba(34,197,94,0.04)' : 'rgba(239,68,68,0.04)'
                  const isClosing = closingTicket === pos.ticket
                  const rMultiple = calcRMultiple(pos)
                  const botColor = getBotColor(pos.botId, strategyBots)
                  const openedAt = pos.date
                    ? new Date(pos.date).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                    : null

                  return (
                    <motion.div key={`${pos.botId}-${pos.ticket}`}
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl p-4"
                      style={{ background: pnlTint, border: `1px solid var(--border)` }}>

                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: isLong ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)' }}>
                            {isLong
                              ? <TrendingUp size={14} style={{ color: '#22c55e' }} />
                              : <TrendingDown size={14} style={{ color: '#ef4444' }} />}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-black font-mono" style={{ color: 'var(--text-1)' }}>
                                {pos.instrument}
                              </p>
                              {pos.botId && strategyBots.some(b => b.id === pos.botId) && (
                                <span
                                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0"
                                  style={{
                                    background: `${botColor}18`,
                                    border: `1px solid ${botColor}66`,
                                    color: botColor,
                                  }}>
                                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: botColor }} />
                                  {pos.botName}
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-semibold" style={{ color: isLong ? '#22c55e' : '#ef4444' }}>
                              {isLong ? 'LONG' : 'SHORT'} · {pos.size} Lot
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text-3)' }}>P&L</p>
                          <p className="text-base font-black font-mono" style={{ color: pnlColor }}>
                            {pnlPositive ? '+' : ''}{pos.pnl.toFixed(2)}
                          </p>
                          {rMultiple && (
                            <p className="text-xs font-mono font-bold mt-0.5" style={{ color: pnlColor, opacity: 0.8 }}>
                              {rMultiple}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                        <div className="rounded-lg px-3 py-2" style={{ background: 'var(--bg)' }}>
                          <p className="font-semibold mb-0.5" style={{ color: 'var(--text-3)' }}>Entry</p>
                          <p className="font-mono font-bold" style={{ color: 'var(--text-1)' }}>
                            {pos.entry.toFixed(5)}
                          </p>
                        </div>
                        <div className="rounded-lg px-3 py-2" style={{ background: 'var(--bg)' }}>
                          <p className="font-semibold mb-0.5" style={{ color: 'var(--text-3)' }}>Aktuell</p>
                          <p className="font-mono font-bold" style={{ color: pnlColor }}>
                            {pos.currentPrice.toFixed(5)}
                          </p>
                        </div>
                        {pos.sl ? (
                          <div className="rounded-lg px-3 py-2" style={{ background: 'var(--bg)' }}>
                            <p className="font-semibold mb-0.5" style={{ color: 'var(--text-3)' }}>Stop-Loss</p>
                            <p className="font-mono font-bold" style={{ color: '#f87171' }}>
                              {pos.sl.toFixed(5)}
                            </p>
                          </div>
                        ) : null}
                        {pos.tp ? (
                          <div className="rounded-lg px-3 py-2" style={{ background: 'var(--bg)' }}>
                            <p className="font-semibold mb-0.5" style={{ color: 'var(--text-3)' }}>Take-Profit</p>
                            <p className="font-mono font-bold" style={{ color: '#4ade80' }}>
                              {pos.tp.toFixed(5)}
                            </p>
                          </div>
                        ) : null}
                      </div>

                      {pos.swap !== 0 && (
                        <div className="rounded-lg px-3 py-2 mb-3 flex items-center justify-between text-xs"
                          style={{ background: 'var(--bg)' }}>
                          <span className="font-semibold" style={{ color: 'var(--text-3)' }}>Swap</span>
                          <span className="font-mono font-bold"
                            style={{ color: pos.swap >= 0 ? '#22c55e' : '#f87171' }}>
                            {pos.swap >= 0 ? '+' : ''}{pos.swap.toFixed(2)}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                          {openedAt && (
                            <p className="text-xs font-mono" style={{ color: 'var(--text-3)' }}>
                              Eröffnet {openedAt}
                            </p>
                          )}
                          <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-3)' }}>
                            <Clock size={10} />
                            <span>{formatDuration(pos.date)}</span>
                            <span className="text-xs font-mono" style={{ color: 'var(--text-3)', opacity: 0.5 }}>
                              · #{pos.ticket}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => setCloseTarget(pos)}
                          disabled={isClosing || !isUnlocked}
                          title={!isUnlocked ? 'Trading-Schutzschalter aktivieren' : undefined}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all disabled:opacity-40"
                          style={{
                            background: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.3)',
                            color: '#ef4444',
                          }}>
                          {isClosing ? <RefreshCw size={11} className="animate-spin" /> : <X size={11} />}
                          {isClosing ? 'Schließt...' : 'Schließen'}
                        </button>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </section>

          <AnimatePresence>
            {closeResult && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mb-4 px-4 py-3 rounded-xl flex items-center gap-3"
                style={{
                  background: closeResult.success ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                  border: `1px solid ${closeResult.success ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                }}>
                <span style={{ color: closeResult.success ? '#22c55e' : '#ef4444' }} className="text-sm font-bold">
                  {closeResult.msg}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      <AnimatePresence>
        {closeTarget && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.7)' }}
              onClick={() => setCloseTarget(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed z-50 inset-0 flex items-center justify-center p-4"
              onClick={e => e.stopPropagation()}>
              <div className="rounded-2xl p-6 w-full max-w-sm"
                style={{ background: 'var(--surface)', border: '1px solid rgba(239,68,68,0.4)' }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(239,68,68,0.12)' }}>
                    <AlertTriangle size={18} style={{ color: '#ef4444' }} />
                  </div>
                  <div>
                    <p className="text-sm font-black" style={{ color: 'var(--text-1)' }}>Position schließen?</p>
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>Diese Aktion kann nicht rückgängig gemacht werden.</p>
                  </div>
                </div>
                <div className="rounded-xl p-3 mb-5 text-xs font-mono"
                  style={{ background: 'var(--bg)', color: 'var(--text-2)' }}>
                  <span style={{ color: closeTarget.type === 'long' ? '#22c55e' : '#ef4444' }}>
                    {closeTarget.type === 'long' ? 'LONG' : 'SHORT'}
                  </span>
                  {' '}{closeTarget.size} {closeTarget.instrument}
                  {' · '}Entry {closeTarget.entry.toFixed(5)}
                  {' · '}PnL <span style={{ color: closeTarget.pnl >= 0 ? '#22c55e' : '#ef4444' }}>
                    {closeTarget.pnl >= 0 ? '+' : ''}{closeTarget.pnl.toFixed(2)}
                  </span>
                  {closeTarget.botName && (
                    <span style={{ color: 'var(--text-3)' }}> · {closeTarget.botName}</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setCloseTarget(null)}
                    className="py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                    Abbrechen
                  </button>
                  <button onClick={confirmClose}
                    disabled={!isUnlocked}
                    className="py-2.5 rounded-xl text-sm font-black cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: '#ef4444', color: '#fff' }}>
                    Schließen
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </main>
  )
}
