'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { BotWithStatus } from '@/types/bot'

interface BotStatusContextValue {
  bots: BotWithStatus[]
}

const BotStatusContext = createContext<BotStatusContextValue>({ bots: [] })

export function BotStatusProvider({ children }: { children: React.ReactNode }) {
  const [bots, setBots] = useState<BotWithStatus[]>([])

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/bridge/status')
      if (!res.ok) return
      const data = await res.json()
      const next: BotWithStatus[] = data.bots ?? []
      setBots(prev => JSON.stringify(prev) === JSON.stringify(next) ? prev : next)
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    poll()
    const id = setInterval(poll, 5000)
    return () => clearInterval(id)
  }, [poll])

  return (
    <BotStatusContext.Provider value={{ bots }}>
      {children}
    </BotStatusContext.Provider>
  )
}

export function useBotStatus() {
  return useContext(BotStatusContext)
}
