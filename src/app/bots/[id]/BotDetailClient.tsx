'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, Bot, Edit2, Check, X, Wifi, WifiOff, AlertTriangle } from 'lucide-react'
import { BotEntry, BotStatusWithConnection, BridgeLogEntry, ConnectionState, BotState } from '@/types/bot'
import { Profile } from '@/types/profile'

interface Props {
  bot: BotEntry
  status: BotStatusWithConnection | null
  log: BridgeLogEntry[]
  profiles: Profile[]
}

function ConnBadge({ state }: { state: ConnectionState | undefined }) {
  if (!state || state === 'offline') return (
    <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
      <WifiOff size={9} /> Offline
    </span>
  )
  if (state === 'warning') return (
    <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
      <AlertTriangle size={9} /> Schwach
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: 'rgba(0,217,126,0.1)', color: 'var(--green)', border: '1px solid rgba(0,217,126,0.2)' }}>
      <Wifi size={9} /> Online
    </span>
  )
}

const STATE_COLORS: Record<BotState, string> = {
  running: 'var(--green)',
  paused: '#f59e0b',
  stopped: '#64748b',
  error: '#ef4444',
  disconnected: '#64748b',
}

export default function BotDetailClient({ bot, status, log: initialLog, profiles }: Props) {
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(bot.name)
  const [currentName, setCurrentName] = useState(bot.name)
  const [savingName, setSavingName] = useState(false)
  const [log, setLog] = useState<BridgeLogEntry[]>(initialLog)

  const profile = profiles.find(p => p.id === bot.profileId)
  const stateColor = status?.state ? STATE_COLORS[status.state] ?? '#64748b' : '#64748b'

  async function saveName() {
    if (!nameInput.trim() || nameInput.trim() === currentName) {
      setEditingName(false)
      return
    }
    setSavingName(true)
    try {
      const res = await fetch(`/api/bots/${bot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameInput.trim() }),
      })
      if (!res.ok) {
        console.error('[BotDetail] Name speichern fehlgeschlagen:', res.status)
        return
      }
      setCurrentName(nameInput.trim())
      setEditingName(false)
    } finally {
      setSavingName(false)
    }
  }

  async function refreshLog() {
    try {
      const res = await fetch(`/api/bots/${bot.id}/log`)
      if (res.ok) {
        const { log: fresh } = await res.json()
        setLog(fresh)
      }
    } catch { /* silent */ }
  }

  const logLevelColor = (level: string) => {
    if (level === 'error') return '#ef4444'
    if (level === 'warn') return '#f59e0b'
    return 'var(--text-3)'
  }

  return (
    <main className="flex-1 min-w-0 p-4 md:p-6">

      {/* Back + Header */}
      <div className="mb-5 flex items-center gap-3">
        <Link href="/bots" className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-3)' }}>
          <ArrowLeft size={14} /> Bots
        </Link>
        <span style={{ color: 'var(--text-3)' }}>/</span>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)' }}>
            <Bot size={16} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            {editingName ? (
              <div className="flex items-center gap-1">
                <input
                  className="text-sm font-bold rounded px-2 py-0.5 border"
                  style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text-1)' }}
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false) }}
                  autoFocus
                />
                <button onClick={saveName} disabled={savingName} className="p-0.5" style={{ color: 'var(--green)' }}>
                  <Check size={14} />
                </button>
                <button onClick={() => setEditingName(false)} className="p-0.5" style={{ color: '#ef4444' }}>
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-bold" style={{ color: 'var(--text-1)' }}>{currentName}</h1>
                <button onClick={() => { setNameInput(currentName); setEditingName(true) }}
                  className="opacity-40 hover:opacity-80" title="Name aendern (nur in AlphaTrack)">
                  <Edit2 size={12} />
                </button>
              </div>
            )}
            <p className="text-[11px] font-mono" style={{ color: 'var(--text-3)' }}>{bot.id}</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <ConnBadge state={status?.connectionState} />
          {status?.state && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: `${stateColor}18`, color: stateColor, border: `1px solid ${stateColor}33` }}>
              {status.state}
            </span>
          )}
        </div>
      </div>

      {/* Identity + Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Bot-ID',         value: bot.id },
          { label: 'Name',           value: currentName },
          { label: 'Status',         value: status?.state ?? '—' },
          { label: 'Offene Trades',  value: String(status?.openPositions ?? 0) },
          { label: 'Profil',         value: profile?.name ?? '—' },
          { label: 'Balance',        value: status?.balance != null ? `${status.balance.toFixed(2)} ${status.currency ?? ''}` : '—' },
          { label: 'Uptime',         value: status?.uptime ? `${Math.floor(status.uptime / 60)}m` : '—' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-3"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-3)' }}>{s.label}</p>
            <p className="text-sm font-bold truncate" style={{ color: 'var(--text-1)' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Bot-Log (gespiegelt vom Bot-Terminal, C6.3) */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>Bot-Log</h2>
          <button onClick={refreshLog} className="text-[11px] px-2 py-1 rounded"
            style={{ background: 'var(--bg)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
            Aktualisieren
          </button>
        </div>
        <div className="overflow-y-auto max-h-80 p-4 space-y-1 flex flex-col-reverse">
          {log.length === 0 ? (
            <p className="text-xs text-center py-6" style={{ color: 'var(--text-3)' }}>Keine Log-Eintraege</p>
          ) : (
            log.map(entry => (
              <div key={entry.id} className="flex items-start gap-2 text-xs font-mono">
                <span className="shrink-0" style={{ color: 'var(--text-3)' }}>
                  {new Date(entry.timestamp).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                  {' '}
                  {new Date(entry.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className="shrink-0 font-semibold" style={{ color: logLevelColor(entry.level) }}>
                  [{entry.level.toUpperCase()}]
                </span>
                <span style={{ color: 'var(--text-2)' }}>{entry.message}</span>
                {entry.details && (
                  <span className="ml-1" style={{ color: 'var(--text-3)' }}>{entry.details}</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

    </main>
  )
}
