'use client'

import { useState, useEffect } from 'react'

export interface CalendarSettings {
  showBotDots: boolean
  showEconomicEvents: boolean
}

const DEFAULT_SETTINGS: CalendarSettings = {
  showBotDots: true,
  showEconomicEvents: true,
}

const STORAGE_KEY = 'alphatrack-calendar-settings'

export function useCalendarSettings() {
  const [settings, setSettings] = useState<CalendarSettings>(DEFAULT_SETTINGS)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) })
      }
    } catch {
      // ignore
    }
  }, [])

  function updateSetting(key: keyof CalendarSettings, value: boolean) {
    setSettings(prev => {
      const next = { ...prev, [key]: value }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // ignore
      }
      return next
    })
  }

  return { settings, updateSetting }
}
