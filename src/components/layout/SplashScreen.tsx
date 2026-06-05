'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LogoMark from './LogoMark'

const QUOTES = [
  'Disziplin und Geduld trennen erfolgreiche Trader vom Rest.',
  'Der Markt hat immer recht. Deine Meinung kostet Geld.',
  'Schütze dein Kapital - Gewinne kommen von selbst.',
  'Ein Trade ohne Stop-Loss ist kein Trade, sondern ein Wunsch.',
  'Wer nicht verlieren kann, kann auch nicht gewinnen.',
  'The trend is your friend until the end.',
  'Cut your losses short and let your profits run. — Jesse Livermore',
  'Plan the trade and trade the plan.',
  'In the short run, the market is a voting machine. In the long run, it is a weighing machine. — Benjamin Graham',
  'Risk comes from not knowing what you are doing. — Warren Buffett',
]

export default function SplashScreen() {
  // Startet unsichtbar - wird nur im Client via useEffect aktiviert (verhindert SSR-Problem)
  const [visible, setVisible] = useState(false)
  const [quote, setQuote] = useState('')

  useEffect(() => {
    // Nur einmal pro Session anzeigen
    if (sessionStorage.getItem('splash-shown')) return

    setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)])
    setVisible(true)

    let windowLoaded = document.readyState === 'complete'
    let minTimePassed = false

    const tryHide = () => {
      if (windowLoaded && minTimePassed) {
        setVisible(false)
        sessionStorage.setItem('splash-shown', '1')
      }
    }

    const timer = setTimeout(() => {
      minTimePassed = true
      tryHide()
    }, 800)

    const onLoad = () => {
      windowLoaded = true
      tryHide()
    }

    if (!windowLoaded) window.addEventListener('load', onLoad)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('load', onLoad)
    }
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
          className="fixed inset-0 flex flex-col items-center justify-center gap-6"
          style={{ background: '#080b12', zIndex: 9999 }}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
            className="flex flex-col items-center gap-5"
          >
            <LogoMark size={96} />

            <div className="flex flex-col items-center gap-1">
              <span
                className="text-3xl font-bold tracking-tight"
                style={{ color: '#e8edf5' }}
              >
                Alpha<span style={{ color: '#06d6a0' }}>Track</span>
              </span>
              <span
                className="text-xs tracking-widest uppercase"
                style={{ color: '#4a6080' }}
              >
                Trading Journal
              </span>
            </div>
          </motion.div>

          {quote && (
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="text-sm text-center max-w-xs italic px-6"
              style={{ color: '#4a6080' }}
            >
              &ldquo;{quote}&rdquo;
            </motion.p>
          )}

          <div
            className="absolute bottom-12"
            style={{ width: 160, height: 3, borderRadius: 99, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}
          >
            <motion.div
              style={{
                position: 'absolute', top: 0, left: 0,
                height: '100%', width: '45%',
                background: 'linear-gradient(90deg, transparent, #06d6a0, #00e5ff, transparent)',
                borderRadius: 99,
              }}
              animate={{ x: ['-110%', '330%'] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.05 }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
