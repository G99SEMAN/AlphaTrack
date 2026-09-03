'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { currencySymbol } from '@/lib/currency'
import { X, Pencil, Clock, Shield } from 'lucide-react'
import { Strategy, getTimeframeLabels, normalizeRules } from '@/types/strategy'
import { Trade } from '@/types/trade'
import { useTranslations } from 'next-intl'

interface Props {
  strategy: Strategy
  trades: Trade[]
  currency: string
  onClose: () => void
  onEdit: () => void
}

function renderNotes(text: string) {
  if (!text) return null
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.trim() === '---') {
      elements.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '12px 0' }} />)
      i++
      continue
    }

    const isSectionHeader = line.trim().length > 2 && line.trim() === line.trim().toUpperCase() && /[A-ZÄÖÜ]/.test(line)
    if (isSectionHeader) {
      elements.push(
        <p key={i} className="text-xs font-bold uppercase tracking-widest mt-2 mb-1" style={{ color: 'var(--text-2)' }}>
          {line.trim()}
        </p>
      )
      i++
      continue
    }

    if (line.trim() === '') {
      elements.push(<div key={i} className="h-1" />)
      i++
      continue
    }

    elements.push(
      <p key={i} className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-2)', fontFamily: 'ui-monospace, monospace', fontSize: '0.78rem' }}>
        {line}
      </p>
    )
    i++
  }

  return elements
}

export default function StrategyDetailPanel({ strategy, trades, currency, onClose, onEdit }: Props) {
  const t = useTranslations('strategien.detailPanel')
  const timeframeLabels = getTimeframeLabels(useTranslations('strategien.timeframes'))
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const rules = normalizeRules(strategy.rules)
  const linked = trades.filter(t => t.strategyId === strategy.id && t.status === 'closed' && t.pnl !== undefined)
  const wins = linked.filter(t => (t.pnl ?? 0) > 0)
  const winRate = linked.length > 0 ? Math.round((wins.length / linked.length) * 100) : null
  const totalPnl = linked.reduce((s, t) => s + (t.pnl ?? 0), 0)
  const allLinked = trades.filter(t => t.strategyId === strategy.id)

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      {/* Spacer zum Klicken-zum-Schliessen */}
      <div className="flex-1 md:block hidden" />

      {/* Panel */}
      <motion.div
        initial={{ x: '100%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        onClick={e => e.stopPropagation()}
        className="relative h-full flex flex-col overflow-hidden w-full md:w-[680px] shrink-0"
        style={{ background: 'var(--surface)', borderLeft: '1px solid var(--border)' }}
      >
        {/* Farbiger Top-Stripe */}
        <div className="h-1 shrink-0" style={{ background: strategy.color }} />

        {/* Header */}
        <div
          className="px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ background: strategy.color }} />
              <h2 className="text-base font-bold truncate" style={{ color: 'var(--text-1)' }}>
                {strategy.name}
              </h2>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={onEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-2)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)' }}
              >
                <Pencil size={12} />
                {t('editBtn')}
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer"
                style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {strategy.description && (
            <p className="text-sm mb-3 leading-relaxed" style={{ color: 'var(--text-3)' }}>
              {strategy.description}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium"
              style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
            >
              <Clock size={11} />
              {strategy.timeframe} - {timeframeLabels[strategy.timeframe]}
            </span>
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium"
              style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
            >
              <Shield size={11} />
              {strategy.riskPerTrade}% {t('riskPerTradeSuffix')}
            </span>
          </div>
        </div>

        {/* Scrollbarer Inhalt */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">

          {/* Statistiken */}
          <div
            className="grid grid-cols-3 gap-3 rounded-xl p-4"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
          >
            <div className="text-center">
              <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>{t('colTrades')}</p>
              <p className="text-lg font-bold font-mono" style={{ color: 'var(--text-1)' }}>{allLinked.length}</p>
            </div>
            <div className="text-center">
              <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>{t('colWinRate')}</p>
              <p
                className="text-lg font-bold font-mono"
                style={{ color: winRate === null ? 'var(--text-3)' : winRate >= 50 ? 'var(--green)' : 'var(--red)' }}
              >
                {winRate === null ? '-' : `${winRate}%`}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>{t('colPnl')}</p>
              <p
                className="text-lg font-bold font-mono"
                style={{ color: linked.length === 0 ? 'var(--text-3)' : totalPnl >= 0 ? 'var(--green)' : 'var(--red)' }}
              >
                {linked.length === 0 ? '-' : `${totalPnl >= 0 ? '+' : ''}${totalPnl.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${currencySymbol(currency)}`}
              </p>
            </div>
          </div>

          {/* Regeln */}
          {rules.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-3)' }}>
                {t('checklistLabel', {
                  count: rules.length,
                  conditionLabel: rules.length === 1 ? t('conditionOne') : t('conditionMany'),
                })}
              </p>
              <ul
                className="flex flex-col gap-2"
                style={{ borderLeft: `2px solid ${strategy.color}55`, paddingLeft: 12 }}
              >
                {rules.map((rule, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span
                      className="text-xs font-mono mt-0.5 shrink-0 w-5 text-right"
                      style={{ color: strategy.color }}
                    >
                      {i + 1}.
                    </span>
                    <span className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
                      {rule}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Notes / Detailinhalt */}
          {strategy.notes && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-3)' }}>
                {t('detailsHeading')}
              </p>
              <div
                className="rounded-xl p-4 flex flex-col gap-0.5"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
              >
                {renderNotes(strategy.notes)}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>,
    document.body
  )
}
