'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Play, Pause, Square, RotateCcw, Loader2, RefreshCw } from 'lucide-react'
import { BotCommandType, BotState, ConnectionState } from '@/types/bot'
import { useBotStatus } from '@/context/BotStatusContext'
import { useTranslations } from 'next-intl'

interface Props {
  botId: string
  initialState?: BotState
  initialConnection?: ConnectionState
}

const DISABLED_FOR: Partial<Record<BotState, BotCommandType[]>> = {
  running:      ['start', 'resume'],
  paused:       ['start', 'pause'],
  stopped:      ['stop', 'pause', 'resume'],
  error:        ['pause', 'resume'],
  disconnected: ['start', 'stop', 'pause', 'resume', 'restart'],
}

export default function BotControls({ botId, initialState, initialConnection }: Props) {
  const t = useTranslations('bridge.controls')
  const { bots, refresh } = useBotStatus()
  const [sending, setSending] = useState<BotCommandType | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const botEntry = bots.find(b => b.bot.id === botId)
  const connection: ConnectionState = botEntry?.status?.connectionState ?? initialConnection ?? 'offline'
  const botState: BotState = connection === 'offline'
    ? 'disconnected'
    : (botEntry?.status?.state ?? initialState ?? 'disconnected')

  async function sendCommand(cmd: BotCommandType) {
    setSending(cmd); setFeedback(null)
    try {
      const res = await fetch('/api/bridge/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bridgeId: botId, command: cmd }),
      })
      const data = await res.json()
      if (res.ok) {
        setFeedback(t('commandSent', { cmd }))
        setTimeout(() => setFeedback(null), 4000)
        refresh()
      } else {
        setFeedback(t('commandError', { error: data.error }))
      }
    } catch { setFeedback(t('connectionError')) }
    finally { setSending(null) }
  }

  const isOffline = connection === 'offline'
  const disabled_ = DISABLED_FOR[botState] ?? []

  const buttons: { cmd: BotCommandType; label: string; Icon: typeof Play; color: string; bg: string }[] = [
    { cmd: 'start',   label: t('startBtn'),  Icon: Play,      color: 'var(--green)', bg: 'rgba(0,217,126,0.1)' },
    { cmd: 'pause',   label: t('pauseBtn'),  Icon: Pause,     color: '#f59e0b',      bg: 'rgba(245,158,11,0.1)' },
    { cmd: 'resume',  label: t('resumeBtn'), Icon: RotateCcw, color: '#3b82f6',      bg: 'rgba(59,130,246,0.1)' },
    { cmd: 'stop',    label: t('stopBtn'),   Icon: Square,    color: '#ef4444',      bg: 'rgba(239,68,68,0.1)' },
  ]

  const restartDisabled = isOffline || (DISABLED_FOR[botState] ?? []).includes('restart')

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
      className="rounded-2xl p-3"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-2.5 px-1" style={{ color: 'var(--text-3)' }}>{t('heading')}</p>
      <div className="flex flex-wrap gap-1.5">
        {buttons.map(({ cmd, label, Icon, color, bg }) => {
          const isDisabled = isOffline || disabled_.includes(cmd)
          return (
            <button key={cmd} onClick={() => sendCommand(cmd)}
              disabled={isDisabled || sending !== null}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: isDisabled ? 'var(--surface-2)' : bg, color: isDisabled ? 'var(--text-3)' : color, border: `1px solid ${isDisabled ? 'var(--border)' : color + '40'}` }}>
              {sending === cmd ? <Loader2 size={12} className="animate-spin" /> : <Icon size={12} />}
              {label}
            </button>
          )
        })}
        <div className="w-px self-stretch mx-0.5" style={{ background: 'var(--border)' }} />
        <button
          onClick={() => sendCommand('restart')}
          disabled={restartDisabled || sending !== null}
          title={t('restartTooltip')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            background: restartDisabled ? 'var(--surface-2)' : 'rgba(168,85,247,0.1)',
            color: restartDisabled ? 'var(--text-3)' : '#a855f7',
            border: `1px solid ${restartDisabled ? 'var(--border)' : 'rgba(168,85,247,0.35)'}`,
          }}>
          {sending === 'restart' ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {t('restartBtn')}
        </button>
      </div>
      {isOffline && <p className="mt-2 text-[10px] px-1" style={{ color: 'var(--text-3)' }}>{t('bridgeMustBeConnected')}</p>}
      {feedback && <p className="mt-2 text-[10px] font-medium px-1" style={{ color: 'var(--text-2)' }}>{feedback}</p>}
    </motion.div>
  )
}
