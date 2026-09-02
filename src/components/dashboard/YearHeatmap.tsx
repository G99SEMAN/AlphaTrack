'use client'

import { useMemo, useState } from 'react'
import { Trade } from '@/types/trade'
import { useTranslations } from 'next-intl'

interface Props {
  trades: Trade[]
  year: number
  onSelectMonth: (year: number, month: number, day: string) => void
}

interface DayPnl {
  pnl: number
  count: number
}

const CELL_SIZE = 11
const CELL_GAP = 3

function fmtPnlShort(val: number): string {
  const abs = Math.abs(val)
  if (abs >= 1000) return `${val >= 0 ? '' : '-'}${(abs / 1000).toFixed(1)}K`
  return `${val >= 0 ? '' : '-'}${abs.toLocaleString('de-DE', { maximumFractionDigits: 0 })}`
}

function keyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function cellColor(data: DayPnl | undefined, inYear: boolean): string {
  if (!inYear) return 'transparent'
  if (!data) return 'rgba(255,255,255,0.03)'
  const intensity = Math.min(Math.abs(data.pnl) / 500, 1)
  return data.pnl >= 0
    ? `rgba(0, 217, 126, ${0.15 + intensity * 0.65})`
    : `rgba(255, 69, 96, ${0.15 + intensity * 0.65})`
}

export default function YearHeatmap({ trades, year, onSelectMonth }: Props) {
  const t = useTranslations('dashboard.calendar')
  const tDate = useTranslations('dashboard.dateRange')
  const rawMonths = tDate.raw('monthsShort')
  const MONTH_LABELS = Array.isArray(rawMonths) ? rawMonths as string[] : []
  const [hovered, setHovered] = useState<string | null>(null)

  const pnlByDay = useMemo(() => {
    const map = new Map<string, DayPnl>()
    for (const t of trades) {
      if (t.status !== 'closed' || t.pnl === undefined) continue
      const dateStr = (t.closeTime ?? t.date).slice(0, 10)
      if (!dateStr.startsWith(`${year}-`)) continue
      const existing = map.get(dateStr) ?? { pnl: 0, count: 0 }
      existing.pnl += t.pnl
      existing.count++
      map.set(dateStr, existing)
    }
    return map
  }, [trades, year])

  // Montag der Woche, die den 1. Januar enthält (europäische Woche, Mo=0)
  const jan1 = new Date(year, 0, 1)
  const jan1Dow = (jan1.getDay() + 6) % 7
  const gridStart = new Date(year, 0, 1 - jan1Dow)

  // 54 Wochenspalten decken jedes Jahr sicher ab, auch Schaltjahre, deren 1. Januar
  // auf einen Sonntag fällt (z.B. 2012, 2040) — mit 53 Wochen würde der 31. Dezember
  // in diesen Fällen aus dem Raster fallen
  const weeks: Date[][] = []
  for (let w = 0; w < 54; w++) {
    const week: Date[] = []
    for (let d = 0; d < 7; d++) {
      const day = new Date(gridStart)
      day.setDate(gridStart.getDate() + w * 7 + d)
      week.push(day)
    }
    weeks.push(week)
  }

  // Für jede Wochenspalte: Monatsname, wenn diese Woche der erste Auftritt dieses Monats im Jahr ist
  const weekMonthLabels = weeks.map((week, wi) => {
    const firstOfWeek = week[0]
    if (firstOfWeek.getFullYear() !== year) return null
    if (firstOfWeek.getDate() > 7) return null
    const prevWeekMonth = wi > 0 ? weeks[wi - 1][0].getMonth() : -1
    if (firstOfWeek.getMonth() === prevWeekMonth) return null
    return MONTH_LABELS[firstOfWeek.getMonth()]
  })

  const hoveredData = hovered ? pnlByDay.get(hovered) : undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <div style={{ display: 'flex', gap: CELL_GAP, marginBottom: 4 }}>
          {weekMonthLabels.map((label, wi) => (
            <div key={wi} style={{ width: CELL_SIZE, fontSize: 9, color: 'var(--text-3)', flexShrink: 0 }}>
              {label ?? ''}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: CELL_GAP }}>
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: CELL_GAP, flexShrink: 0 }}>
              {week.map((d, di) => {
                const key = keyOf(d)
                const inYear = d.getFullYear() === year
                const data = pnlByDay.get(key)
                const clickable = inYear && !!data
                return (
                  <div
                    key={di}
                    onMouseEnter={() => inYear && setHovered(key)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={clickable ? () => onSelectMonth(d.getFullYear(), d.getMonth(), key) : undefined}
                    style={{
                      width: CELL_SIZE, height: CELL_SIZE, borderRadius: 3,
                      background: cellColor(data, inYear),
                      cursor: clickable ? 'pointer' : 'default',
                      border: hovered === key ? '1px solid var(--accent)' : '1px solid transparent',
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <div style={{ height: 20, fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-dm-mono)' }}>
        {hovered
          ? `${hovered.split('-').reverse().join('.')} · ${
              hoveredData
                ? `${hoveredData.pnl >= 0 ? '+' : ''}${fmtPnlShort(hoveredData.pnl)} € · ${hoveredData.count} ${hoveredData.count === 1 ? t('trade') : t('trades')}`
                : t('noTrades')
            }`
          : t('hoverHint')}
      </div>
    </div>
  )
}
