'use client'

import { useState, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, TrendingDown, Pencil, Trash2, ChevronDown, ChevronUp, Loader2, Target, ImageIcon, Share2, MoreVertical, X, ZoomIn, ZoomOut, Bot } from 'lucide-react'
import { Trade } from '@/types/trade'
import { Strategy } from '@/types/strategy'
import { deleteTradeAction } from '@/lib/actions'
import TradeModal from './TradeModal'
import TradeShareModal from './TradeShareModal'

interface Props {
  trade: Trade
  strategies: Strategy[]
  broker?: string
  currency?: string
  startCapital?: number
  onRefresh?: () => void
  sourceLabel?: string
}

function isSafeScreenshotUrl(url: string): boolean {
  return url.startsWith('/') || url.startsWith('data:image/') || /^https?:\/\//.test(url)
}

function StatusBadge({ status }: { status: Trade['status'] }) {
  const map = {
    open:      { label: 'Offen',        color: 'var(--accent)',  bg: 'rgba(59,130,246,0.12)' },
    closed:    { label: 'Geschlossen',  color: 'var(--green)',   bg: 'rgba(0,217,126,0.12)' },
    cancelled: { label: 'Abgebrochen',  color: 'var(--text-3)',  bg: 'var(--surface-2)' },
  }
  const { label, color, bg } = map[status]
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold"
      style={{ color, background: bg }}
    >
      {label}
    </span>
  )
}

