'use client'

import { useState, useEffect } from 'react'

export type AccentTheme = 'blue' | 'red' | 'violet'

const STORAGE_KEY = 'alphatrack-accent-theme'

function applyAccent(theme: AccentTheme) {
  const root = document.documentElement
  root.classList.remove('theme-red', 'theme-violet')
  if (theme === 'red') root.classList.add('theme-red')
  if (theme === 'violet') root.classList.add('theme-violet')
}

export function useAccentTheme() {
  const [accent, setAccentState] = useState<AccentTheme>('blue')

  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as AccentTheme) ?? 'blue'
    setAccentState(stored)
    applyAccent(stored)
  }, [])

  function setAccent(theme: AccentTheme) {
    setAccentState(theme)
    localStorage.setItem(STORAGE_KEY, theme)
    applyAccent(theme)
  }

  return { accent, setAccent }
}
