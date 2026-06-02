'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, Search, Pencil, Trash2, Check, X, ExternalLink, Wifi, WifiOff } from 'lucide-react'
import { BotWithStatus } from '@/types/bot'
import { Profile } from '@/types/profile'
import DiscoverBridgeModal from '@/components/bridge/DiscoverBridgeModal'

interface Props {
  initialBots: BotWithStatus[]
  profiles: Profile[]
}

interface EditState {
  id: string
  name: string
  url: string
}

export default function BotsSettingsClient({ initialBots, profiles }: Props) {
  const filterBots = (list: BotWithStatus[]) => list.filter(b => b.bot.type === 'bot')
  const [bots, setBots] = useState<BotWithStatus[]>(filterBots(initialBots))
  const [showDiscover, setShowDiscover] = useState(false)
  const [editing, setEditing] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/bridge/status')
      if (res.ok) {
        const { bots: list } = await res.json()
        setBots(filterBots(list))
      }
    } catch { /* silent */ }
  }, [])

  function startEdit(id: string, name: string, url: string) {
    setError(null)
    setEditing({ id, name, url })
  }

  async function saveEdit() {
    if (!editing) return
    if (!editing.name.trim() || !editing.url.trim()) {
      setError('Name und URL sind Pflichtfelder.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/bots/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editing.name.trim(), url: editing.url.trim() }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Fehler beim Speichern')
        return
      }
      await refresh()
      setEditing(null)
    } catch {
      setError('Netzwerkfehler')
    } finally {
      setSaving(false)
    }
  }

  async function deleteBot(id: string, name: string) {
    if (!confirm(`Bot "${name}" wirklich entfernen?`)) return
    setDeleting(id)
    try {
      await fetch(`/api/bots/${id}`, { method: 'DELETE' })
      await refresh()
    } catch { /* silent */ }
    finally { setDeleting(null) }
  }

  return (
    <main className="flex-1 min-w-0 p-4 md:p-6">

      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Bot Einstellungen</h1>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>Bots verwalten, umbenennen und entfernen</p>
        </div>
        <button
          onClick={() => setShowDiscover(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all"
          style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', color: 'var(--accent)' }}>
          <Search size={13} /> Bot hinzufügen
        </button>
      </div>

      {showDiscover && (
        <DiscoverBridgeModal
          onClose={() => setShowDiscover(false)}
          onDiscovered={() => { setShowDiscover(false); refresh() }}
        />
      )}

      {/* Leer-Zustand */}
      {bots.length === 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-12 flex flex-col items-center text-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'var(--accent-bg)' }}>
            <Bot size={26} style={{ color: 'var(--accent)' }} />
          </div>
          <h3 className="font-semibold text-lg mb-2" style={{ color: 'var(--text-1)' }}>Noch keine Bots</h3>
          <p className="text-sm max-w-sm mb-5" style={{ color: 'var(--text-3)' }}>
            Füge deinen ersten Bot über "Bot hinzufügen" hinzu.
          </p>
          <button onClick={() => setShowDiscover(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold cursor-pointer"
            style={{ background: 'var(--accent)', color: '#fff' }}>
            <Search size={14} /> Bot hinzufügen
          </button>
        </motion.div>
      )}

      {/* Bot-Liste */}
      {bots.length > 0 && (
        <div className="flex flex-col gap-3">
          {bots.map(({ bot, status }) => {
            const profile = profiles.find(p => p.id === bot.profileId)
            const conn = status?.connectionState
            const isEditing = editing?.id === bot.id

            return (
              <motion.div key={bot.id} layout
                className="rounded-2xl p-4"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

                <AnimatePresence mode="wait">
                  {isEditing ? (
                    <motion.div key="edit"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="flex flex-col gap-3">

                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
                        Bot bearbeiten
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-3)' }}>Name</label>
                          <input
                            value={editing.name}
                            onChange={e => setEditing(prev => prev ? { ...prev, name: e.target.value } : prev)}
                            className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
                            autoFocus
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-3)' }}>URL (Command-Server)</label>
                          <input
                            value={editing.url}
                            onChange={e => setEditing(prev => prev ? { ...prev, url: e.target.value } : prev)}
                            className="w-full px-3 py-2 rounded-xl text-sm font-mono outline-none"
                            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
                            placeholder="http://192.168.178.x:8765"
                            onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(null) }}
                          />
                        </div>
                      </div>

                      {error && (
                        <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>
                      )}

                      <div className="flex gap-2">
                        <button onClick={saveEdit} disabled={saving}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
                          style={{ background: 'var(--accent)', color: '#fff' }}>
                          <Check size={12} /> {saving ? 'Speichern...' : 'Speichern'}
                        </button>
                        <button onClick={() => { setEditing(null); setError(null) }}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                          <X size={12} /> Abbrechen
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div key="view"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="flex items-center gap-4 flex-wrap">

                      {/* Status-Dot */}
                      <span className="shrink-0 rounded-full block"
                        style={{
                          width: 8, height: 8,
                          background: conn === 'connected' ? 'var(--green)' : conn === 'warning' ? '#f59e0b' : '#ef4444',
                          boxShadow: `0 0 5px ${conn === 'connected' ? 'var(--green)' : conn === 'warning' ? '#f59e0b' : '#ef4444'}`,
                        }} />

                      {/* Infos */}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm" style={{ color: 'var(--text-1)' }}>{bot.name}</p>
                        <p className="text-[11px] font-mono truncate mt-0.5" style={{ color: 'var(--text-3)' }}>{bot.url}</p>
                      </div>

                      {/* Profil + Verbindung */}
                      <div className="flex items-center gap-3 text-[11px]" style={{ color: 'var(--text-3)' }}>
                        {profile && <span>{profile.name}</span>}
                        <span className="flex items-center gap-1">
                          {conn === 'connected'
                            ? <><Wifi size={11} style={{ color: 'var(--green)' }} /> Online</>
                            : <><WifiOff size={11} style={{ color: '#ef4444' }} /> Offline</>}
                        </span>
                      </div>

                      {/* Aktionen */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startEdit(bot.id, bot.name, bot.url)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                          <Pencil size={11} /> Bearbeiten
                        </button>
                        <button
                          onClick={() => deleteBot(bot.id, bot.name)}
                          disabled={deleting === bot.id}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50"
                          style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
                          <Trash2 size={11} /> {deleting === bot.id ? '...' : 'Entfernen'}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Info-Box */}
      {bots.length > 0 && (
        <div className="mt-4 rounded-xl px-4 py-3 flex items-start gap-2"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <ExternalLink size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--text-3)' }} />
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>
            Bot-spezifische Einstellungen (Symbole, Intervalle, MT5-Account) erreichst du über den{' '}
            <a href="/bridge/settings" className="underline" style={{ color: 'var(--accent)' }}>
              Bridge-Bereich
            </a>.
          </p>
        </div>
      )}
    </main>
  )
}
