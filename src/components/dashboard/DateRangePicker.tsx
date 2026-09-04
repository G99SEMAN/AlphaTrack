'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, Calendar, ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'

// ── helpers ───────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function fmtDisplay(s: string): string {
  return parseDate(s).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function startOfWeek(d: Date): Date {
  const r = new Date(d)
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7))
  return r
}

function addMonths(year: number, month: number, delta: number) {
  const d = new Date(year, month + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}

function cellStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// ── presets ───────────────────────────────────────────────────────────────────

interface Preset { label: string; from?: string; to?: string }

function getPresets(t: ReturnType<typeof useTranslations>): Preset[] {
  const now = new Date()
  const today = toDateStr(now)
  const wkStart = startOfWeek(now)
  const wkEnd = new Date(wkStart); wkEnd.setDate(wkEnd.getDate() + 6)
  const mStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const mEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const l30 = new Date(now); l30.setDate(l30.getDate() - 29)
  const lmStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lmEnd = new Date(now.getFullYear(), now.getMonth(), 0)
  const qS = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
  const qE = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0)
  const ytdS = new Date(now.getFullYear(), 0, 1)
  return [
    { label: t('total') },
    { label: t('today'), from: today, to: today },
    { label: t('thisWeek'), from: toDateStr(wkStart), to: toDateStr(wkEnd) },
    { label: t('thisMonth'), from: toDateStr(mStart), to: toDateStr(mEnd) },
    { label: t('last30Days'), from: toDateStr(l30), to: today },
    { label: t('lastMonth'), from: toDateStr(lmStart), to: toDateStr(lmEnd) },
    { label: t('thisQuarter'), from: toDateStr(qS), to: toDateStr(qE) },
    { label: t('thisYear'), from: toDateStr(ytdS), to: today },
  ]
}

// ── sub-components ────────────────────────────────────────────────────────────

function NavBtn({ onClick, dir }: { onClick?: () => void; dir: 'left' | 'right' }) {
  if (!onClick) return <div style={{ width: 24 }} />
  return (
    <button
      onClick={onClick}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4, borderRadius: 4, display: 'flex' }}
    >
      {dir === 'left' ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
    </button>
  )
}

function SelectWrap({ value, onChange, children }: { value: number; onChange: (v: number) => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <select
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          appearance: 'none', WebkitAppearance: 'none',
          background: 'transparent', border: 'none',
          color: 'var(--text-1)', fontSize: 12, fontWeight: 700,
          cursor: 'pointer', outline: 'none',
          paddingRight: 14, fontFamily: 'inherit',
        }}
      >
        {children}
      </select>
      <ChevronDown size={9} style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-3)' }} />
    </div>
  )
}

// ── CalendarGrid ──────────────────────────────────────────────────────────────

interface GridProps {
  year: number
  month: number
  start: string | null
  end: string | null
  hovered: string | null
  onDayClick: (d: string) => void
  onDayHover: (d: string | null) => void
  onPrev?: () => void
  onNext?: () => void
  onChangeMonth: (y: number, m: number) => void
}

