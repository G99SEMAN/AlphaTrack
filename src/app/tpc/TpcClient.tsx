'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trade } from '@/types/trade'

interface DayStats {
  date: string
  totalPnl: number
  tradeCount: number
  wins: number
  losses: number
  trades: Trade[]
}

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]
const DAY_HEADERS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

interface Props {
  profileId: string
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

export default function TpcClient({ profileId }: Props) {
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [days, setDays] = useState<DayStats[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const fetchDays = useCallback(async () => {
    setLoading(true)
    setSelectedDate(null)
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`
    try {
      const res = await fetch(`/api/tpc?month=${monthStr}&profileId=${profileId}`)
      if (res.ok) {
        const data = await res.json() as { days: DayStats[] }
        setDays(data.days)
      }
    } finally {
      setLoading(false)
    }
  }, [year, month, profileId])

  useEffect(() => { fetchDays() }, [fetchDays])

  const dayMap = new Map(days.map(d => [d.date, d]))
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOffset = (new Date(year, month, 1).getDay() + 6) % 7
  const totalCells = firstDayOffset + daysInMonth
  const trailingCells = (7 - (totalCells % 7)) % 7

  const selectedStats = selectedDate ? dayMap.get(selectedDate) ?? null : null

  function navMonth(delta: number) {
    setCurrentDate(new Date(year, month + delta, 1))
  }

  return (
    <div>
      <div className="mb-5 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>
            Trading Performance Kalender
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>
            Tägliche P&L Übersicht aller Trades
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navMonth(-1)}
            className="p-2 rounded-xl"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
            aria-label="Vorheriger Monat"
          >
            <ChevronLeft size={18} />
          </button>
          <span
            className="font-semibold text-sm text-center"
            style={{ color: 'var(--text-1)', minWidth: 130 }}
          >
            {MONTH_NAMES[month]} {year}
          </span>
          <button
            onClick={() => navMonth(1)}
            className="p-2 rounded-xl"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
            aria-label="Nächster Monat"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="grid grid-cols-7" style={{ borderBottom: '1px solid var(--border)' }}>
          {DAY_HEADERS.map(d => (
            <div
              key={d}
              className="p-2 text-center text-xs font-medium"
              style={{ color: 'var(--text-3)' }}
            >
              {d}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center" style={{ height: 300 }}>
            <p style={{ color: 'var(--text-3)' }}>Lädt…</p>
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {Array.from({ length: firstDayOffset }).map((_, i) => (
              <div
                key={`s${i}`}
                style={{ borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', minHeight: 80 }}
              />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const stats = dayMap.get(dateStr)
              const isSelected = selectedDate === dateStr
              const isProfit = !!stats && stats.totalPnl > 0
              const isLoss = !!stats && stats.totalPnl < 0

              let bg = 'transparent'
              if (isProfit) bg = 'var(--green-bg)'
              if (isLoss) bg = 'var(--red-bg)'

              let accentColor = isProfit ? 'var(--green)' : isLoss ? 'var(--red)' : 'var(--text-3)'

              return (
                <motion.div
                  key={dateStr}
                  whileHover={stats ? { opacity: 0.8 } : {}}
                  onClick={() => stats && setSelectedDate(isSelected ? null : dateStr)}
                  style={{
                    borderRight: '1px solid var(--border)',
                    borderBottom: '1px solid var(--border)',
                    minHeight: 80,
                    background: bg,
                    cursor: stats ? 'pointer' : 'default',
                    outline: isSelected ? `2px solid ${accentColor}` : 'none',
                    outlineOffset: '-2px',
                    padding: 8,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <p className="text-xs font-medium mb-1" style={{ color: accentColor }}>
                    {day}
                  </p>
                  {stats && (
                    <>
                      <p
                        className="text-xs font-mono font-bold leading-tight"
                        style={{ color: isProfit ? 'var(--green)' : 'var(--red)' }}
                      >
                        {stats.totalPnl >= 0 ? '+' : ''}
                        {stats.totalPnl.toLocaleString('de-DE', { maximumFractionDigits: 0 })}€
                      </p>
                      <p className="text-xs mt-auto" style={{ color: 'var(--text-3)' }}>
                        {stats.tradeCount}T {stats.wins}W {stats.losses}L
                      </p>
                    </>
                  )}
                </motion.div>
              )
            })}

            {Array.from({ length: trailingCells }).map((_, i) => (
              <div
                key={`e${i}`}
                style={{ borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', minHeight: 80 }}
              />
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedStats && selectedDate && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className="mt-4 rounded-2xl p-5"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold" style={{ color: 'var(--text-1)' }}>
                Trades am {formatDisplayDate(selectedDate)}
              </h2>
              <button onClick={() => setSelectedDate(null)} aria-label="Schließen">
                <X size={18} style={{ color: 'var(--text-3)' }} />
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {['Instrument', 'Richtung', 'P&L'].map(h => (
                      <th
                        key={h}
                        className={`pb-2 font-medium text-xs ${h === 'P&L' ? 'text-right' : 'text-left'}`}
                        style={{ color: 'var(--text-3)' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selectedStats.trades.map(t => {
                    const pnl = t.pnl ?? 0
                    return (
                      <tr key={t.id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td className="py-2 font-mono text-xs" style={{ color: 'var(--text-1)' }}>
                          {t.instrument}
                        </td>
                        <td className="py-2 text-xs" style={{ color: 'var(--text-2)' }}>
                          {t.type === 'long' ? 'Long' : 'Short'}
                        </td>
                        <td
                          className="py-2 text-right font-mono text-xs"
                          style={{ color: pnl >= 0 ? 'var(--green)' : 'var(--red)' }}
                        >
                          {pnl >= 0 ? '+' : ''}
                          {pnl.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
