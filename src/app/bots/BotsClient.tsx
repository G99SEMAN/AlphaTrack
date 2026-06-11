'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Bot, Wifi, WifiOff, AlertTriangle, TrendingUp, ExternalLink } from 'lucide-react'
import { BotWithStatus, ConnectionState, BotState, BotStats } from '@/types/bot'
import { Profile } from '@/types/profile'
import Link from 'next/link'
import { currencySymbol } from '@/lib/currency'

interface Props {
  initialBots: BotWithStatus[]
  profiles: Profile[]
}

function ConnectionBadge({ state }: { state: ConnectionState | undefined }) {
  if (!state || state === 'offline') {
    return (
      <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
        <WifiOff size={9} /> Offline
      </span>
    )
  }
  if (state === 'warning') {
    return (
      <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
        <AlertTriangle size={9} /> Schwach
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: 'rgba(0,217,126,0.1)', color: 'var(--green)', border: '1px solid rgba(0,217,126,0.2)' }}>
      <Wifi size={9} /> Online
    </span>
  )
}

function StateBadge({ state }: { state: BotState | undefined }) {
  if (!state || state === 'disconnected') return null
  const map: Record<Exclude<BotState, 'disconnected'>, { label: string; color: string; bg: string }> = {
    running: { label: 'Läuft',     color: 'var(--green)', bg: 'rgba(0,217,126,0.08)' },
    paused:  { label: 'Pausiert',  color: '#f59e0b',      bg: 'rgba(245,158,11,0.08)' },
    stopped: { label: 'Gestoppt', color: '#64748b',      bg: 'rgba(100,116,139,0.1)' },
    error:   { label: 'Fehler',    color: '#ef4444',      bg: 'rgba(239,68,68,0.08)' },
  }
  const s = map[state as Exclude<BotState, 'disconnected'>]
  if (!s) return null
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function formatPnl(realizedPnl: number | null, currency: string): { value: string; color: string } {
  if (realizedPnl === null) return { value: '-', color: 'var(--text-3)' }
  if (realizedPnl > 0) return { value: `+${realizedPnl.toFixed(2)} ${currencySymbol(currency)}`, color: 'var(--green)' }
  if (realizedPnl < 0) return { value: `${realizedPnl.toFixed(2)} ${currencySymbol(currency)}`, color: 'var(--red)' }
  return { value: `+0.00 ${currencySymbol(currency)}`, color: 'var(--text-1)' }
}

export default function BotsClient({ initialBots, profiles }: Props) {
  const filterBots = (list: BotWithStatus[]) =>
    list.filter(b => b.bot.type === 'bot' && b.status != null && b.status.connectionState !== 'offline')
  const [bots, setBots] = useState<BotWithStatus[]>(filterBots(initialBots))

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/bridge/status')
      if (res.ok) {
        const { bots: list } = await res.json()
        setBots(filterBots(list))
      }
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    const id = setInterval(refresh, 8000)
    return () => clearInterval(id)
  }, [refresh])

  const [stats, setStats] = useState<Record<string, BotStats>>({})

  useEffect(() => {
    async function fetchStats() {
      const results = await Promise.allSettled(
        bots.map(async ({ bot }) => {
          const res = await fetch(`/api/bots/${bot.id}/stats`)
          if (!res.ok) return null
          return { id: bot.id, data: await res.json() as BotStats }
        })
      )
      const next: Record<string, BotStats> = {}
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
          next[r.value.id] = r.value.data
        }
      }
      setStats(next)
    }
    fetchStats()
    const id = setInterval(fetchStats, 8000)
    return () => clearInterval(id)
  }, [bots])

  const connected = bots.filter(b => b.status?.connectionState === 'connected').length
  const running = bots.filter(b => b.status?.state === 'running').length

  return (
    <main className="flex-1 min-w-0 p-4 md:p-6">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Bots</h1>
        <p className="text-sm" style={{ color: 'var(--text-3)' }}>
          {bots.length} Bot{bots.length !== 1 ? 's' : ''} aktiv
        </p>
      </div>

      {/* Leer-Zustand */}
      {bots.length === 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-12 flex flex-col items-center text-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'var(--accent-bg)' }}>
            <Bot size={26} style={{ color: 'var(--accent)' }} />
          </div>
          <h3 className="font-semibold text-lg mb-2" style={{ color: 'var(--text-1)' }}>Kein Bot aktiv</h3>
          <p className="text-sm max-w-sm" style={{ color: 'var(--text-3)' }}>
            Starte einen Bot auf dem Mini PC — er erscheint automatisch hier sobald er sich mit der Bridge verbindet.
          </p>
        </motion.div>
      )}

      {bots.length > 0 && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: 'Gesamt',  value: bots.length, color: 'var(--text-1)' },
              { label: 'Online',  value: connected,   color: 'var(--green)' },
              { label: 'Aktiv',   value: running,     color: '#3b82f6' },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-3 text-center"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Bot-Karten */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {bots.map(({ bot, status }, i) => {
              const profile = profiles.find(p => p.id === bot.profileId)
              const conn = status?.connectionState
              const dotColor = conn === 'connected' ? 'var(--green)' : conn === 'warning' ? '#f59e0b' : '#ef4444'

              return (
                <motion.div key={bot.id}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="rounded-2xl p-4 flex flex-col gap-3"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

                  {/* Karten-Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="shrink-0 rounded-full block"
                        style={{ width: 8, height: 8, background: dotColor, boxShadow: `0 0 6px ${dotColor}` }} />
                      <span className="font-bold text-sm truncate" style={{ color: 'var(--text-1)' }}>
                        {bot.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                      <StateBadge state={status?.state} />
                      <ConnectionBadge state={conn} />
                    </div>
                  </div>

                  {/* Stats-Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <Stat label="Balance"
                      value={status?.balance != null
                        ? `${status.balance.toFixed(2)} ${currencySymbol(status.currency ?? profile?.currency ?? 'EUR')}`
                        : '-'}
                    />
                    <Stat label="Positionen" value={status?.openPositions?.toString() ?? '-'} />
                    <Stat label="Uptime"      value={status?.uptime ? formatUptime(status.uptime) : '-'} />
                  </div>

                  {/* Bot-ID (Spec: ID + Name anzeigen) */}
                  <p className="text-[10px] font-mono truncate" style={{ color: 'var(--text-3)' }}>
                    ID: {bot.id}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
                    <p className="text-[11px] truncate" style={{ color: 'var(--text-3)' }}>
                      <TrendingUp size={10} className="inline mr-1" />
                      {profile?.name ?? 'Kein Profil'}
                    </p>
                    <Link href={`/bots/${bot.id}`}
                      className="flex items-center gap-1 text-[11px] font-semibold"
                      style={{ color: 'var(--accent)' }}>
                      Detail <ExternalLink size={10} />
                    </Link>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </>
      )}
    </main>
  )
}

function Stat({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="rounded-xl px-3 py-2" style={{ background: 'var(--bg)' }}>
      <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-3)' }}>{label}</p>
      <p className="text-sm font-bold truncate" style={{ color: valueColor ?? 'var(--text-1)' }}>{value}</p>
    </div>
  )
}
