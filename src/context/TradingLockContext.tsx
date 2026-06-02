'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'alphatrack-trading-unlocked'

interface TradingLockCtx {
  isUnlocked: boolean
  toggle: () => void
}

const TradingLockContext = createContext<TradingLockCtx>({
  isUnlocked: false,
  toggle: () => {},
})

export function TradingLockProvider({ children }: { children: React.ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'true') setIsUnlocked(true)
  }, [])

  const toggle = useCallback(() => {
    setIsUnlocked(prev => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, String(next))
      return next
    })
  }, [])

  return (
    <TradingLockContext.Provider value={{ isUnlocked, toggle }}>
      {children}
    </TradingLockContext.Provider>
  )
}

export function useTradingLock() {
  return useContext(TradingLockContext)
}
