'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { X, FileText, Table, AlertCircle, Download } from 'lucide-react'
import { Trade } from '@/types/trade'

interface Props {
  trades: Trade[]
  filtered: Trade[]
  onClose: () => void
}

type ExportFormat = 'pdf' | 'csv'

function tradeYear(t: Trade): number {
  return new Date(t.closeTime ?? t.date).getFullYear()
}

export default function ExportModal({ trades, filtered, onClose }: Props) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const availableYears = useMemo(() => {
    const years = new Set(trades.map(tradeYear))
    return Array.from(years).sort((a, b) => b - a)
  }, [trades])

  const [format, setFormat] = useState<ExportFormat>('pdf')
  const [year, setYear] = useState<number | 'all'>(availableYears[0] ?? 'all')
  const [useJournalFilters, setUseJournalFilters] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const finalTrades = useMemo(() => {
    const basis = useJournalFilters ? filtered : trades
    const yearFiltered = year === 'all' ? basis : basis.filter(t => tradeYear(t) === year)
    return format === 'pdf' ? yearFiltered.filter(t => t.status === 'closed') : yearFiltered
  }, [trades, filtered, useJournalFilters, year, format])

  async function handleExport() {
    if (finalTrades.length === 0) return
    setIsExporting(true)
    setError(null)
    try {
      const res = await fetch('/api/journal/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format, year, tradeIds: finalTrades.map(t => t.id) }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Export fehlgeschlagen')
      }
      const blob = await res.blob()
      const date = new Date().toISOString().slice(0, 10)
      const ext = format === 'pdf' ? 'pdf' : 'csv'
      const filenamePrefix = format === 'pdf' ? 'alphatrack-steuerreport' : 'alphatrack-trades'
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${filenamePrefix}-${date}.${ext}`
      a.click()
      URL.revokeObjectURL(a.href)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export fehlgeschlagen')
    } finally {
      setIsExporting(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', zIndex: 9999 }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        onClick={e => e.stopPropagation()}
        className="w-full rounded-xl overflow-hidden flex flex-col"
        style={{ maxWidth: 440, background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 className="text-base font-bold" style={{ color: 'var(--text-1)' }}>Trades exportieren</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Als PDF-Steuerreport oder CSV-Rohdaten herunterladen</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer"
            style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Format */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-3)' }}>Format</p>
            <div className="flex gap-2">
              {([
                { val: 'pdf' as const, label: 'PDF (Steuerreport)', icon: FileText },
                { val: 'csv' as const, label: 'CSV (Rohdaten)', icon: Table },
              ]).map(({ val, label, icon: Icon }) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setFormat(val)}
                  className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all"
                  style={{
                    background: format === val ? 'var(--accent-bg)' : 'var(--surface-2)',
                    color: format === val ? 'var(--accent)' : 'var(--text-2)',
                    border: `1.5px solid ${format === val ? 'var(--accent)' : 'var(--border)'}`,
                  }}
                >
                  <Icon size={15} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Jahr */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-3)' }}>Jahr</p>
            <select
              value={year}
              onChange={e => setYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'var(--surface-2)', color: 'var(--text-1)', border: '1px solid var(--border)' }}
            >
              <option value="all">Alle Jahre</option>
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Journal-Filter übernehmen */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useJournalFilters}
              onChange={e => setUseJournalFilters(e.target.checked)}
            />
            <span className="text-sm" style={{ color: 'var(--text-2)' }}>
              Aktuelle Journal-Filter übernehmen (Status, Richtung, Bot, Suche)
            </span>
          </label>

          <p className="text-xs" style={{ color: 'var(--text-3)' }}>
            Für den Steuerreport werden nur geschlossene Trades berücksichtigt.
          </p>

          {finalTrades.length === 0 && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}>
              <AlertCircle size={14} style={{ color: '#f59e0b' }} />
              <p className="text-xs" style={{ color: '#f59e0b' }}>Keine Trades für diese Auswahl</p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <AlertCircle size={14} style={{ color: '#ef4444' }} />
              <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5" style={{ borderTop: '1px solid var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>
            {finalTrades.length} Trade{finalTrades.length !== 1 ? 's' : ''} ausgewählt
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
              style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
            >
              Abbrechen
            </button>
            <button
              type="button"
              disabled={finalTrades.length === 0 || isExporting}
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
              style={{
                background: finalTrades.length > 0 ? 'var(--accent)' : 'var(--surface-2)',
                color: finalTrades.length > 0 ? '#fff' : 'var(--text-3)',
                border: `1px solid ${finalTrades.length > 0 ? 'var(--accent)' : 'var(--border)'}`,
                cursor: finalTrades.length > 0 && !isExporting ? 'pointer' : 'not-allowed',
                opacity: finalTrades.length > 0 && !isExporting ? 1 : 0.6,
              }}
            >
              <Download size={14} />
              {isExporting ? 'Exportiere...' : 'Exportieren'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  )
}
