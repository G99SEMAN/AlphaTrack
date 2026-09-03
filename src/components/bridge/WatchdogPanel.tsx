'use client'

import { motion } from 'framer-motion'
import { Wifi, WifiOff, AlertTriangle, Bot, Cpu, Clock, TrendingUp } from 'lucide-react'
import { ConnectionState } from '@/types/bot'
import { useBotStatus } from '@/context/BotStatusContext'
import { useTranslations } from 'next-intl'

interface Props {
  botId: string
  botName: string
}

function getStateLabels(t: ReturnType<typeof useTranslations<'bridge.watchdog'>>) {
  return {
    running: t('stateRunning'), paused: t('statePaused'), stopped: t('stateStopped'),
    error: t('stateError'), disconnected: t('stateDisconnected'),
  } as const
}

const STATE_COLOR = {
  running: 'var(--green)', paused: '#f59e0b', stopped: 'var(--text-3)', error: 'var(--red)', disconnected: 'var(--text-3)',
} as const

function ConnectionBadge({ state }: { state: ConnectionState }) {
  const t = useTranslations('bridge.watchdog')
  const cfg = {
    connected: { Icon: Wifi,          label: t('connConnected'), color: 'var(--green)', glow: 'rgba(0,217,126,0.4)' },
    warning:   { Icon: AlertTriangle, label: t('connWarning'),   color: '#f59e0b',      glow: 'rgba(245,158,11,0.4)' },
    offline:   { Icon: WifiOff,       label: t('connOffline'),   color: '#ef4444',      glow: 'rgba(239,68,68,0.4)'  },
  }[state]
  const Icon = cfg.Icon
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
      style={{ background: `${cfg.color}18`, border: `1px solid ${cfg.color}33` }}>
      <span className="rounded-full" style={{ width: 7, height: 7, background: cfg.color, boxShadow: `0 0 8px ${cfg.glow}`, display: 'block' }} />
      <Icon size={13} style={{ color: cfg.color }} />
      <span className="text-xs font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
    </div>
  )
}

function fmt(s: number) {
  if (s < 60) return `${s}s`
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export default function WatchdogPanel({ botId, botName }: Props) {
  const t = useTranslations('bridge.watchdog')
  const stateLabels = getStateLabels(t)
  const { bots, lastUpdated } = useBotStatus()
  const botEntry = bots.find(b => b.bot.id === botId)

  const conn = botEntry?.status?.connectionState ?? 'offline'
  const status = (botEntry?.status && conn !== 'offline') ? botEntry.status : null

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.12)' }}>
            <Bot size={18} style={{ color: '#ef4444' }} />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>{botName}</p>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>
              {lastUpdated ? `${t('lastUpdatedPrefix')} ${lastUpdated.toLocaleTimeString('de-DE')}` : t('waitingForConnection')}
            </p>
          </div>
        </div>
        <ConnectionBadge state={conn} />
      </div>

      {status ? (
        <>
          <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl" style={{ background: 'var(--surface-2)' }}>
            <span className="rounded-full shrink-0" style={{ width: 8, height: 8, background: STATE_COLOR[status.state], boxShadow: `0 0 6px ${STATE_COLOR[status.state]}` }} />
            <span className="text-sm font-bold" style={{ color: STATE_COLOR[status.state] }}>{stateLabels[status.state]}</span>
            <span className="ml-auto text-xs font-mono" style={{ color: 'var(--text-3)' }}>v{status.bridgeVersion}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { Icon: Cpu,        label: t('mt5Label'),    value: status.mt5Connected ? t('mt5Connected') : t('mt5Disconnected'), color: status.mt5Connected ? 'var(--green)' : 'var(--red)' },
              { Icon: Clock,      label: t('uptimeLabel'), value: fmt(status.uptime), color: 'var(--text-1)' },
              { Icon: TrendingUp, label: t('openLabel'),   value: status.openPositions === 1 ? t('positionOne', { count: status.openPositions }) : t('positionMany', { count: status.openPositions }), color: status.openPositions > 0 ? '#f59e0b' : 'var(--text-1)' },
            ].map(({ Icon, label, value, color }) => (
              <div key={label} className="rounded-xl px-3 py-2.5" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon size={12} style={{ color: 'var(--text-3)' }} />
                  <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: 'var(--text-3)' }}>{label}</p>
                </div>
                <p className="text-sm font-bold" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>
          {status.activeSymbols.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {status.activeSymbols.map(sym => (
                <span key={sym} className="text-xs px-2 py-0.5 rounded font-mono font-semibold"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                  {sym}
                </span>
              ))}
            </div>
          )}
          {!status.mt5Connected && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <AlertTriangle size={13} className="shrink-0" style={{ color: '#ef4444' }} />
              <p className="text-xs font-semibold" style={{ color: '#ef4444' }}>{t('mt5Warning')}</p>
            </div>
          )}
          <p className="text-xs mt-3 font-mono" style={{ color: 'var(--text-3)' }}>ID: {botId}</p>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <WifiOff size={28} style={{ color: 'var(--text-3)', marginBottom: 10 }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--text-2)' }}>{t('noHeartbeat')}</p>
          <p className="text-xs mt-1 font-mono" style={{ color: 'var(--text-3)' }}>ID: {botId}</p>
        </div>
      )}
    </motion.div>
  )
}
