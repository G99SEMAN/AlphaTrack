'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { currencySymbol } from '@/lib/currency'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, SlidersHorizontal, TrendingUp, TrendingDown, BookOpen, Upload } from 'lucide-react'
import { Trade } from '@/types/trade'
import { Strategy } from '@/types/strategy'
import { BotEntry } from '@/types/bot'
import { resolveBotLabel } from '@/lib/bot-source'
import TradeRow from './TradeRow'
import TradeModal from './TradeModal'
import ImportModal from './ImportModal'

interface Props {
  trades: Trade[]
  strategies: Strategy[]
  currency: string
  startCapital: number
  broker?: string
  bots?: BotEntry[]
}

type FilterStatus = 'all' | 'open' | 'closed' | 'cancelled'
type FilterDir = 'all' | 'long' | 'short'
type SortKey = 'date' | 'pnl' | 'instrument'

export default function JournalClient({ trades: initialTrades, strategies, currency, startCapital, broker, bots = [] }: Props) {
  const [trades, setTrades] = useState<Trade[]>(initialTrades)
  const [showModal, setShowModal] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [filterDir, setFilterDir] = useState<FilterDir>('all')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortAsc, setSortAsc] = useState(false)
  const [page, setPage] = useState(1)

  const PAGE_SIZE = 100

  const fetchTrades = useCallback(async () => {
    try {
      const res = await fetch('/api/trades', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setTrades(data.trades)
    } catch { /* silent - Offline oder Server-Fehler */ }
  }, [])

  useEffect(() => {
    fetchTrades()
    const id = setInterval(fetchTrades, 10_000)
    return () => clearInterval(id)
  }, [fetchTrades])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(v => !v)
    else { setSortKey(key); setSortAsc(false) }
    setPage(1)
  }

  function resetPage() { setPage(1) }

  function resolveSourceLabel(trade: Trade): string | undefined {
    return resolveBotLabel(trade.sourceId, bots)
  }

  const filtered = useMemo(() => trades
    .filter(t => {
      if (filterStatus !== 'all' && t.status !== filterStatus) return false
      if (filterDir !== 'all' && t.type !== filterDir) return false
      if (search) {
        const q = search.toLowerCase()
        if (!t.instrument.toLowerCase().includes(q) && !(t.notes ?? '').toLowerCase().includes(q) && !(t.tags ?? []).some(tag => tag.toLowerCase().includes(q))) return false
      }
      return true
    })
    .sort((a, b) => {
      // Offene Trades immer oben, unabhängig vom gewählten Sortierfeld
      if (sortKey === 'date') {
        const aOpen = a.status === 'open'
        const bOpen = b.status === 'open'
        if (aOpen !== bOpen) return aOpen ? -1 : 1
        if (aOpen) {
          // Beide offen: nach Öffnungsdatum aufsteigend (älteste oben)
          const diff = a.date < b.date ? -1 : a.date > b.date ? 1 : 0
          return diff
        }
        // Beide geschlossen/cancelled: nach Schlussdatum absteigend (neueste oben)
        const aClose = a.closeTime ?? a.date
        const bClose = b.closeTime ?? b.date
        return aClose > bClose ? -1 : aClose < bClose ? 1 : 0
      }
      let diff = 0
      if (sortKey === 'pnl') diff = (a.pnl ?? 0) - (b.pnl ?? 0)
      else if (sortKey === 'instrument') diff = a.instrument.localeCompare(b.instrument)
      return sortAsc ? diff : -diff
    }),
    [trades, filterStatus, filterDir, search, sortKey, sortAsc]
  )

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const safePage = Math.min(page, Math.max(1, totalPages))
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const { totalPnl, winRate, allClosedCount, openCount } = useMemo(() => {
    const closed = trades.filter(t => t.status === 'closed' && t.pnl !== undefined)
    const paper = trades.filter(t => t.pnl === undefined && t.outcome !== undefined)
    const pnl = closed.reduce((s, t) => s + (t.pnl ?? 0), 0)
    const wins = closed.filter(t => (t.pnl ?? 0) > 0).length
    const paperWins = paper.filter(t => t.outcome === 'win').length
    const allClosed = closed.length + paper.length
    return {
      totalPnl: pnl,
      winRate: allClosed > 0 ? Math.round(((wins + paperWins) / allClosed) * 100) : 0,
      allClosedCount: allClosed,
      openCount: trades.filter(t => t.status === 'open').length,
    }
  }, [trades])

  const summaryCards = [
    {
      label: 'Gesamt P&L',
      value: `${totalPnl >= 0 ? '+' : ''}${totalPnl.toLocaleString('de-DE', { minimumFractionDigits: 2 })} ${currencySymbol(currency)}`,
      color: totalPnl >= 0 ? 'var(--green)' : 'var(--red)',
    },
    {
      label: 'Win Rate',
      value: `${winRate}%`,
      color: winRate >= 50 ? 'var(--green)' : 'var(--red)',
    },
    {
      label: 'Trades gesamt',
      value: `${allClosedCount} / ${trades.length}`,
      color: 'var(--text-1)',
      sub: 'geschlossen / alle',
    },
    {
      label: 'Offene Trades',
      value: String(openCount),
      color: openCount > 0 ? 'var(--accent)' : 'var(--text-2)',
    },
  ]

  return (
    <div className="flex flex-col gap-5">

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summaryCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="rounded-xl px-4 py-3.5"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-3)' }}>
              {card.label}
            </p>
            <p className="text-sm sm:text-lg font-bold font-mono leading-tight break-all" style={{ color: card.color }}>
              {card.value}
            </p>
            {card.sub && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{card.sub}</p>
            )}
          </motion.div>
        ))}
      </div>

      {/* Trade-Liste */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {/* Toolbar */}
        <div
          className="flex flex-col gap-2 px-4 py-3"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          {/* Zeile 1: Suche */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <Search size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); resetPage() }}
              placeholder="Instrument, Tag oder Notiz suchen..."
              className="flex-1 text-sm bg-transparent outline-none"
              style={{ color: 'var(--text-1)' }}
            />
          </div>

          {/* Zeile 2: Filter Status + Richtung + Action-Buttons in einer Zeile */}
          <div className="flex items-center gap-1 flex-wrap">
            <SlidersHorizontal size={13} style={{ color: 'var(--text-3)', flexShrink: 0 }} />

            {/* Status-Filter */}
            {(['all', 'cancelled'] as FilterStatus[]).map(s => (
              <button
                key={s}
                onClick={() => { setFilterStatus(s); resetPage() }}
                className="px-2 py-1 rounded-md text-xs font-medium cursor-pointer transition-all"
                style={{
                  background: filterStatus === s ? 'var(--accent-bg)' : 'transparent',
                  color: filterStatus === s ? 'var(--accent)' : 'var(--text-3)',
                  border: `1px solid ${filterStatus === s ? 'var(--accent)' : 'transparent'}`,
                }}
              >
                {s === 'all' ? 'Alle' : 'Abgebr.'}
              </button>
            ))}

            {/* Trennlinie */}
            <span style={{ width: 1, height: 14, background: 'var(--border)', margin: '0 2px', flexShrink: 0 }} />

            {/* Richtungsfilter */}
            {([
              { val: 'all', label: 'Beide' },
              { val: 'long', label: 'Long' },
              { val: 'short', label: 'Short' },
            ] as { val: FilterDir; label: string }[]).map(({ val, label }) => (
              <button
                key={val}
                onClick={() => { setFilterDir(val); resetPage() }}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium cursor-pointer transition-all"
                style={{
                  background: filterDir === val
                    ? val === 'long' ? 'rgba(0,217,126,0.1)' : val === 'short' ? 'rgba(255,69,96,0.1)' : 'var(--surface-2)'
                    : 'transparent',
                  color: filterDir === val
                    ? val === 'long' ? 'var(--green)' : val === 'short' ? 'var(--red)' : 'var(--text-2)'
                    : 'var(--text-3)',
                }}
              >
                {val === 'long' && <TrendingUp size={10} />}
                {val === 'short' && <TrendingDown size={10} />}
                {label}
              </button>
            ))}

            {/* Action-Buttons rechtsbündig */}
            <div className="flex items-center gap-1.5 ml-auto">
              <button
                onClick={() => setShowImport(true)}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                style={{
                  background: 'var(--surface-2)',
                  color: 'var(--text-2)',
                  border: '1px solid var(--border)',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-2)' }}
              >
                <Upload size={13} />
                <span className="hidden sm:inline">Import</span>
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                style={{ background: 'var(--accent)', color: '#fff' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.9' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
              >
                <Plus size={14} />
                Trade
              </button>
            </div>
          </div>
        </div>

        {/* Tabellen-Header */}
        <div
          className="hidden md:flex items-center gap-3 px-4 py-2 text-xs font-semibold uppercase tracking-wide"
          style={{ color: 'var(--text-3)', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}
        >
          {/* Richtungs-Icon Platzhalter */}
          <div className="w-8 shrink-0" />
          {/* Instrument */}
          <button onClick={() => toggleSort('instrument')} className="flex-1 min-w-0 text-left cursor-pointer hover:text-inherit transition-colors">
            Instrument {sortKey === 'instrument' ? (sortAsc ? '↑' : '↓') : ''}
          </button>
          {/* Status - min-w passt zu StatusBadge "Geschlossen" */}
          <div className="shrink-0" style={{ minWidth: 88 }}>Status</div>
          {/* Einstieg */}
          <div className="text-right shrink-0" style={{ minWidth: 70 }}>Einstieg</div>
          {/* P&L */}
          <button onClick={() => toggleSort('pnl')} className="text-right shrink-0 cursor-pointer hover:text-inherit transition-colors" style={{ minWidth: 80 }}>
            P&L {sortKey === 'pnl' ? (sortAsc ? '↑' : '↓') : ''}
          </button>
          {/* RR */}
          <div className="hidden lg:block text-right shrink-0" style={{ minWidth: 50 }}>RR</div>
          {/* Actions Platzhalter: 3× w-7 (28px) + 2× gap-1 (4px) = 92px */}
          <div className="shrink-0" style={{ width: 92 }} />
          {/* Expand-Icon Platzhalter */}
          <div className="shrink-0" style={{ width: 14 }} />
        </div>

        {/* Trade-Zeilen */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <BookOpen size={36} style={{ color: 'var(--text-3)', opacity: 0.4 }} />
            <p className="text-sm font-medium" style={{ color: 'var(--text-3)' }}>
              {trades.length === 0 ? 'Noch keine Trades eingetragen' : 'Keine Trades mit diesen Filtern'}
            </p>
            {trades.length === 0 && (
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer mt-1"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                <Plus size={14} />
                Ersten Trade hinzufugen
              </button>
            )}
          </div>
        ) : (
          <div>
            {paginated.map(trade => (
              <TradeRow key={trade.id} trade={trade} strategies={strategies} broker={broker} currency={currency} startCapital={startCapital} onRefresh={fetchTrades} sourceLabel={resolveSourceLabel(trade)} />
            ))}
          </div>
        )}

        {/* Footer + Pagination */}
        {filtered.length > 0 && (
          <div
            className="px-4 py-2.5 flex items-center justify-between gap-4 flex-wrap"
            style={{ color: 'var(--text-3)', borderTop: '1px solid var(--border)' }}
          >
            <span className="text-xs">
              {filtered.length === trades.length
                ? `${trades.length} Trades`
                : `${filtered.length} von ${trades.length} Trades`}
              {totalPages > 1 && ` · Seite ${safePage} / ${totalPages}`}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="px-3 py-1 rounded-md text-xs font-medium cursor-pointer transition-all"
                  style={{
                    background: 'var(--surface-2)',
                    color: safePage === 1 ? 'var(--text-3)' : 'var(--text-1)',
                    border: '1px solid var(--border)',
                    opacity: safePage === 1 ? 0.5 : 1,
                  }}
                >
                  Zurück
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                  .map(p => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className="w-7 h-7 rounded-md text-xs font-medium cursor-pointer transition-all"
                      style={{
                        background: p === safePage ? 'var(--accent)' : 'var(--surface-2)',
                        color: p === safePage ? '#fff' : 'var(--text-2)',
                        border: `1px solid ${p === safePage ? 'var(--accent)' : 'var(--border)'}`,
                      }}
                    >
                      {p}
                    </button>
                  ))}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="px-3 py-1 rounded-md text-xs font-medium cursor-pointer transition-all"
                  style={{
                    background: 'var(--surface-2)',
                    color: safePage === totalPages ? 'var(--text-3)' : 'var(--text-1)',
                    border: '1px solid var(--border)',
                    opacity: safePage === totalPages ? 0.5 : 1,
                  }}
                >
                  Weiter
                </button>
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Modals */}
      <AnimatePresence>
        {showModal && <TradeModal strategies={strategies} broker={broker} onClose={() => { setShowModal(false); void fetchTrades() }} />}
      </AnimatePresence>
      <AnimatePresence>
        {showImport && (
          <ImportModal
            onClose={() => { setShowImport(false); void fetchTrades() }}
            existingExternalIds={new Set(trades.map(t => t.externalId).filter(Boolean) as string[])}
            profileStartCapital={startCapital}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
