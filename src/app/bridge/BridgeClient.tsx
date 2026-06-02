'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Bot, Trash2, TrendingUp, Search } from 'lucide-react'
import { BotWithStatus } from '@/types/bot'
import { Profile } from '@/types/profile'
import WatchdogPanel from '@/components/bot/WatchdogPanel'
import BotControls from '@/components/bot/BotControls'
import BridgeLogPanel from '@/components/bot/BridgeLogPanel'
import LiveTradeFeed from '@/components/bot/LiveTradeFeed'
import TradeExecutorPanel from '@/components/bot/TradeExecutorPanel'
import DiscoverBridgeModal from '@/components/bridge/DiscoverBridgeModal'

interface Props {
  botsWithStatus: BotWithStatus[]
  profiles: Profile[]
  tradesByProfile: Record<string, number>
}

export default function BridgeClient({ botsWithStatus: initial, profiles, tradesByProfile }: Props) {
  const filterBridge = (list: BotWithStatus[]) => list.filter(b => !b.bot.type || b.bot.type === 'bridge')
  const [bots, setBots] = useState<BotWithStatus[]>(filterBridge(initial))
  const [selectedBotId, setSelectedBotId] = useState<string | null>(filterBridge(initial)[0]?.bot.id ?? null)
  const [showDiscover, setShowDiscover] = useState(false)
  const refreshBots = useCallback(async () => {
    try {
      const res = await fetch('/api/bots')
      if (res.ok) {
        const { bots: rawList } = await res.json()
        const list = (rawList as BotWithStatus['bot'][]).filter(b => !b.type || b.type === 'bridge')
        const withStatus = await Promise.all(
          list.map(async (bot: BotWithStatus['bot']) => {
            try {
              const sr = await fetch(`/api/bridge/status?bridgeId=${bot.id}`)
              if (!sr.ok) return { bot, status: null }
              const { connectionState, status } = await sr.json()
              return { bot, status: status ? { ...status, connectionState } : null }
            } catch { return { bot, status: null } }
          })
        )
        setBots(withStatus)
        if (withStatus.length > 0 && !withStatus.find(b => b.bot.id === selectedBotId)) {
          setSelectedBotId(withStatus[0].bot.id)
        }
      }
    } catch { /* silent */ }
  }, [selectedBotId])

  useEffect(() => {
    const id = setInterval(refreshBots, 6000)
    return () => clearInterval(id)
  }, [refreshBots])

  async function deleteBot(id: string) {
    if (!confirm('Bot wirklich entfernen?')) return
    await fetch(`/api/bots/${id}`, { method: 'DELETE' })
    await refreshBots()
    if (selectedBotId === id) setSelectedBotId(bots.find(b => b.bot.id !== id)?.bot.id ?? null)
  }

  const selected = bots.find(b => b.bot.id === selectedBotId)
  const selectedProfile = selected ? profiles.find(p => p.id === selected.bot.profileId) : null

  return (
    <main className="flex-1 min-w-0 p-4 md:p-6">

      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <Bot size={20} style={{ color: '#ef4444' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Bridge</h1>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>{bots.length} Bot{bots.length !== 1 ? 's' : ''} konfiguriert</p>
          </div>
        </div>
        <button
          onClick={() => setShowDiscover(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all"
          style={{
            background: 'rgba(168,85,247,0.08)',
            border: '1px solid rgba(168,85,247,0.25)',
            color: '#a855f7',
          }}>
          <Search size={13} />Bridge suchen
        </button>
      </div>

      {showDiscover && (
        <DiscoverBridgeModal
          onClose={() => setShowDiscover(false)}
          onDiscovered={() => { setShowDiscover(false); refreshBots() }}
        />
      )}

      {/* Kein Bot konfiguriert */}
      {bots.length === 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-10 flex flex-col items-center text-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(239,68,68,0.1)' }}>
            <Bot size={28} style={{ color: '#ef4444' }} />
          </div>
          <h3 className="text-base font-bold mb-2" style={{ color: 'var(--text-1)' }}>Kein Bot verbunden</h3>
          <p className="text-sm max-w-sm" style={{ color: 'var(--text-3)' }}>
            Starte die Python-Bridge - sie verbindet sich automatisch mit AlphaTrack.
          </p>
        </motion.div>
      )}

      {/* Bot-Liste als Tab-Leiste */}
      {bots.length > 0 && (
        <>
          <div className="flex gap-2 mb-5 flex-wrap">
            {bots.map(({ bot, status }) => {
              const conn = status?.connectionState ?? 'offline'
              const connColor = conn === 'connected' ? 'var(--green)' : conn === 'warning' ? '#f59e0b' : '#ef4444'
              const isActive = selectedBotId === bot.id
              return (
                <button key={bot.id}
                  onClick={() => setSelectedBotId(bot.id)}
                  className="flex items-center gap-2.5 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-all"
                  style={{
                    background: isActive ? 'rgba(239,68,68,0.12)' : 'var(--surface)',
                    border: isActive ? '1px solid rgba(239,68,68,0.4)' : '1px solid var(--border)',
                    color: isActive ? '#ef4444' : 'var(--text-2)',
                  }}>
                  <span className="rounded-full shrink-0" style={{ width: 7, height: 7, background: connColor, boxShadow: `0 0 5px ${connColor}`, display: 'block' }} />
                  {bot.name}
                  <button onClick={e => { e.stopPropagation(); deleteBot(bot.id) }}
                    className="ml-1 opacity-40 hover:opacity-80 cursor-pointer"
                    title="Bot entfernen">
                    <Trash2 size={12} />
                  </button>
                </button>
              )
            })}
          </div>

          {/* Ausgewählter Bot Details */}
          {selected && (
            <>
              {/* Profil-Info */}
              {selectedProfile && (
                <p className="text-xs mb-4" style={{ color: 'var(--text-3)' }}>
                  <TrendingUp size={11} className="inline mr-1" style={{ color: 'var(--text-3)' }} />
                  Profil: <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>{selectedProfile.name}</span>
                  {' · '}{selectedProfile.broker} · {selectedProfile.currency}
                  {' · '}{tradesByProfile[selectedProfile.id] ?? 0} Bot-Trades gespeichert
                  {' · '}Bot-URL: <span className="font-mono">{selected.bot.url}</span>
                </p>
              )}

              {/* Watchdog + Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <WatchdogPanel botId={selected.bot.id} botName={selected.bot.name} />
                <BotControls
                  botId={selected.bot.id}
                  initialState={selected.status?.state}
                  initialConnection={selected.status?.connectionState}
                />
              </div>

              {/* Trade-Executor + Trades + Log */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <TradeExecutorPanel
                  botId={selected.bot.id}
                  connectionState={selected.status?.connectionState}
                  botState={selected.status?.state}
                  activeSymbols={selected.status?.activeSymbols}
                />
                <LiveTradeFeed profileId={selected.bot.profileId} />
                <BridgeLogPanel botId={selected.bot.id} />
              </div>
            </>
          )}
        </>
      )}

    </main>
  )
}
