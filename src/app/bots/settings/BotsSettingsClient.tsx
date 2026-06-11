'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Bot, Check, Wifi, WifiOff } from 'lucide-react'
import { BotWithStatus, BotStatus } from '@/types/bot'
import { Profile } from '@/types/profile'

interface Props {
  initialBots: BotWithStatus[]
  profiles: Profile[]
}

export default function BotsSettingsClient({ initialBots, profiles }: Props) {
  const filterBots = (list: BotWithStatus[]) =>
    list.filter(b => b.bot.type === 'bot' && b.status?.connectionState !== 'offline')
  const [bots] = useState<BotWithStatus[]>(filterBots(initialBots))

  return (
    <main className="flex-1 min-w-0 p-4 md:p-6">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Bot Einstellungen</h1>
        <p className="text-sm" style={{ color: 'var(--text-3)' }}>Konfiguriere Parameter der verbundenen Bots</p>
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
          <h3 className="font-semibold text-lg mb-2" style={{ color: 'var(--text-1)' }}>Kein Bot verbunden</h3>
          <p className="text-sm max-w-sm" style={{ color: 'var(--text-3)' }}>
            Verbinde einen Bot über die Bridge — verbundene Bots erscheinen hier zur Konfiguration.
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
                        ? <><Wifi size={11} style={{ color: 'var(--green)' }} /> Online</>
                        : <><WifiOff size={11} style={{ color: '#ef4444' }} /> Offline</>}
                    </span>
                  </div>
                </div>

              </motion.div>
            )
          })}
        </div>
      )}
    </main>
  )
}
