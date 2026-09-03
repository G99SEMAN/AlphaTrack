'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Bot, Check, Wifi, WifiOff } from 'lucide-react'
import { BotWithStatus, BotStatus } from '@/types/bot'
import { Profile } from '@/types/profile'
import { useTranslations } from 'next-intl'

interface Props {
  initialBots: BotWithStatus[]
  profiles: Profile[]
}

export default function BotsSettingsClient({ initialBots, profiles }: Props) {
  const t = useTranslations('bots.settingsPage')
  const filterBots = (list: BotWithStatus[]) =>
    list.filter(b => b.bot.type === 'bot' && b.status?.connectionState !== 'offline')
  const [bots] = useState<BotWithStatus[]>(filterBots(initialBots))
  const [drafts, setDrafts] = useState<Record<string, Record<string, string | number | boolean>>>({})
  const [sending, setSending] = useState<string | null>(null)

  async function sendParameters(botId: string) {
    const parameters = drafts[botId]
    if (!parameters) return
    setSending(botId)
    try {
      const res = await fetch('/api/bridge/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bridgeId: botId, command: 'set_parameters', payload: { parameters } }),
      })
      if (!res.ok) {
        console.error('[BotsSettings] set_parameters fehlgeschlagen:', res.status)
      }
    } finally {
      setSending(null)
    }
  }

  function renderParameterEditor(botId: string, parameters: Record<string, string | number | boolean> | undefined) {
    if (!parameters || Object.keys(parameters).length === 0) {
      return (
        <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>
          {t('noParametersMessage')}
        </p>
      )
    }

    const draft = drafts[botId] ?? parameters

    return (
      <div className="flex flex-col gap-3">
        {Object.entries(draft).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-2)' }}>
              {key}
            </span>
            {typeof value === 'boolean' ? (
              <button
                role="switch"
                aria-checked={value}
                aria-label={key}
                onClick={() => setDrafts(prev => ({
                  ...prev,
                  [botId]: { ...(prev[botId] ?? parameters), [key]: !value },
                }))}
                className="shrink-0 rounded-full transition-colors"
                style={{ width: 44, height: 24, background: value ? 'var(--green)' : 'var(--surface-3)', position: 'relative' }}>
                <span style={{
                  position: 'absolute', top: 3, left: value ? 23 : 3,
                  width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.15s',
                }} />
              </button>
            ) : typeof value === 'number' ? (
              <input
                type="number"
                aria-label={key}
                value={value}
                onChange={e => setDrafts(prev => ({
                  ...prev,
                  [botId]: { ...(prev[botId] ?? parameters), [key]: parseFloat(e.target.value) || 0 },
                }))}
                className="w-28 px-2 py-1 rounded-lg text-[11px] font-mono outline-none text-right"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
              />
            ) : (
              <input
                type="text"
                aria-label={key}
                value={value as string}
                onChange={e => setDrafts(prev => ({
                  ...prev,
                  [botId]: { ...(prev[botId] ?? parameters), [key]: e.target.value },
                }))}
                className="w-28 px-2 py-1 rounded-lg text-[11px] font-mono outline-none"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
              />
            )}
          </div>
        ))}

        <button
          onClick={() => sendParameters(botId)}
          disabled={sending === botId}
          aria-busy={sending === botId}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold cursor-pointer disabled:opacity-60 mt-1 self-start"
          style={{ background: 'var(--accent)', color: '#fff' }}>
          <Check size={12} />
          {sending === botId ? t('sendingBtn') : t('sendParamsBtn')}
        </button>
      </div>
    )
  }

  return (
    <main className="flex-1 min-w-0 p-4 md:p-6">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>{t('title')}</h1>
        <p className="text-sm" style={{ color: 'var(--text-3)' }}>{t('subtitle')}</p>
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
          <h3 className="font-semibold text-lg mb-2" style={{ color: 'var(--text-1)' }}>{t('emptyTitle')}</h3>
          <p className="text-sm max-w-sm" style={{ color: 'var(--text-3)' }}>
            {t('emptyDescription')}
          </p>
        </motion.div>
      )}

      {/* Bot-Liste */}
      {bots.length > 0 && (
        <div className="flex flex-col gap-3">
          {bots.map(({ bot, status }) => {
            const profile = profiles.find(p => p.id === bot.profileId)
            const conn = status?.connectionState

            return (
              <motion.div key={bot.id} layout
                className="rounded-2xl p-4"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

                {/* Read-only Bot-Info */}
                <div className="flex items-center gap-4 flex-wrap">

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
                        ? <><Wifi size={11} style={{ color: 'var(--green)' }} /> {t('connOnline')}</>
                        : <><WifiOff size={11} style={{ color: '#ef4444' }} /> {t('connOffline')}</>}
                    </span>
                  </div>
                </div>

                {/* Parameter-Editor */}
                <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                  {renderParameterEditor(bot.id, status?.parameters)}
                </div>

              </motion.div>
            )
          })}
        </div>
      )}
    </main>
  )
}
