'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Bot, Trash2, TrendingUp, Search, Edit2, Check, X } from 'lucide-react'
import { BotWithStatus } from '@/types/bot'
import { Profile } from '@/types/profile'
import WatchdogPanel from '@/components/bridge/WatchdogPanel'
import BotControls from '@/components/bots/BotControls'
import BridgeLogPanel from '@/components/bridge/BridgeLogPanel'
import LiveTradeFeed from '@/components/bridge/LiveTradeFeed'
import TradeExecutorPanel from '@/components/bridge/TradeExecutorPanel'
import DiscoverBridgeModal from '@/components/bridge/DiscoverBridgeModal'
import { useBotStatus } from '@/context/BotStatusContext'

interface Props {
  botsWithStatus: BotWithStatus[]
  profiles: Profile[]
  tradesByProfile: Record<string, number>
}

const filterBridge = (list: BotWithStatus[]) => list.filter(b => !b.bot.type || b.bot.type === 'bridge')

export default function BridgeClient({ botsWithStatus: initial, profiles, tradesByProfile }: Props) {
  const { bots: allBots, refresh } = useBotStatus()

  const contextBots = filterBridge(allBots)
  const bots = contextBots.length > 0 ? contextBots : filterBridge(initial)

  const [selectedBotId, setSelectedBotId] = useState<string | null>(filterBridge(initial)[0]?.bot.id ?? null)
  const [showDiscover, setShowDiscover] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [savingName, setSavingName] = useState(false)

  // Auto-select first bot if selected one no longer exists
  useEffect(() => {
    if (bots.length > 0 && !bots.find(b => b.bot.id === selectedBotId)) {
      setSelectedBotId(bots[0].bot.id)
    }
  }, [bots, selectedBotId])

  async function deleteBot(id: string) {
    if (!confirm('Bot wirklich entfernen?')) return
    await fetch(`/api/bots/${id}`, { method: 'DELETE' })
    refresh()
  }

  async function saveBridgeName(id: string) {
    if (!nameInput.trim()) return
    setSavingName(true)
    try {
      // Update in AlphaTrack database
      await fetch(`/api/bots/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameInput.trim() }),
      })
      // Update in bridge config via bridge API
      await fetch('/api/bridge/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bridge_name: nameInput.trim() }),
      })
      setEditingName(false)
      refresh()
    } finally {
      setSavingName(false)
    }
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
          onDiscovered={() => { setShowDiscover(false); refresh() }}
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
              {/* Bridge-Identitaet: ID, Name (editierbar in AT), Verbindungs-URL */}
              <div className="rounded-xl p-4 mb-4 flex flex-wrap items-center gap-4"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Bridge-ID</span>
                  <span className="font-mono text-xs font-semibold" style={{ color: 'var(--text-2)' }}>{selected.bot.id}</span>
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Name</span>
                  {editingName ? (
                    <div className="flex items-center gap-1">
                      <input
                        className="text-xs rounded px-2 py-0.5 border"
                        style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text-1)' }}
                        value={nameInput}
                        onChange={e => setNameInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveBridgeName(selected.bot.id); if (e.key === 'Escape') setEditingName(false) }}
                        autoFocus
                      />
                      <button onClick={() => saveBridgeName(selected.bot.id)} disabled={savingName}
                        className="p-0.5 rounded" style={{ color: 'var(--green)' }}>
                        <Check size={14} />
                      </button>
                      <button onClick={() => setEditingName(false)}
                        className="p-0.5 rounded" style={{ color: '#ef4444' }}>
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold" style={{ color: 'var(--text-1)' }}>{selected.bot.name}</span>
                      <button
                        onClick={() => { setNameInput(selected.bot.name); setEditingName(true) }}
                        className="opacity-40 hover:opacity-80" title="Name aendern (nur in AlphaTrack)">
                        <Edit2 size={11} />
                      </button>
                    </div>
                  )}
                </div>
                {selectedProfile && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Profil</span>
                    <span className="text-xs" style={{ color: 'var(--text-2)' }}>{selectedProfile.name} · {selectedProfile.broker}</span>
                  </div>
                )}
                <div className="flex flex-col gap-0.5 min-w-0 ml-auto">
                  <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Bridge-URL</span>
                  <span className="font-mono text-[11px]" style={{ color: 'var(--text-3)' }}>{selected.bot.url}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <WatchdogPanel botId={selected.bot.id} botName={selected.bot.name} />
                <BotControls
                  botId={selected.bot.id}
                  initialState={selected.status?.state}
                  initialConnection={selected.status?.connectionState}
                />
              </div>

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
