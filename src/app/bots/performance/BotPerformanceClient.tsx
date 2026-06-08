'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { BotWithStatus } from '@/types/bot'
import { Trade } from '@/types/trade'
import BotPerfCard from '@/components/bots/BotPerfCard'

interface Props {
  botsWithStatus: BotWithStatus[]
  profileId: string
}

export default function BotPerformanceClient({ botsWithStatus, profileId }: Props) {
  const [trackedBotIds, setTrackedBotIds] = useState<string[]>([])
  const [allBotTrades, setAllBotTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)

  const connectedBots = botsWithStatus.filter(
    bw => bw.status?.connectionState === 'connected' || bw.status?.connectionState === 'warning',
  )

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [trackedRes, tradesRes] = await Promise.all([
      fetch('/api/bots/performance-tracked'),
      fetch(`/api/bridge/trades?profileId=${profileId}`),
    ])
    if (trackedRes.ok) {
      const data = await trackedRes.json() as { trackedBotIds: string[] }
      setTrackedBotIds(data.trackedBotIds)
    }
    if (tradesRes.ok) {
      const data = await tradesRes.json() as { trades: Trade[] }
      setAllBotTrades(data.trades)
    }
    setLoading(false)
  }, [profileId])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleAddBot(botId: string) {
    await fetch('/api/bots/performance-tracked', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botId }),
    })
    setTrackedBotIds(prev => prev.includes(botId) ? prev : [...prev, botId])
    setShowAddModal(false)
  }

  async function handleRemoveBot(botId: string) {
    await fetch(`/api/bots/performance-tracked?botId=${encodeURIComponent(botId)}`, { method: 'DELETE' })
    setTrackedBotIds(prev => prev.filter(id => id !== botId))
  }

  const trackedBots = trackedBotIds
    .map(id => botsWithStatus.find(bw => bw.bot.id === id))
    .filter((bw): bw is BotWithStatus => bw !== undefined)

  return (
    <>
      <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Bot Performance</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>
            Kumulierter P&L und Kennzahlen pro Bot
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          <Plus size={16} />
          Bot hinzufügen
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <p style={{ color: 'var(--text-3)' }}>Lädt…</p>
        </div>
      ) : trackedBots.length === 0 ? (
        <div
          className="rounded-2xl p-10 text-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <p className="font-medium mb-2" style={{ color: 'var(--text-2)' }}>
            Noch keine Bots zur Performance-Messung hinzugefügt
          </p>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>
            Klicke auf "Bot hinzufügen", um einen verbundenen Bot zu überwachen.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {trackedBots.map(bw => (
            <BotPerfCard
              key={bw.bot.id}
              botEntry={bw.bot}
              trades={allBotTrades.filter(t => t.botId === bw.bot.id)}
              onRemove={() => handleRemoveBot(bw.bot.id)}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={e => { if (e.target === e.currentTarget) setShowAddModal(false) }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="rounded-2xl p-6 w-full max-w-sm mx-4"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--card-shadow)',
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-lg" style={{ color: 'var(--text-1)' }}>Bot hinzufügen</h2>
                <button onClick={() => setShowAddModal(false)} aria-label="Schließen">
                  <X size={18} style={{ color: 'var(--text-3)' }} />
                </button>
              </div>

              {connectedBots.length === 0 ? (
                <p className="text-sm py-4 text-center" style={{ color: 'var(--text-3)' }}>
                  Keine verbundenen Bots gefunden.
                </p>
              ) : (
                <div className="flex flex-col gap-2" style={{ maxHeight: 280, overflowY: 'auto' }}>
                  {connectedBots.map(bw => {
                    const alreadyTracked = trackedBotIds.includes(bw.bot.id)
                    return (
                      <button
                        key={bw.bot.id}
                        disabled={alreadyTracked}
                        onClick={() => handleAddBot(bw.bot.id)}
                        className="w-full text-left p-3 rounded-xl"
                        style={{
                          background: 'var(--bg)',
                          border: '1px solid var(--border)',
                          opacity: alreadyTracked ? 0.5 : 1,
                          cursor: alreadyTracked ? 'default' : 'pointer',
                        }}
                      >
                        <p className="font-medium text-sm" style={{ color: 'var(--text-1)' }}>
                          {bw.bot.name}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                          {alreadyTracked
                            ? 'Bereits hinzugefügt'
                            : bw.status?.connectionState === 'connected'
                              ? 'Verbunden'
                              : 'Verbindung schwach'}
                        </p>
                      </button>
                    )
                  })}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
