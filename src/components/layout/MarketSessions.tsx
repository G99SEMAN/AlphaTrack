'use client'

import { useState, useEffect } from 'react'

const EXCHANGES = [
  { id: 'nyse',  name: 'NYSE',  tz: 'America/New_York', oH: 9,  oM: 30, cH: 16, cM: 0  },
  { id: 'lse',   name: 'LSE',   tz: 'Europe/London',    oH: 8,  oM: 0,  cH: 16, cM: 30 },
  { id: 'xetra', name: 'XETRA', tz: 'Europe/Berlin',    oH: 9,  oM: 0,  cH: 17, cM: 30 },
  { id: 'tse',   name: 'Tokio', tz: 'Asia/Tokyo',       oH: 9,  oM: 0,  cH: 15, cM: 30 },
]

function getLocalParts(tz: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(new Date())

  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '0'
  let hour = parseInt(get('hour'))
  if (hour === 24) hour = 0
  const minute = parseInt(get('minute'))
  const weekday = get('weekday')
  return { hour, minute, weekday }
}

function fmt(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

function getStatus(ex: typeof EXCHANGES[0]) {
  const { hour, minute, weekday } = getLocalParts(ex.tz)
  const isWeekend = weekday === 'Sat' || weekday === 'Sun'
  const cur = hour * 60 + minute
  const open = ex.oH * 60 + ex.oM
  const close = ex.cH * 60 + ex.cM
  const isOpen = !isWeekend && cur >= open && cur < close

  if (isOpen) {
    const pct = Math.round(((cur - open) / (close - open)) * 100)
    return { isOpen: true, timeStr: fmt(close - cur), pct }
  }

  let until: number
  if (isWeekend) {
    const daysToMon = weekday === 'Sat' ? 2 : 1
    until = daysToMon * 1440 - cur + open
  } else if (cur < open) {
    until = open - cur
  } else {
    const daysToNext = weekday === 'Fri' ? 3 : 1
    until = daysToNext * 1440 - cur + open
  }
  return { isOpen: false, timeStr: fmt(until), pct: 0 }
}

function getForexStatus() {
  const now = new Date()
  const utcDay = now.getUTCDay()
  const cur = now.getUTCHours() * 60 + now.getUTCMinutes()

  const isOpen = !(
    (utcDay === 5 && cur >= 22 * 60) ||
    utcDay === 6 ||
    (utcDay === 0 && cur < 22 * 60)
  )

  if (isOpen) {
    let minsUntilClose: number
    if (utcDay === 5) {
      minsUntilClose = 22 * 60 - cur
    } else {
      const daysToFri = (5 - utcDay + 7) % 7
      minsUntilClose = daysToFri * 1440 + 22 * 60 - cur
    }
    const totalSession = 5 * 24 * 60 // Sun 22:00 - Fri 22:00
    const pct = Math.round(((totalSession - minsUntilClose) / totalSession) * 100)
    return { isOpen: true, timeStr: fmt(minsUntilClose), pct: Math.max(0, Math.min(100, pct)) }
  }

  let minsUntilOpen: number
  if (utcDay === 5) {
    minsUntilOpen = (24 * 60 - cur) + 24 * 60 + 22 * 60
  } else if (utcDay === 6) {
    minsUntilOpen = (24 * 60 - cur) + 22 * 60
  } else {
    minsUntilOpen = 22 * 60 - cur
  }
  return { isOpen: false, timeStr: fmt(minsUntilOpen), pct: 0 }
}

function SessionRow({ name, isOpen, timeStr, pct, compact }: { name: string; isOpen: boolean; timeStr: string; pct: number; compact?: boolean }) {
  return (
    <div
      className={compact ? 'px-1.5 py-1 rounded' : 'px-2 py-1.5 rounded-lg'}
      style={{ background: isOpen ? 'rgba(0,217,126,0.06)' : 'transparent' }}
    >
      <div className={`flex items-center gap-1.5 ${compact ? '' : 'mb-1.5'}`}>
        <span
          className="shrink-0 rounded-full"
          style={{
            width: compact ? 5 : 6, height: compact ? 5 : 6,
            background: isOpen ? 'var(--green)' : '#ef4444',
            boxShadow: isOpen ? '0 0 4px var(--green)' : '0 0 4px #ef4444',
          }}
        />
        <span
          style={{
            fontSize: compact ? 10 : 12,
            fontWeight: 600,
            color: isOpen ? 'var(--text-1)' : 'var(--text-3)',
            minWidth: compact ? 30 : 38,
          }}
        >
          {name}
        </span>
        <span
          style={{
            fontSize: compact ? 10 : 12,
            marginLeft: 'auto',
            fontFamily: 'monospace',
            color: isOpen ? 'var(--green)' : 'var(--text-3)',
          }}
        >
          {timeStr}
        </span>
      </div>
      {!compact && (
        <div style={{ height: 3, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              borderRadius: 99,
              background: isOpen ? 'linear-gradient(90deg, #00d97e, #06d6a0)' : 'transparent',
              transition: 'width 0.6s ease',
            }}
          />
        </div>
      )}
    </div>
  )
}

export default function MarketSessions({ compact = false }: { compact?: boolean }) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  void tick

  const forex = getForexStatus()
  const statuses = EXCHANGES.map(ex => ({ ...ex, ...getStatus(ex) }))
  const anyOpen = statuses.some(s => s.isOpen)

  return (
    <div style={{ borderTop: '1px solid var(--border)' }}>

      {/* Forex */}
      <div className={compact ? 'px-2 pt-2 pb-1' : 'px-3 pt-3 pb-2'}>
        <SessionRow name="Forex" isOpen={forex.isOpen} timeStr={forex.timeStr} pct={forex.pct} compact={compact} />
      </div>

      <div style={{ height: 1, background: 'var(--border)', margin: compact ? '0 8px' : '0 12px' }} />

      {/* Börsen */}
      <div className={compact ? 'px-2 pt-1 pb-2' : 'px-3 pt-2 pb-3'}>
        <div className="flex items-center justify-between px-1 mb-1">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)', fontSize: compact ? 9 : undefined }}>
            Börsen
          </p>
          <span
            className="text-xs px-1.5 py-0.5 rounded font-medium"
            style={{
              fontSize: compact ? 9 : undefined,
              background: anyOpen ? 'rgba(0,217,126,0.12)' : 'var(--surface-2)',
              color: anyOpen ? 'var(--green)' : 'var(--text-3)',
            }}
          >
            {statuses.filter(s => s.isOpen).length}/{EXCHANGES.length}
          </span>
        </div>

        <div className={compact ? 'grid grid-cols-2 gap-0.5' : 'flex flex-col gap-0.5'}>
          {statuses.map(s => (
            <SessionRow key={s.id} name={s.name} isOpen={s.isOpen} timeStr={s.timeStr} pct={s.pct} compact={compact} />
          ))}
        </div>
      </div>

    </div>
  )
}
