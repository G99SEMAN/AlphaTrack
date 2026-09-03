'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Info, Clock } from 'lucide-react'
import { AnalyseHistoryEntry } from '@/lib/analyse-data'
import { useState } from 'react'
import { useTranslations } from 'next-intl'

interface Props {
  entries: AnalyseHistoryEntry[]
}

const BIAS_STYLE = {
  Long:    { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   icon: TrendingUp },
  Short:   { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   icon: TrendingDown },
  Neutral: { color: 'var(--text-2)', bg: 'var(--bg)',       icon: Minus },
}

const CONF_COLOR = { Hoch: '#22c55e', Mittel: '#f59e0b', Niedrig: '#ef4444' }

export default function AnalyseHistory({ entries }: Props) {
  const t = useTranslations('analyse.history')
  const [expanded, setExpanded] = useState<string | null>(null)

  if (entries.length === 0) return null

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-3)' }}>
        {t('historyHeading')}
        <span className="ml-2 px-1.5 py-0.5 rounded font-mono text-xs"
          style={{ background: 'var(--surface)', color: 'var(--text-3)' }}>
          {entries.length}
        </span>
      </p>

      <div className="flex flex-col gap-2">
        {entries.map((entry, i) => {
          const bias = BIAS_STYLE[entry.bias]
          const BiasIcon = bias.icon
          const isOpen = expanded === entry.id
          const confidenceLabel = entry.confidence === 'Hoch'
            ? t('confidenceHigh')
            : entry.confidence === 'Mittel'
              ? t('confidenceMedium')
              : t('confidenceLow')
          const date = new Date(entry.timestamp).toLocaleString('de-DE', {
            day: '2-digit', month: '2-digit', year: '2-digit',
            hour: '2-digit', minute: '2-digit',
          })

          return (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-xl overflow-hidden"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              {/* Header Row - immer sichtbar */}
              <button
                onClick={() => setExpanded(isOpen ? null : entry.id)}
                className="w-full flex items-center gap-3 px-4 py-3 cursor-pointer text-left transition-opacity hover:opacity-80"
              >
                {/* Bias Icon */}
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: bias.bg }}>
                  <BiasIcon size={13} style={{ color: bias.color }} />
                </div>

                {/* Bias + Konfidenz */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-black" style={{ color: bias.color }}>
                    {entry.bias}
                  </span>
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded"
                    style={{ background: 'var(--bg)', color: CONF_COLOR[entry.confidence] }}>
                    {confidenceLabel}
                  </span>
                  <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                    {entry.symbol ?? 'EUR/USD'}
                  </span>
                  <span className="text-xs hidden sm:inline" style={{ color: 'var(--text-3)' }}>
                    {entry.timeframe}
                  </span>
                </div>

                {/* Entry / SL / TP kompakt */}
                <div className="hidden md:flex items-center gap-3 ml-2 text-xs font-mono">
                  <span style={{ color: 'var(--text-3)' }}>
                    E: <span style={{ color: 'var(--text-2)' }}>{entry.entry_zone}</span>
                  </span>
                  <span style={{ color: 'var(--text-3)' }}>
                    SL: <span style={{ color: '#f87171' }}>{entry.stop_loss}</span>
                  </span>
                  <span style={{ color: 'var(--text-3)' }}>
                    TP: <span style={{ color: '#4ade80' }}>{entry.take_profit}</span>
                  </span>
                </div>

                {/* Timestamp */}
                <div className="ml-auto flex items-center gap-2 shrink-0">
                  <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-3)' }}>
                    <Clock size={10} />
                    {date}
                  </span>
                  {isOpen ? <ChevronUp size={13} style={{ color: 'var(--text-3)' }} /> : <ChevronDown size={13} style={{ color: 'var(--text-3)' }} />}
                </div>
              </button>

              {/* Aufgeklappte Details */}
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 flex flex-col gap-3"
                      style={{ borderTop: '1px solid var(--border)' }}>

                      {/* Preise Grid (mobile sichtbar) */}
                      <div className="grid grid-cols-3 gap-2 mt-3 md:hidden text-xs font-mono">
                        <div className="rounded-lg px-3 py-2" style={{ background: 'var(--bg)' }}>
                          <p className="font-semibold mb-0.5" style={{ color: 'var(--text-3)' }}>{t('entryLabel')}</p>
                          <p style={{ color: 'var(--text-1)' }}>{entry.entry_zone}</p>
                        </div>
                        <div className="rounded-lg px-3 py-2" style={{ background: 'var(--bg)' }}>
                          <p className="font-semibold mb-0.5" style={{ color: 'var(--text-3)' }}>{t('stopLossLabel')}</p>
                          <p style={{ color: '#f87171' }}>{entry.stop_loss}</p>
                        </div>
                        <div className="rounded-lg px-3 py-2" style={{ background: 'var(--bg)' }}>
                          <p className="font-semibold mb-0.5" style={{ color: 'var(--text-3)' }}>{t('takeProfitLabel')}</p>
                          <p style={{ color: '#4ade80' }}>{entry.take_profit}</p>
                        </div>
                      </div>

                      {/* Reasoning */}
                      <div className="flex gap-2.5 px-3 py-3 rounded-xl"
                        style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                        <Info size={13} className="shrink-0 mt-0.5" style={{ color: 'var(--text-3)' }} />
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>
                          {entry.reasoning}
                        </p>
                      </div>

                      {/* RR + Kurs */}
                      <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-3)' }}>
                        <span>RR: <span className="font-mono" style={{ color: 'var(--text-2)' }}>{entry.risk_reward}</span></span>
                        {entry.currentPrice && (
                          <span>{t('priceAtAnalysisLabel')} <span className="font-mono" style={{ color: 'var(--text-2)' }}>{entry.currentPrice}</span></span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
