'use client'

import { useState, useTransition } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Pencil, Trash2, Loader2, Clock, Shield } from 'lucide-react'
import { currencySymbol } from '@/lib/currency'
import { Strategy, TIMEFRAME_LABELS, normalizeRules } from '@/types/strategy'
import { Trade } from '@/types/trade'
import { deleteStrategyAction } from '@/lib/actions'
import StrategyModal from './StrategyModal'

interface Props {
  strategy: Strategy
  trades: Trade[]
  currency: string
  onOpen: (id: string) => void
}

export default function StrategyCard({ strategy, trades, currency, onOpen }: Props) {
  const [showEdit, setShowEdit] = useState(false)
  const [isPending, startTransition] = useTransition()

  const linked = trades.filter(t => t.strategyId === strategy.id && t.status === 'closed' && t.pnl !== undefined)
  const wins = linked.filter(t => (t.pnl ?? 0) > 0)
  const winRate = linked.length > 0 ? Math.round((wins.length / linked.length) * 100) : null
  const totalPnl = linked.reduce((s, t) => s + (t.pnl ?? 0), 0)
  const allLinked = trades.filter(t => t.strategyId === strategy.id)

  function handleDelete() {
    if (!confirm(`Strategie "${strategy.name}" wirklich löschen?`)) return
    startTransition(() => deleteStrategyAction(strategy.id))
  }

  return (
    <>
      <div
        className="group rounded-xl flex flex-col transition-all cursor-pointer"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
        }}
        onClick={() => onOpen(strategy.id)}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = strategy.color + '66' }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)' }}
      >
        {/* Farbiger Top-Stripe */}
        <div
          className="h-1 rounded-t-xl"
          style={{ background: strategy.color }}
        />

        <div className="p-4 flex flex-col gap-3 flex-1">
          {/* Header: Name + Badges */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: strategy.color }}
                />
                <h3 className="text-sm font-bold truncate" style={{ color: 'var(--text-1)' }}>
                  {strategy.name}
                </h3>
              </div>
              {strategy.description && (
                <p
                  className="text-xs leading-relaxed line-clamp-2"
                  style={{ color: 'var(--text-3)' }}
                >
                  {strategy.description}
                </p>
              )}
            </div>

            {/* Edit/Delete - erscheint beim Hover */}
            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={e => { e.stopPropagation(); setShowEdit(true) }}
                className="w-7 h-7 flex items-center justify-center rounded-md cursor-pointer transition-all"
                style={{ color: 'var(--text-3)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-bg)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-3)'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={e => { e.stopPropagation(); handleDelete() }}
                disabled={isPending}
                className="w-7 h-7 flex items-center justify-center rounded-md cursor-pointer transition-all"
                style={{ color: 'var(--text-3)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--red)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,69,96,0.1)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-3)'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
              >
                {isPending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              </button>
            </div>
          </div>

          {/* Meta-Badges */}
          <div className="flex flex-wrap gap-1.5">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium"
              style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
            >
              <Clock size={10} />
              {strategy.timeframe}
              <span style={{ color: 'var(--text-3)' }}>- {TIMEFRAME_LABELS[strategy.timeframe]}</span>
            </span>
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium"
              style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
            >
              <Shield size={10} />
              {strategy.riskPerTrade}% Risiko
            </span>
          </div>

          {/* Setup-Regeln (wenn vorhanden) */}
          {normalizeRules(strategy.rules).length > 0 && (
            <ul
              className="flex flex-col gap-1"
              style={{ borderLeft: `2px solid ${strategy.color}44`, paddingLeft: 8 }}
            >
              {normalizeRules(strategy.rules).slice(0, 3).map((rule, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-xs font-mono mt-0.5 shrink-0" style={{ color: strategy.color + '99' }}>
                    {i + 1}.
                  </span>
                  <span className="text-xs leading-relaxed line-clamp-1" style={{ color: 'var(--text-3)' }}>
                    {rule}
                  </span>
                </li>
              ))}
              {normalizeRules(strategy.rules).length > 3 && (
                <li className="text-xs" style={{ color: 'var(--text-3)' }}>
                  +{normalizeRules(strategy.rules).length - 3} weitere
                </li>
              )}
            </ul>
          )}

          {/* Statistiken */}
          <div
            className="grid grid-cols-3 gap-2 mt-auto pt-3"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            <div className="text-center">
              <p className="text-xs mb-0.5" style={{ color: 'var(--text-3)' }}>Trades</p>
              <p className="text-sm font-bold font-mono" style={{ color: 'var(--text-1)' }}>
                {allLinked.length}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs mb-0.5" style={{ color: 'var(--text-3)' }}>Win Rate</p>
              <p
                className="text-sm font-bold font-mono"
                style={{
                  color: winRate === null ? 'var(--text-3)' : winRate >= 50 ? 'var(--green)' : 'var(--red)'
                }}
              >
                {winRate === null ? '-' : `${winRate}%`}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs mb-0.5" style={{ color: 'var(--text-3)' }}>P&L</p>
              <p
                className="text-sm font-bold font-mono"
                style={{
                  color: linked.length === 0 ? 'var(--text-3)' : totalPnl >= 0 ? 'var(--green)' : 'var(--red)'
                }}
              >
                {linked.length === 0
                  ? '-'
                  : `${totalPnl >= 0 ? '+' : ''}${totalPnl.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${currencySymbol(currency)}`
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showEdit && <StrategyModal strategy={strategy} onClose={() => setShowEdit(false)} />}
      </AnimatePresence>
    </>
  )
}