function CalendarGrid({ year, month, start, end, hovered, onDayClick, onDayHover, onPrev, onNext, onChangeMonth }: GridProps) {
  const t = useTranslations('dashboard.dateRange')
  const rawMonthsShort = t.raw('monthsShort')
  const MONTH_SHORT = Array.isArray(rawMonthsShort) ? rawMonthsShort as string[] : []
  const rawDaysShort = t.raw('daysShort')
  const DAY_LABELS = Array.isArray(rawDaysShort) ? rawDaysShort as string[] : []

  const firstDay = new Date(year, month, 1)
  const lastDay  = new Date(year, month + 1, 0)
  const startDow = (firstDay.getDay() + 6) % 7  // Monday = 0

  const prev = addMonths(year, month, -1)
  const prevLast = new Date(prev.year, prev.month + 1, 0).getDate()
  const next = addMonths(year, month, 1)

  type Cell = { y: number; m: number; d: number; other: boolean }
  const cells: Cell[] = []
  for (let i = startDow - 1; i >= 0; i--) cells.push({ y: prev.year, m: prev.month, d: prevLast - i, other: true })
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push({ y: year, m: month, d, other: false })
  let nd = 1
  while (cells.length % 7 !== 0) cells.push({ y: next.year, m: next.month, d: nd++, other: true })

  const today = toDateStr(new Date())
  const curYear = new Date().getFullYear()
  const years = Array.from({ length: 12 }, (_, i) => curYear - 5 + i)

  const CELL = 32

  return (
    <div style={{ minWidth: CELL * 7 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <NavBtn onClick={onPrev} dir="left" />
        <div style={{ display: 'flex', gap: 4 }}>
          <SelectWrap value={month} onChange={m => onChangeMonth(year, m)}>
            {MONTH_SHORT.map((n, i) => <option key={n} value={i}>{n}</option>)}
          </SelectWrap>
          <SelectWrap value={year} onChange={y => onChangeMonth(y, month)}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </SelectWrap>
        </div>
        <NavBtn onClick={onNext} dir="right" />
      </div>

      {/* Day labels */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(7, ${CELL}px)`, marginBottom: 2 }}>
        {DAY_LABELS.map(l => (
          <div key={l} style={{ textAlign: 'center', fontSize: 9, fontWeight: 600, color: 'var(--text-3)', lineHeight: '20px' }}>{l}</div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(7, ${CELL}px)` }}>
        {cells.map((cell, i) => {
          const s = cellStr(cell.y, cell.m, cell.d)
          const isStart = !cell.other && s === start
          const isEnd   = !cell.other && s === end
          const isConfirmed = isStart || isEnd

          const effEnd = end ?? hovered
          let lo: string | null = null, hi: string | null = null
          if (start && effEnd) {
            if (start <= effEnd) { lo = start; hi = effEnd } else { lo = effEnd; hi = start }
          }

          const inRange   = !cell.other && !!lo && !!hi && s > lo && s < hi
          const isLo      = !cell.other && s === lo
          const isHi      = !cell.other && s === hi
          const sameDay   = lo === hi
          const showBand  = !sameDay && (inRange || isLo || isHi)
          const isHoverPt = !cell.other && !end && !!start && s === effEnd && s !== start
          const isToday   = !cell.other && s === today

          return (
            <div
              key={i}
              onClick={() => !cell.other && onDayClick(s)}
              onMouseEnter={() => !cell.other && onDayHover(s)}
              onMouseLeave={() => onDayHover(null)}
              style={{ position: 'relative', height: 30, cursor: cell.other ? 'default' : 'pointer' }}
            >
              {/* Range band */}
              {showBand && (
                <div style={{
                  position: 'absolute', top: 3, bottom: 3,
                  left: isLo ? '50%' : 0,
                  right: isHi ? '50%' : 0,
                  background: 'var(--accent-bg)',
                }} />
              )}
              {/* Endpoint circle */}
              {(isConfirmed || isHoverPt) && (
                <div style={{
                  position: 'absolute', top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 26, height: 26, borderRadius: '50%',
                  background: 'var(--accent)',
                  opacity: isHoverPt ? 0.45 : 1,
                  zIndex: 1,
                }} />
              )}
              {/* Text */}
              <span style={{
                position: 'absolute', inset: 0, zIndex: 2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: isConfirmed ? 700 : 400,
                color: (isConfirmed || isHoverPt)
                  ? '#fff'
                  : cell.other
                  ? 'rgba(255,255,255,0.18)'
                  : isToday
                  ? 'var(--accent)'
                  : inRange
                  ? 'var(--text-1)'
                  : 'var(--text-2)',
              }}>
                {cell.d}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function DateRangePicker() {
  const router = useRouter()
  const t = useTranslations('dashboard.dateRange')
  const sp = useSearchParams()
  const fromParam = sp.get('from') ?? ''
  const toParam   = sp.get('to')   ?? ''

  const [open, setOpen]     = useState(false)
  const [start, setStart]   = useState<string | null>(fromParam || null)
  const [end, setEnd]       = useState<string | null>(toParam   || null)
  const [hovered, setHovered] = useState<string | null>(null)

  const [leftYear, setLeftYear] = useState<number>(() => {
    if (fromParam) return parseDate(fromParam).getFullYear()
    const n = new Date(); return addMonths(n.getFullYear(), n.getMonth(), -1).year
  })
  const [leftMonth, setLeftMonth] = useState<number>(() => {
    if (fromParam) return parseDate(fromParam).getMonth()
    const n = new Date(); return addMonths(n.getFullYear(), n.getMonth(), -1).month
  })

  const rightCal = addMonths(leftYear, leftMonth, 1)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    setStart(fromParam || null)
    setEnd(toParam || null)
  }, [fromParam, toParam])

  function handleDayClick(d: string) {
    if (!start || (start && end)) {
      setStart(d); setEnd(null)
    } else {
      if (d < start) { setEnd(start); setStart(d) } else { setEnd(d) }
    }
  }

  function handleLeftChange(y: number, m: number) {
    setLeftYear(y); setLeftMonth(m)
  }

  function handleRightChange(y: number, m: number) {
    const left = addMonths(y, m, -1)
    setLeftYear(left.year); setLeftMonth(left.month)
  }

  function applyRange() {
    if (!start) return applyPreset({ label: t('total') })
    const p = new URLSearchParams()
    p.set('from', start); p.set('to', end ?? start)
    router.push(`/dashboard?${p.toString()}`)
    setOpen(false)
  }

  function applyPreset(p: Preset) {
    const params = new URLSearchParams()
    if (p.from && p.to) { params.set('from', p.from); params.set('to', p.to) }
    router.push(`/dashboard?${params.toString()}`)
    setOpen(false)
  }

  function getLabel(): string {
    if (fromParam && toParam) {
      if (fromParam === toParam) return fmtDisplay(fromParam)
      const match = getPresets(t).find(p => p.from === fromParam && p.to === toParam)
      if (match) return match.label
      return `${fmtDisplay(fromParam)} – ${fmtDisplay(toParam)}`
    }
    return t('total')
  }

  function isActivePreset(p: Preset) {
    if (!p.from) return !fromParam && !toParam
    return p.from === fromParam && p.to === toParam
  }

  const presets = getPresets(t)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 10, cursor: 'pointer',
          background: open ? 'var(--accent-bg)' : 'var(--surface-2)',
          border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`,
          color: open ? 'var(--accent)' : 'var(--text-2)',
          fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
          transition: 'all 0.15s',
        }}
      >
        <Calendar size={13} style={{ flexShrink: 0 }} />
        {getLabel()}
        <ChevronDown size={12} style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 50,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
          overflow: 'hidden',
        }}>
          {/* Selected range display */}
          <div style={{
            padding: '10px 16px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 10, fontSize: 12,
          }}>
            <span style={{ fontFamily: 'var(--font-dm-mono)', fontWeight: start ? 600 : 400, color: start ? 'var(--text-1)' : 'var(--text-3)' }}>
              {start ? fmtDisplay(start) : t('startDate')}
            </span>
            <span style={{ color: 'var(--text-3)', fontSize: 14 }}>→</span>
            <span style={{ fontFamily: 'var(--font-dm-mono)', fontWeight: end ? 600 : 400, color: end ? 'var(--text-1)' : 'var(--text-3)' }}>
              {end ? fmtDisplay(end) : start ? t('chooseEndDate') : t('endDate')}
            </span>
          </div>

          {/* Body: two calendars + presets */}
          <div style={{ display: 'flex' }}>
            <div style={{ padding: '14px 16px', display: 'flex', gap: 16 }}>
              <CalendarGrid
                year={leftYear} month={leftMonth}
                start={start} end={end} hovered={hovered}
                onDayClick={handleDayClick} onDayHover={setHovered}
                onPrev={() => { const n = addMonths(leftYear, leftMonth, -1); handleLeftChange(n.year, n.month) }}
                onChangeMonth={handleLeftChange}
              />
              <div style={{ width: 1, background: 'var(--border)', margin: '4px 0' }} />
              <CalendarGrid
                year={rightCal.year} month={rightCal.month}
                start={start} end={end} hovered={hovered}
                onDayClick={handleDayClick} onDayHover={setHovered}
                onNext={() => { const n = addMonths(rightCal.year, rightCal.month, 1); handleRightChange(n.year, n.month) }}
                onChangeMonth={handleRightChange}
              />
            </div>

            {/* Presets */}
            <div style={{ borderLeft: '1px solid var(--border)', padding: '14px 12px', minWidth: 145 }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>
                {t('quickSelect')}
              </p>
              {presets.map(p => {
                const active = isActivePreset(p)
                return (
                  <button
                    key={p.label}
                    onClick={() => applyPreset(p)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '7px 10px', borderRadius: 8, cursor: 'pointer', marginBottom: 2,
                      fontSize: 12, fontWeight: active ? 700 : 400,
                      background: active ? 'var(--accent-bg)' : 'transparent',
                      color: active ? 'var(--accent)' : 'var(--text-2)',
                      border: 'none', transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface-2)' }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              onClick={() => { setStart(null); setEnd(null) }}
              style={{
                padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                background: 'transparent', color: 'var(--text-3)',
                border: '1px solid var(--border)', fontSize: 11,
              }}
            >
              {t('reset')}
            </button>
            <button
              onClick={applyRange}
              disabled={!start}
              style={{
                padding: '6px 14px', borderRadius: 8,
                cursor: start ? 'pointer' : 'not-allowed',
                background: start ? 'var(--accent)' : 'var(--surface-2)',
                color: start ? '#fff' : 'var(--text-3)',
                border: 'none', fontSize: 11, fontWeight: 700,
                transition: 'all 0.15s',
              }}
            >
              {t('apply')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
