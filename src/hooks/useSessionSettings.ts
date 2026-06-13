'use client'

import { useState, useEffect, useCallback } from 'react'

export interface SessionSettings {
  visibleExchanges: string[]
}

const DEFAULT_SETTINGS: SessionSettings = {
  visibleExchanges: ['nyse', 'lse', 'xetra', 'tse'],
}

const STORAGE_KEY = 'alphatrack-session-settings'
const SYNC_EVENT = 'alphatrack-session-settings-changed'

function loadFromStorage(): SessionSettings | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : null
  } catch { return null }
}

function saveToStorage(s: SessionSettings) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch { /* silent */ }
}

export function useSessionSettings() {
  const [settings, setSettings] = useState<SessionSettings>(DEFAULT_SETTINGS)

  useEffect(() => {
    // Sofort aus localStorage (verhindert Flash)
    const cached = loadFromStorage()
    if (cached) setSettings(cached)

    // Server ist autoritativ — beim ersten Mount synchronisieren
    fetch('/api/ui-settings')
      .then(r => r.json())
      .then((data: Partial<SessionSettings>) => {
        const merged: SessionSettings = { ...DEFAULT_SETTINGS, ...data }
        setSettings(merged)
        saveToStorage(merged)
      })
      .catch(() => { /* localStorage als Fallback */ })

    // Andere Komponenten-Instanzen informieren wenn Einstellungen geändert werden
    function onSync() {
      const updated = loadFromStorage()
      if (updated) setSettings(updated)
    }
    window.addEventListener(SYNC_EVENT, onSync)
    return () => window.removeEventListener(SYNC_EVENT, onSync)
  }, [])

  const updateExchanges = useCallback(async (visibleExchanges: string[]) => {
    const next: SessionSettings = { ...settings, visibleExchanges }
    setSettings(next)
    saveToStorage(next)
    window.dispatchEvent(new CustomEvent(SYNC_EVENT))
    await fetch('/api/ui-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    }).catch(() => { /* silent */ })
  }, [settings])

  return { settings, updateExchanges }
}
