'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CalendarX2 } from 'lucide-react'
import { WirtschaftsEvent, EventImpact } from '@/types/wirtschaftskalender'
import { DesktopRow, MobileCard } from './EventRow'
import KalenderToolbar, { TimeFilter } from './KalenderToolbar'
import { useTranslations } from 'next-intl'

function getRollingBounds() {
  const now = new Date()
  const from = new Date(now)
  from.setDate(now.getDate() - 2)
  from.setHours(0, 0, 0, 0)
  const to = new Date(now)
  to.setDate(now.getDate() + 7)
  to.setHours(23, 59, 59, 999)
  return { start: from, end: to }
}

function getWeekBounds(offset: 0 | 1) {
  const now = new Date()
  const day = now.getDay() === 0 ? 6 : now.getDay() - 1
  const monday = new Date(now)
  monday.setDate(now.getDate() - day + offset * 7)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { start: monday, end: sunday }
}

function isoToday(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' })
}

function formatDateHeader(dateStr: string, todayStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const weekday = d.toLocaleDateString('de-DE', { weekday: 'long' })
  const short = d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })
  const label = dateStr === todayStr ? ' (Heute)' : ''
  return `${weekday}, ${short}${label}`
}

function SkeletonRows() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 44,
            borderRadius: 8,
            background: 'var(--surface-2)',
            opacity: 1 - i * 0.12,
            animation: 'pulse 1.4s ease-in-out infinite',
          }}
        />
      ))}
    </div>
  )
}

interface Props {
  initialEvents: WirtschaftsEvent[]
  initialFetchedAt: string
}

