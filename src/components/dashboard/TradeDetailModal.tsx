'use client'

import { useEffect } from 'react'
import { X, ArrowLeft } from 'lucide-react'
import { Trade } from '@/types/trade'
import { currencySymbol } from '@/lib/currency'

interface TradeDetailModalProps {
  trade: Trade
  currency: string
  onBack: () => void
  onClose: () => void
}

function toTvSymbol(instrument: string): string {
  const base = instrument.split(/[._]/)[0]
  const clean = base.replace(/[^A-Za-z]/g, '').toUpperCase()
  if (/^[A-Z]{6}$/.test(clean)) return `FX:${clean}`
  return clean
}

function fmtDuration(open: string, close?: string): string {
  if (!close) return '—'
  const ms = new Date(close).getTime() - new Date(open).getTime()
  if (ms <= 0) return '—'
  const mins = Math.floor(ms / 60000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function fmtNum(val: number | undefined, decimals = 2): string {
  if (val == null) return '—'
  return val.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function FieldRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', borderRadius: 8, background: 'var(--surface-2)' }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </span>
      <span style={{ fontSize: 13, fontWeight: 700, color: color ?? 'var(--text-1)', fontFamily: 'var(--font-dm-mono)' }}>
        {value}
      </span>
    </div>
  )
}

export default function TradeDetailModal({ trade, currency, onBack, onClose }: TradeDetailModalProps) {
  const sym = currencySymbol(currency)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onBack() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onBack])

  const netPnl = (trade.pnl ?? 0) - (trade.commission ?? 0) - (trade.swap ?? 0)
  const tvSrc = `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(toTvSymbol(trade.instrument))}&interval=15&theme=dark&style=1&locale=de&hide_side_toolbar=0&allow_symbol_change=0&save_image=0`

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
      onClick={onBack}
    >
      <div
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, width: '90vw', maxWidth: 1200, height: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 64px rgba(0,0,0,0.5)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <button
            onClick={onBack}
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: 'var(--text-2)', fontSize: 13, fontWeight: 600, flexShrink: 0 }}
          >
            <ArrowLeft size={14} />
            Zurück
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)' }}>{trade.instrument}</span>
            <span style={{ fontSize: 13, color: 'var(--text-3)', marginLeft: 12 }}>{fmtDateTime(trade.date)}</span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-2)', flexShrink: 0 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

          {/* Left: Trade Fields */}
          <div style={{ width: 280, flexShrink: 0, overflowY: 'auto', borderRight: '1px solid var(--border)', padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <FieldRow label="Net P&L" value={`${netPnl >= 0 ? '+' : '-'}${sym}${Math.abs(netPnl).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} color={netPnl >= 0 ? 'var(--green)' : 'var(--red)'} />
            <FieldRow label="Gross P&L" value={`${sym}${fmtNum(trade.pnl)}`} />
            <FieldRow
              label="Side"
              value={trade.type === 'long' ? 'LONG' : 'SHORT'}
              color={trade.type === 'long' ? '#60a5fa' : '#fb923c'}
            />
            <FieldRow label="Entry" value={fmtNum(trade.entry)} />
            <FieldRow label="Exit" value={fmtNum(trade.exit)} />
            <FieldRow label="Stop Loss" value={fmtNum(trade.sl)} />
            <FieldRow label="Take Profit" value={fmtNum(trade.tp)} />
            <FieldRow label="Size" value={fmtNum(trade.size)} />
            <FieldRow label="Commission" value={trade.commission != null ? `${sym}${fmtNum(trade.commission)}` : '—'} />
            <FieldRow label="Swap" value={trade.swap != null ? `${sym}${fmtNum(trade.swap)}` : '—'} />
            <FieldRow label="R:R" value={trade.rr != null ? `${fmtNum(trade.rr)}R` : '—'} />
            <FieldRow label="Laufzeit" value={fmtDuration(trade.date, trade.closeTime)} />
            <FieldRow label="Eröffnet" value={fmtDateTime(trade.date)} />
            <FieldRow label="Geschlossen" value={trade.closeTime ? fmtDateTime(trade.closeTime) : '—'} />

            {trade.notes && (
              <div style={{ marginTop: 4, padding: '10px 12px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Notes</div>
                <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5, margin: 0 }}>{trade.notes}</p>
              </div>
            )}

            {trade.tags && trade.tags.length > 0 && (
              <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {trade.tags.map(tag => (
                  <span key={tag} style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: 'var(--accent-bg)', color: 'var(--accent)' }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Right: TradingView Chart */}
          <div style={{ flex: 1, minWidth: 0, padding: 12 }}>
            <iframe
              src={tvSrc}
              sandbox="allow-scripts allow-same-origin"
              referrerPolicy="no-referrer"
              style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8, display: 'block' }}
              title={`Chart ${trade.instrument}`}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
