'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Bot, Loader2 } from 'lucide-react'
import { Profile } from '@/types/profile'

interface Props {
  profiles: Profile[]
  onClose: () => void
  onAdded: () => void
}

export default function AddBotModal({ profiles, onClose, onAdded }: Props) {
  const [name, setName] = useState('')
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? '')
  const [url, setUrl] = useState('http://192.168.1.100:8765')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !profileId || !url.trim()) {
      setError('Alle Felder sind Pflicht.')
      return
    }
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), profileId, url: url.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Fehler beim Speichern'); return }
      onAdded()
      onClose()
    } catch { setError('Netzwerkfehler') }
    finally { setSaving(false) }
  }

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.6)' }}
        onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-md rounded-2xl p-6"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.12)' }}>
                <Bot size={18} style={{ color: '#ef4444' }} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>Bot hinzufügen</p>
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>Verbindung zu einem Python-Bot konfigurieren</p>
              </div>
            </div>
            <button onClick={onClose} className="cursor-pointer w-8 h-8 flex items-center justify-center rounded-lg"
              style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}>
              <X size={15} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
                Bot-Name
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="z.B. MT5 Scalper"
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
              />
            </div>

            {/* Profil */}
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
                Trading-Profil
              </label>
              <select
                value={profileId}
                onChange={e => setProfileId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none cursor-pointer"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-1)' }}>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.broker})</option>
                ))}
              </select>
            </div>

            {/* URL */}
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
                Bot-URL (Flask Command-Server)
              </label>
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="http://192.168.1.100:8765"
                className="w-full px-3 py-2.5 rounded-xl text-sm font-mono outline-none"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
              />
              <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                IP-Adresse des PCs auf dem der Python-Bot läuft + Port 8765
              </p>
            </div>

            {error && (
              <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                {error}
              </p>
            )}

            <div className="flex gap-3 mt-2">
              <button type="button" onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
                style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                Abbrechen
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: '#ef4444', color: '#fff' }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
                Bot hinzufügen
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
