'use client'

import { Fragment, memo, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Trade } from '@/types/trade'
import { currencySymbol } from '@/lib/currency'
import DayModal from './DayModal'
import TradeDetailModal from './TradeDetailModal'

interface Props {
  trades: Trade[]
  currency: string
}

interface DayData {
  pnl: number
  count: number
  wins: number
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function fmtPnl(val: number): string {
  const abs = Math.abs(val)
  if (abs >= 1000) return `${val >= 0 ? '' : '-'}$${(abs / 1000).toFixed(1)}K`
  return `${val >= 0 ? '' : '-'}$${abs.toLocaleString('de-DE', { maximumFractionDigits: 0 })}`
}

function TradingCalendar({ trades, currency }: Props) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth()) // 0-indexed
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)

  const sym = currencySymbol(currency)

  const pnlByDay = useMemo(() => {
    const map = new Map<string, DayData>()
    for (const t of trades) {
      if (t.status !== 'closed' || t.pnl === undefined) continue
      const dateStr = (t.closeTime ?? t.date).slice(0, 10)
      const existing = map.get(dateStr) ?? { pnl: 0, count: 0, wins: 0 }
      existing.pnl += t.pnl
      existing.count++
      if (t.pnl > 0) existing.wins++
      map.set(dateStr, existing)
    }
    return map
  }, [trades])

  // Calendar grid
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  // Sunday=0, but we want Mon=0 (European)
  const startDow = (firstDay.getDay() + 6) % 7 // 0=Mon

  // Collect all days in grid (including leading empty cells)
  const days: (number | null)[] = []
  for (let i = 0; i < startDow; i++) days.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(d)
  // Pad to full weeks
  while (days.length % 7 !== 0) days.push(null)

  const weeks: (number | null)[][] = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))

  // Weekly summaries
  const weekSummaries = weeks.map((week, wi) => {
    let pnl = 0
    let tradingDays = 0
    for (const d of week) {
      if (d === null) continue
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const data = pnlByDay.get(key)
      if (data) { pnl += data.pnl; tradingDays++ }
    }
    // Montag dieser Grid-Zeile (auch bei Vor-/Nachmonats-Padding), für die echte ISO-Kalenderwoche
    const mondayOfRow = new Date(year, month, 1 - startDow + wi * 7)
    const isoWeek = getISOWeek(mondayOfRow)
    return { pnl, tradingDays, isoWeek }
  })

  // Monthly totals
  const monthlyPnl = weekSummaries.reduce((s, w) => s + w.pnl, 0)
  const monthlyTradingDays = weekSummaries.reduce((s, w) => s + w.tradingDays, 0)

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }
  function goToday() { setYear(now.getFullYear()); setMonth(now.getMonth()) }

  const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
  const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
  const todayStr = now.toISOString().slice(0, 10)

  return (
    <motion.div
      className="rounded-2xl flex flex-col"
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        boxShadow: 'var(--card-shadow)', padding: 16,
        position: 'relative', overflow: 'hidden',
      }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1 }}
    >
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: 'linear-gradient(90deg,transparent,rgba(59,130,246,0.18),transparent)',
      }} />

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={prevMonth} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-2)' }}>
            <ChevronLeft size={14} />
          </button>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', minWidth: 120, textAlign: 'center' }}>
            {monthNames[month]} {year}
          </span>
          <button onClick={nextMonth} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-2)' }}>
            <ChevronRight size={14} />
          </button>
        </div>

        <button
          onClick={goToday}
          style={{ fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer' }}
        >
          Dieser Monat
        </button>

        {/* Monthly stats */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 8,
            background: monthlyPnl >= 0 ? 'rgba(0,217,126,0.12)' : 'rgba(255,69,96,0.12)',
            color: monthlyPnl >= 0 ? 'var(--green)' : 'var(--red)',
            fontFamily: 'var(--font-dm-mono)',
          }}>
            {monthlyPnl >= 0 ? '+' : ''}{monthlyPnl.toLocaleString('de-DE', { maximumFractionDigits: 0 })} {sym}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 8, background: 'var(--accent-bg)', color: 'var(--accent)' }}>
            {monthlyTradingDays} {monthlyTradingDays === 1 ? 'Tag' : 'Tage'}
          </span>
        </div>
      </div>

      {/* Grid + Week column — ein gemeinsames Grid, damit KW-Boxen exakt auf Zeilenhöhe der jeweiligen Woche sitzen */}
      <div
        className="grid grid-cols-7 sm:[grid-template-columns:repeat(7,minmax(0,1fr))_130px]"
        style={{ gap: 3 }}
      >
        {/* Day headers */}
        {dayNames.map((d, di) => (
          <div key={d} style={{ gridColumn: di + 1, gridRow: 1, textAlign: 'center', fontSize: 10, fontWeight: 600, color: 'var(--text-3)', padding: '4px 0' }}>
            {d}
          </div>
        ))}
        <div className="hidden sm:flex" style={{ gridColumn: 8, gridRow: 1, alignItems: 'center' }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Woche</span>
        </div>

        {/* Weeks */}
        {weeks.map((week, wi) => {
          const ws = weekSummaries[wi]
          return (
            <Fragment key={wi}>
              {week.map((day, di) => {
                if (day === null) {
                  return <div key={di} style={{ gridColumn: di + 1, gridRow: wi + 2, aspectRatio: '1 / 0.85', borderRadius: 8 }} />
                }
                const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const data = pnlByDay.get(key)
                const isToday = key === todayStr
                const pnlPos = data ? data.pnl >= 0 : null
                const winPct = data && data.count > 0 ? Math.round((data.wins / data.count) * 100) : null

                let bg = 'var(--surface-2)'
                let borderColor = 'var(--border-subtle)'
                if (data) {
                  if (pnlPos) {
                    const intensity = Math.min(Math.abs(data.pnl) / 500, 1)
                    bg = `rgba(0, 217, 126, ${0.08 + intensity * 0.18})`
                    borderColor = `rgba(0, 217, 126, ${0.15 + intensity * 0.2})`
                  } else {
                    const intensity = Math.min(Math.abs(data.pnl) / 500, 1)
                    bg = `rgba(255, 69, 96, ${0.08 + intensity * 0.18})`
                    borderColor = `rgba(255, 69, 96, ${0.15 + intensity * 0.2})`
                  }
                }

                return (
                  <motion.div
                    key={di}
                    onClick={data ? () => setSelectedDay(key) : undefined}
                    style={{
                      gridColumn: di + 1,
                      gridRow: wi + 2,
                      aspectRatio: '1 / 0.85',
                      borderRadius: 8,
                      background: bg,
                      border: `1px solid ${isToday ? 'var(--accent)' : borderColor}`,
                      padding: '4px 5px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      cursor: data ? 'pointer' : 'default',
                      boxShadow: isToday ? '0 0 0 1px var(--accent)' : undefined,
                    }}
                    whileHover={data ? { scale: 1.03 } : {}}
                    transition={{ duration: 0.12 }}
                  >
                    <span style={{ fontSize: 9, fontWeight: 600, color: isToday ? 'var(--accent)' : 'var(--text-3)' }}>
                      {day}
                    </span>
                    {data && (
                      <>
                        <span style={{
                          fontSize: 9, fontWeight: 700,
                          color: pnlPos ? 'var(--green)' : 'var(--red)',
                          fontFamily: 'var(--font-dm-mono)',
                          lineHeight: 1.1,
                        }}>
                          {fmtPnl(data.pnl).replace('$', sym)}
                        </span>
                        <div>
                          <span style={{ fontSize: 8, color: 'var(--text-3)' }}>
                            {data.count} {data.count === 1 ? 'Trade' : 'Trades'}
                          </span>
                          {winPct !== null && (
                            <span style={{ fontSize: 8, color: pnlPos ? 'var(--green)' : 'var(--red)', display: 'block' }}>
                              {winPct}%
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </motion.div>
                )
              })}

              {/* Wochen-Summary — Höhe kommt aus derselben Grid-Zeile wie die Tageszellen (align-items: stretch) */}
              <div
                className="hidden sm:flex"
                style={{
                  gridColumn: 8,
                  gridRow: wi + 2,
                  borderRadius: 8,
                  background: ws.tradingDays > 0
                    ? (ws.pnl >= 0 ? 'rgba(0,217,126,0.06)' : 'rgba(255,69,96,0.06)')
                    : 'var(--surface-2)',
                  border: `1px solid ${ws.tradingDays > 0 ? (ws.pnl >= 0 ? 'rgba(0,217,126,0.15)' : 'rgba(255,69,96,0.15)') : 'var(--border-subtle)'}`,
                  padding: '8px 10px',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)' }}>KW {ws.isoWeek}</span>
                {ws.tradingDays > 0 ? (
                  <>
                    <span style={{
                      fontSize: 12, fontWeight: 700,
                      color: ws.pnl >= 0 ? 'var(--green)' : 'var(--red)',
                      fontFamily: 'var(--font-dm-mono)',
                    }}>
                      {ws.pnl >= 0 ? '+' : ''}{ws.pnl.toLocaleString('de-DE', { maximumFractionDigits: 0 })} {sym}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 5,
                      background: 'var(--accent-bg)', color: 'var(--accent)',
                      alignSelf: 'flex-start',
                    }}>
                      {ws.tradingDays} {ws.tradingDays === 1 ? 'Tag' : 'Tage'}
                    </span>
                  </>
                ) : (
                  <span style={{ fontSize: 10, color: 'var(--text-3)' }}>0 €</span>
                )}
              </div>
            </Fragment>
          )
        })}
      </div>

      {selectedDay && (
        <DayModal
          day={selectedDay}
          trades={trades.filter(t =>
            t.status === 'closed' &&
            t.pnl !== undefined &&
            (t.closeTime ?? t.date).slice(0, 10) === selectedDay
          )}
          currency={currency}
          onClose={() => setSelectedDay(null)}
          onSelectTrade={(trade) => setSelectedTrade(trade)}
          isTopModal={selectedTrade === null}
        />
      )}

      {selectedTrade && (
        <TradeDetailModal
          trade={selectedTrade}
          currency={currency}
          onBack={() => setSelectedTrade(null)}
          onClose={() => { setSelectedTrade(null); setSelectedDay(null) }}
        />
      )}
    </motion.div>
  )
}

export default memo(TradingCalendar)
