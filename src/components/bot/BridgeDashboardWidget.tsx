'use client'

import { Bot, Wifi, WifiOff, AlertTriangle, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { BotWithStatus, ConnectionState } from '@/types/bot'
import { useBotStatus } from '@/context/BotStatusContext'

const CONN_CFG = {
  connected: { color: 'var(--green)', Icon: Wifi,          label: 'Verbunden' },
  warning:   { color: '#f59e0b',      Icon: AlertTriangle, label: 'Verzögert' },
  offline:   { color: '#ef4444',      Icon: WifiOff,       label: 'Offline'   },
}

const STATE_COLOR: Record<string, string> = {
  running: 'var(--green)', paused: '#f59e0b', stopped: 'var(--text-3)', error: '#ef4444', disconnected: 'var(--text-3)',
}
const STATE_LABEL: Record<string, string> = {
  running: 'Aktiv', paused: 'Pausiert', stopped: 'Gestoppt', error: 'Fehler', disconnected: 'Getrennt',
}

function connOfBots(bots: BotWithStatus[]): ConnectionState {
  if (bots.some(b => b.status?.connectionState === 'connected')) return 'connected'
  if (bots.some(b => b.status?.connectionState === 'warning')) return 'warning'
  return 'offline'
}

export default function BridgeDashboardWidget() {
  const { bots } = useBotStatus()

  const overallConn = connOfBots(bots)
  const cfg = CONN_CFG[overallConn]
  const ConnIcon = cfg.Icon
  const totalOpen = bots.reduce((s, b) => s + (b.status?.openPositions ?? 0), 0)
  const totalSync  = bots.reduce((s, b) => s + (b.status?.tradesSync ?? 0), 0)

  const stripColor = overallConn === 'connected'
    ? 'linear-gradient(90deg, #00d97e, #06d6a0)'
    : overallConn === 'warning'
    ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
    : 'linear-gradient(90deg, #ef4444, #f87171)'

  return (
    <div className="mb-6 rounded-2xl overflow-hidden"
      style={{ border: `1px solid ${cfg.color}33`, background: 'var(--surface)' }}>
        <div className="h-1 w-full" style={{ background: stripColor }} />
        <div className="px-5 py-4">
          {/* Zeile 1: Icon + Titel + Badge + Link */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(239,68,68,0.1)' }}>
              <Bot size={20} style={{ color: '#ef4444' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold shrink-0" style={{ color: 'var(--text-1)' }}>Bridge</p>
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold shrink-0"
                  style={{ background: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}33` }}>
                  <span className="rounded-full shrink-0" style={{ width: 5, height: 5, background: cfg.color, display: 'block' }} />
                  <ConnIcon size={11} />
                  <span>{cfg.label}</span>
                </span>
              </div>
            </div>
            <Link href="/bridge"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold shrink-0 transition-opacity hover:opacity-80"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>
              <TrendingUp size={13} />Bridge
            </Link>
          </div>

          {/* Zeile 2: Bot-Liste + Stats */}
          {bots.length > 0 && (
            <div className="flex items-center justify-between mt-2.5 min-w-0 gap-3">
              <div className="flex flex-wrap gap-2 min-w-0 flex-1">
                {bots.map(({ bot, status }) => {
                  const c = status?.connectionState ?? 'offline'
                  return (
                    <span key={bot.id} className="text-xs flex items-center gap-1.5 min-w-0" style={{ color: 'var(--text-3)' }}>
                      <span className="rounded-full shrink-0" style={{ width: 5, height: 5, background: CONN_CFG[c].color, display: 'block' }} />
                      <span className="truncate" style={{ color: 'var(--text-2)', fontWeight: 600 }}>{bot.name}</span>
                      {status && <span className="shrink-0" style={{ color: STATE_COLOR[status.state] }}>{STATE_LABEL[status.state]}</span>}
                    </span>
                  )
                })}
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-center">
                  <p className="text-lg font-bold font-mono leading-none" style={{ color: totalOpen > 0 ? '#f59e0b' : 'var(--text-3)' }}>{totalOpen}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Offen</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold font-mono leading-none" style={{ color: 'var(--text-1)' }}>{totalSync}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Synced</p>
                </div>
              </div>
            </div>
          )}
          {bots.length === 0 && (
            <p className="text-xs mt-2" style={{ color: 'var(--text-3)' }}>Kein Bot konfiguriert.</p>
          )}
        </div>
    </div>
  )
}