export default function TradeRow({ trade, strategies, broker, currency, startCapital, onRefresh, sourceLabel }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [showLightbox, setShowLightbox] = useState(false)
  const [lightboxZoomed, setLightboxZoomed] = useState(false)
  const [isPending, startTransition] = useTransition()

  const isLong = trade.type === 'long'
  const pnlPositive = (trade.pnl ?? 0) > 0
  const hasPnl = trade.pnl != null
  const date = new Date(trade.date)
  const strategy = trade.strategyId ? strategies.find(s => s.id === trade.strategyId) : undefined

  function handleDelete() {
    if (!confirm(`Trade "${trade.instrument}" wirklich loschen?`)) return
    startTransition(async () => {
      await deleteTradeAction(trade.id)
      onRefresh?.()
    })
  }

  return (
    <>
      {/* Hauptzeile */}
      <div
        className="group flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all"
        style={{ borderBottom: '1px solid var(--border)' }}
        onClick={() => setExpanded(v => !v)}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-2)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--surface)' }}
      >
        {/* Richtungs-Indikator */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: isLong ? 'rgba(0,217,126,0.12)' : 'rgba(255,69,96,0.12)',
          }}
        >
          {isLong
            ? <TrendingUp size={15} style={{ color: 'var(--green)' }} />
            : <TrendingDown size={15} style={{ color: 'var(--red)' }} />
          }
        </div>

        {/* Instrument + Datum + Strategie */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight truncate" style={{ color: 'var(--text-1)' }}>
            {trade.instrument}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <p className="text-xs shrink-0" style={{ color: 'var(--text-3)' }}>
              {date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              {' '}
              {date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </p>
            {/* Status-Badge auf Mobile in der linken Spalte */}
            <div className="sm:hidden shrink-0">
              <StatusBadge status={trade.status} />
            </div>
            {sourceLabel && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold shrink-0 max-w-32 truncate"
                style={{ background: 'rgba(59,130,246,0.12)', color: 'var(--accent)', border: '1px solid rgba(59,130,246,0.25)' }}
                title={`Quelle: ${sourceLabel}`}
              >
                <Bot size={10} className="shrink-0" />
                {sourceLabel}
              </span>
            )}
            {trade.tp != null && (
              <span
                className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold shrink-0"
                style={{ background: 'rgba(0,217,126,0.12)', color: 'var(--green)', border: '1px solid rgba(0,217,126,0.25)' }}
              >
                TP
              </span>
            )}
            {trade.sl != null && (
              <span
                className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold shrink-0"
                style={{ background: 'rgba(255,69,96,0.12)', color: 'var(--red)', border: '1px solid rgba(255,69,96,0.25)' }}
              >
                SL
              </span>
            )}
            {trade.screenshot && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium shrink-0"
                style={{ background: 'var(--surface-2)', color: 'var(--text-3)', border: '1px solid var(--border)' }}
              >
                <ImageIcon size={9} />
              </span>
            )}
            {strategy && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium max-w-[110px] truncate"
                style={{
                  background: strategy.color + '22',
                  color: strategy.color,
                  border: `1px solid ${strategy.color}44`,
                }}
              >
                <Target size={9} className="shrink-0" />
                <span className="truncate">{strategy.name}</span>
              </span>
            )}
          </div>
        </div>

        {/* Status - nur ab sm sichtbar */}
        <div className="hidden sm:block shrink-0" style={{ minWidth: 88 }}>
          <StatusBadge status={trade.status} />
        </div>

        {/* Entry */}
        <div className="hidden md:block text-right shrink-0" style={{ minWidth: 70 }}>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>Einstieg</p>
          <p className="text-sm font-mono font-medium" style={{ color: 'var(--text-1)' }}>
            {trade.entry.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* P&L */}
        <div className="text-right shrink-0 min-w-[60px] sm:min-w-[80px]">
          {hasPnl ? (
            <>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>P&L</p>
              <p
                className="text-sm font-mono font-bold"
                style={{ color: pnlPositive ? 'var(--green)' : 'var(--red)' }}
              >
                {pnlPositive ? '+' : ''}{trade.pnl!.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
              </p>
            </>
          ) : trade.outcome ? (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold"
              style={{
                background: trade.outcome === 'win' ? 'rgba(0,217,126,0.12)' : 'rgba(255,69,96,0.12)',
                color: trade.outcome === 'win' ? 'var(--green)' : 'var(--red)',
              }}
            >
              {trade.outcome === 'win' ? 'WIN' : 'LOSS'}
            </span>
          ) : (
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>-</p>
          )}
        </div>

        {/* RR */}
        <div className="hidden lg:block text-right shrink-0" style={{ minWidth: 50 }}>
          {trade.rr != null ? (
            <>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>RR</p>
              <p className="text-sm font-mono font-medium" style={{ color: 'var(--text-2)' }}>
                {trade.rr.toFixed(1)}R
              </p>
            </>
          ) : (
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>-</span>
          )}
        </div>

        {/* Mobile: Drei-Punkte-Button */}
        <div className="sm:hidden shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setShowMobileMenu(true)}
            className="w-8 h-8 flex items-center justify-center rounded-md cursor-pointer"
            style={{ color: 'var(--text-3)' }}
          >
            <MoreVertical size={16} />
          </button>
        </div>

        {/* Desktop: Action-Buttons */}
        <div
          className="hidden sm:flex items-center gap-1 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => setShowShare(true)}
            className="w-7 h-7 flex items-center justify-center rounded-md cursor-pointer transition-all"
            style={{ color: 'var(--text-3)' }}
            title="Trade teilen"
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#06d6a0'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(6,214,160,0.1)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-3)'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
          >
            <Share2 size={13} />
          </button>
          <button
            onClick={() => setShowEdit(true)}
            className="w-7 h-7 flex items-center justify-center rounded-md cursor-pointer transition-all"
            style={{ color: 'var(--text-3)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-bg)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-3)'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="w-7 h-7 flex items-center justify-center rounded-md cursor-pointer transition-all"
            style={{ color: 'var(--text-3)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--red)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,69,96,0.1)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-3)'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
          >
            {isPending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
          </button>
        </div>

        {/* Expand Icon */}
        <div style={{ color: 'var(--text-3)' }}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ overflow: 'hidden', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}
          >
            <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Öffnungszeit</p>
                <p className="text-sm font-mono font-medium" style={{ color: 'var(--text-1)' }}>
                  {date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  {' '}
                  {date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {trade.closeTime && (
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Schließzeit</p>
                  <p className="text-sm font-mono font-medium" style={{ color: 'var(--text-1)' }}>
                    {new Date(trade.closeTime).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    {' '}
                    {new Date(trade.closeTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Grosse / Lots</p>
                <p className="text-sm font-mono font-medium" style={{ color: 'var(--text-1)' }}>{trade.size}</p>
              </div>
              {trade.exit != null && (
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Ausstieg</p>
                  <p className="text-sm font-mono font-medium" style={{ color: 'var(--text-1)' }}>
                    {trade.exit.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              )}
              {trade.tp != null && (
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Take Profit</p>
                  <p className="text-sm font-mono font-medium" style={{ color: 'var(--green)' }}>
                    {trade.tp.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              )}
              {trade.sl != null && (
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Stop Loss</p>
                  <p className="text-sm font-mono font-medium" style={{ color: 'var(--red)' }}>
                    {trade.sl.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              )}
              <div className="sm:hidden">
                <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Status</p>
                <StatusBadge status={trade.status} />
              </div>
              {trade.rr != null && (
                <div className="lg:hidden">
                  <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Risk/Reward</p>
                  <p className="text-sm font-mono font-medium" style={{ color: 'var(--text-2)' }}>{trade.rr.toFixed(1)}R</p>
                </div>
              )}
              {strategy && (
                <div className="col-span-2 sm:col-span-4">
                  <p className="text-xs mb-1.5" style={{ color: 'var(--text-3)' }}>Strategie</p>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: strategy.color }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
                      {strategy.name}
                    </span>
                    <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-3)', color: 'var(--text-3)' }}>
                      {strategy.timeframe}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                      {strategy.riskPerTrade}% Risiko
                    </span>
                  </div>
                </div>
              )}
              {trade.tags && trade.tags.length > 0 && (
                <div className="col-span-2 sm:col-span-4">
                  <p className="text-xs mb-1.5" style={{ color: 'var(--text-3)' }}>Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {trade.tags.map(tag => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-md text-xs"
                        style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--border)' }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {(trade.commission != null || trade.swap != null || trade.spreadCost != null) && (
                <div className="col-span-2 sm:col-span-4">
                  <p className="text-xs mb-2" style={{ color: 'var(--text-3)' }}>Kosten & Gebühren</p>
                  <div className="flex flex-wrap gap-2">
                    {trade.commission != null && (
                      <span className="text-xs px-2 py-1 rounded-md font-mono" style={{ background: 'rgba(255,69,96,0.08)', color: 'var(--red)', border: '1px solid rgba(255,69,96,0.2)' }}>
                        Kommission: -{trade.commission.toFixed(2)}
                      </span>
                    )}
                    {trade.swap != null && (
                      <span className="text-xs px-2 py-1 rounded-md font-mono" style={{ background: 'rgba(255,69,96,0.08)', color: 'var(--red)', border: '1px solid rgba(255,69,96,0.2)' }}>
                        Swap: -{trade.swap.toFixed(2)}
                      </span>
                    )}
                    {trade.spreadCost != null && (
                      <span className="text-xs px-2 py-1 rounded-md font-mono" style={{ background: 'rgba(255,69,96,0.08)', color: 'var(--red)', border: '1px solid rgba(255,69,96,0.2)' }}>
                        Spread: -{trade.spreadCost.toFixed(2)}
                      </span>
                    )}
                    <span className="text-xs px-2 py-1 rounded-md font-mono font-semibold" style={{ background: 'rgba(255,69,96,0.12)', color: 'var(--red)', border: '1px solid rgba(255,69,96,0.25)' }}>
                      Gesamt: -{((trade.commission ?? 0) + (trade.swap ?? 0) + (trade.spreadCost ?? 0)).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
              {trade.notes && (
                <div className="col-span-2 sm:col-span-4">
                  <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Notizen</p>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>{trade.notes}</p>
                </div>
              )}
              {trade.screenshot && (
                <div className="col-span-2 sm:col-span-4">
                  <p className="text-xs mb-2" style={{ color: 'var(--text-3)' }}>Chart Screenshot</p>
                  <button
                    onClick={() => setShowLightbox(true)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer"
                    style={{
                      background: 'var(--surface-3)',
                      color: 'var(--text-2)',
                      border: '1px solid var(--border)',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-2)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)' }}
                  >
                    <ZoomIn size={14} />
                    Screenshot anzeigen
                  </button>
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Action Sheet */}
      <AnimatePresence>
        {showMobileMenu && (
          <>
            <motion.div
              className="fixed inset-0 z-40 sm:hidden"
              style={{ background: 'rgba(0,0,0,0.5)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileMenu(false)}
            />
            <motion.div
              className="fixed left-0 right-0 bottom-0 z-50 sm:hidden rounded-t-2xl overflow-hidden"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            >
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
                  {trade.instrument}
                </p>
              </div>
              <button
                onClick={() => { setShowShare(true); setShowMobileMenu(false) }}
                className="w-full flex items-center gap-3 px-4 py-4 text-sm font-medium cursor-pointer"
                style={{ color: 'var(--text-1)', borderBottom: '1px solid var(--border)' }}
              >
                <Share2 size={16} style={{ color: 'var(--text-3)' }} />
                Teilen
              </button>
              <button
                onClick={() => { setShowEdit(true); setShowMobileMenu(false) }}
                className="w-full flex items-center gap-3 px-4 py-4 text-sm font-medium cursor-pointer"
                style={{ color: 'var(--accent)', borderBottom: '1px solid var(--border)' }}
              >
                <Pencil size={16} />
                Bearbeiten
              </button>
              <button
                onClick={() => { setShowMobileMenu(false); handleDelete() }}
                disabled={isPending}
                className="w-full flex items-center gap-3 px-4 py-4 text-sm font-medium cursor-pointer"
                style={{ color: 'var(--red)', borderBottom: '1px solid var(--border)' }}
              >
                {isPending ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Loschen
              </button>
              <button
                onClick={() => setShowMobileMenu(false)}
                className="w-full flex items-center justify-center px-4 py-4 text-sm font-semibold cursor-pointer"
                style={{ color: 'var(--text-3)' }}
              >
                Abbrechen
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Lightbox */}
      <AnimatePresence>
        {showLightbox && trade.screenshot && (
          <motion.div
            className="fixed inset-0 z-50 flex items-start justify-center"
            style={{
              background: 'rgba(0,0,0,0.85)',
              backdropFilter: 'blur(4px)',
              overflowY: lightboxZoomed ? 'auto' : 'hidden',
              padding: lightboxZoomed ? '48px 16px 32px' : '16px',
              alignItems: lightboxZoomed ? 'flex-start' : 'center',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setShowLightbox(false); setLightboxZoomed(false) }}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="relative"
              style={{ width: lightboxZoomed ? 'max-content' : '100%', maxWidth: lightboxZoomed ? 'none' : '5xl' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Toolbar */}
              <div className="absolute -top-9 right-0 flex items-center gap-2">
                <button
                  onClick={() => setLightboxZoomed(v => !v)}
                  className="w-8 h-8 flex items-center justify-center rounded-full transition-all cursor-pointer"
                  style={{ color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.1)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.2)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.1)' }}
                  title={lightboxZoomed ? 'Verkleinern' : 'Originalgröße'}
                >
                  {lightboxZoomed ? <ZoomOut size={15} /> : <ZoomIn size={15} />}
                </button>
                <button
                  onClick={() => { setShowLightbox(false); setLightboxZoomed(false) }}
                  className="w-8 h-8 flex items-center justify-center rounded-full transition-all cursor-pointer"
                  style={{ color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.1)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.2)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.1)' }}
                >
                  <X size={15} />
                </button>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {isSafeScreenshotUrl(trade.screenshot) && <img
                src={trade.screenshot}
                alt="Chart Screenshot"
                onClick={() => setLightboxZoomed(v => !v)}
                className="rounded-xl transition-all"
                style={{
                  display: 'block',
                  width: lightboxZoomed ? 'auto' : '100%',
                  maxWidth: lightboxZoomed ? 'none' : '80vw',
                  height: 'auto',
                  maxHeight: lightboxZoomed ? 'none' : '85vh',
                  objectFit: 'contain',
                  border: '1px solid rgba(255,255,255,0.1)',
                  cursor: lightboxZoomed ? 'zoom-out' : 'zoom-in',
                }}
              />}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {showEdit && <TradeModal trade={trade} strategies={strategies} broker={broker} onClose={() => { setShowEdit(false); onRefresh?.() }} />}
      </AnimatePresence>

      {/* Share Modal */}
      <AnimatePresence>
        {showShare && (
          <TradeShareModal
            trade={trade}
            broker={broker ?? ''}
            currency={currency ?? 'EUR'}
            startCapital={startCapital ?? 0}
            strategies={strategies}
            onClose={() => setShowShare(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
