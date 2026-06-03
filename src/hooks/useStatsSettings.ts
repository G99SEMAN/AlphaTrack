'use client'

import { useState, useEffect } from 'react'

export interface StatsSettings {
  showKpiRow: boolean
  showMonthlyPnl: boolean
  showDirectionCards: boolean
  showTopAssets: boolean
  showStrategyTable: boolean
  showInstrumentTable: boolean
  showWeekdayChart: boolean
  showHourlyChart: boolean
  showRMultipleChart: boolean
  showTopTrades: boolean
}

const DEFAULT_SETTINGS: StatsSettings = {
  showKpiRow: true,
  showMonthlyPnl: true,
  showDirectionCards: true,
  showTopAssets: true,
  showStrategyTable: true,
  showInstrumentTable: true,
  showWeekdayChart: true,
  showHourlyChart: true,
  showRMultipleChart: true,
  showTopTrades: true,
}

const STORAGE_KEY = 'alphatrack-stats-settings'

export function useStatsSettings() {
  const [settings, setSettings] = useState<StatsSettings>(DEFAULT_SETTINGS)

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

  function updateSetting(key: keyof StatsSettings, value: boolean) {
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
