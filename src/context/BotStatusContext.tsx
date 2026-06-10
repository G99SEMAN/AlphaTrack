'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { BotWithStatus } from '@/types/bot'

interface BotStatusContextValue {
  bots: BotWithStatus[]
  lastUpdated: Date | null
  refresh: () => void
}

const BotStatusContext = createContext<BotStatusContextValue>({
  bots: [],
  lastUpdated: null,
  refresh: () => {},
})

function fingerprint(bots: BotWithStatus[]): string {
  return bots.map(b =>
    `${b.bot.id}:${b.status?.lastHeartbeat ?? ''}:${b.status?.connectionState ?? ''}`
  ).join('|')
}

const HEARTBEAT_TIMEOUT_MS = 30_000

export function BotStatusProvider({ children }: { children: React.ReactNode }) {
  const [bots, setBots] = useState<BotWithStatus[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/bridge/status')
      if (!res.ok) return
      const data = await res.json()
      const raw: BotWithStatus[] = data.bots ?? []
      const now = Date.now()
      const next = raw.filter(b => {
        if (!b.status?.lastHeartbeat) return false
        return now - new Date(b.status.lastHeartbeat).getTime() <= HEARTBEAT_TIMEOUT_MS
      })
      setBots(prev => fingerprint(prev) === fingerprint(next) ? prev : next)
      setLastUpdated(new Date())
    } catch { /* silent */ }
  }, [])

  const refresh = useCallback(() => { void poll() }, [poll])

  useEffect(() => {
    poll()
    intervalRef.current = setInterval(poll, 5000)

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (intervalRef.current) clearInterval(intervalRef.current)
      } else {
        void poll()
        intervalRef.current = setInterval(poll, 5000)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [poll])

  return (
    <BotStatusContext.Provider value={{ bots, lastUpdated, refresh }}>
      {children}
    </BotStatusContext.Provider>
  )
}

export function useBotStatus() {
  return useContext(BotStatusContext)
}