export default function KalenderClient({ initialEvents, initialFetchedAt }: Props) {
  const t = useTranslations('kalender.client')
  const [events, setEvents] = useState<WirtschaftsEvent[]>(initialEvents)
  const [fetchedAt, setFetchedAt] = useState(initialFetchedAt)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [timeFilter, setTimeFilter] = useState<TimeFilter>('rolling')
  const [currencies, setCurrencies] = useState<Set<string>>(new Set())
  const [impactFilter, setImpactFilter] = useState<Set<EventImpact>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const today = isoToday()
  const dayRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const hasScrolled = useRef(false)

  async function handleRefresh() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/wirtschaftskalender', { cache: 'no-store' })
      if (!res.ok) throw new Error('Fehler')
      const data = await res.json()
      setEvents(data.events)
      setFetchedAt(data.fetchedAt)
    } catch {
      setError(t('loadError'))
    } finally {
      setLoading(false)
    }
  }

  const grouped = useMemo(() => {
    let filtered = events

    if (timeFilter === 'rolling') {
      const { start, end } = getRollingBounds()
      filtered = filtered.filter(e => {
        const d = new Date(e.date + 'T12:00:00')
        return d >= start && d <= end
      })
    } else if (timeFilter !== 'all') {
      const { start, end } = getWeekBounds(timeFilter === 'nextweek' ? 1 : 0)
      filtered = filtered.filter(e => {
        const d = new Date(e.date + 'T12:00:00')
        return d >= start && d <= end
      })
    }
    if (currencies.size > 0) {
      filtered = filtered.filter(e => currencies.has(e.country))
    }
    if (impactFilter.size > 0) {
      filtered = filtered.filter(e => impactFilter.has(e.impact))
    }

    const map = new Map<string, WirtschaftsEvent[]>()
    for (const ev of filtered) {
      const group = map.get(ev.date) ?? []
      group.push(ev)
      map.set(ev.date, group)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [events, timeFilter, currencies, impactFilter])

  const totalFiltered = grouped.reduce((sum, [, evs]) => sum + evs.length, 0)

  function scrollToToday() {
    const target = grouped.find(([date]) => date >= today)
    if (target) dayRefs.current[target[0]]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  useEffect(() => {
    if (hasScrolled.current || grouped.length === 0) return
    const target = grouped.find(([date]) => date >= today)
    if (!target) return
    const timer = setTimeout(() => {
      dayRefs.current[target[0]]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)
    hasScrolled.current = true
    return () => clearTimeout(timer)
  }, [grouped, today])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      <KalenderToolbar
        timeFilter={timeFilter}
        onTimeFilter={setTimeFilter}
        currencies={currencies}
        onToggleCurrency={c => setCurrencies(prev => { const n = new Set(prev); n.has(c) ? n.delete(c) : n.add(c); return n })}
        onClearCurrencies={() => setCurrencies(new Set())}
        impactFilter={impactFilter}
        onToggleImpact={imp => setImpactFilter(prev => { const n = new Set(prev); n.has(imp) ? n.delete(imp) : n.add(imp); return n })}
        fetchedAt={fetchedAt}
        loading={loading}
        onRefresh={handleRefresh}
        onScrollToToday={scrollToToday}
      />

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            style={{
              padding: '10px 14px', borderRadius: 10,
              background: 'rgba(255,69,96,0.08)',
              border: '1px solid rgba(255,69,96,0.25)',
              fontSize: 13, color: 'var(--text-2)',
            }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {loading && events.length === 0 && <SkeletonRows />}

      {!loading && totalFiltered === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 10 }}>
          <CalendarX2 size={36} style={{ color: 'var(--text-3)', opacity: 0.4 }} />
          <p style={{ fontSize: 14, color: 'var(--text-3)', fontWeight: 500, margin: 0 }}>
            {t('noEvents')}
          </p>
        </div>
      )}

      {totalFiltered > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {grouped.map(([date, evs]) => {
            const isToday = date === today
            return (
              <motion.div
                key={date}
                ref={el => { dayRefs.current[date] = el as HTMLDivElement | null }}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                style={{ scrollMarginTop: '72px' }}
              >
                {/* Datum-Trennbalken */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{
                    fontSize: 12, fontWeight: 700,
                    color: isToday ? 'var(--accent)' : 'var(--text-2)',
                    whiteSpace: 'nowrap', letterSpacing: '0.01em',
                  }}>
                    {formatDateHeader(date, today)}
                  </span>
                  <div style={{ flex: 1, height: 1, background: isToday ? 'rgba(59,130,246,0.35)' : 'var(--border)' }} />
                  <span style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                    {evs.length} {evs.length === 1 ? t('appointment') : t('appointments')}
                  </span>
                </div>

                {/* Desktop: Tabelle */}
                <div className="hidden md:block">
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          {[t('tableTime'), t('tableCountry'), t('tableEvent'), t('tableImpact'), t('tableForecast'), t('tablePrevious'), t('tableActual'), ''].map(h => (
                            <th
                              key={h}
                              style={{
                                padding: '8px 12px',
                                fontSize: 11, fontWeight: 600,
                                color: 'var(--text-3)',
                                textAlign: [t('tableForecast'), t('tablePrevious'), t('tableActual')].includes(h) ? 'right' : 'left',
                                textTransform: 'uppercase', letterSpacing: '0.05em',
                                background: 'var(--surface-2)',
                              }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {evs.map(ev => (
                          <DesktopRow
                            key={ev.id}
                            event={ev}
                            isToday={isToday}
                            isExpanded={expandedId === ev.id}
                            onToggle={() => setExpandedId(prev => prev === ev.id ? null : ev.id)}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile: Karten */}
                <div className="md:hidden flex flex-col" style={{ gap: 6 }}>
                  {evs.map(ev => (
                    <MobileCard
                      key={ev.id}
                      event={ev}
                      isToday={isToday}
                      isExpanded={expandedId === ev.id}
                      onToggle={() => setExpandedId(prev => prev === ev.id ? null : ev.id)}
                    />
                  ))}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {totalFiltered > 0 && (
        <p style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', marginTop: 4 }}>
          {t('footerResults', { count: totalFiltered })}
        </p>
      )}
    </div>
  )
}
