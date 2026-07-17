'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Bot } from 'lucide-react'
import { BotEntry } from '@/types/bot'
import { getBotColor } from '@/lib/bot-colors'

export const MANUAL_FILTER_VALUE = 'manual'

interface Props {
  bots: BotEntry[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
}

export default function BotFilterDropdown({ bots, selected, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const total = bots.length + 1
  const allSelected = selected.size === total

  function toggle(value: string) {
    const next = new Set(selected)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    onChange(next)
  }

  function label(): string {
    if (allSelected) return 'Alle Bots'
    if (selected.size === 0) return 'Keine Bots'
    return `${selected.size} ausgewählt`
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium cursor-pointer transition-all"
        style={{
          background: open || !allSelected ? 'var(--accent-bg)' : 'transparent',
          color: open || !allSelected ? 'var(--accent)' : 'var(--text-3)',
          border: `1px solid ${open || !allSelected ? 'var(--accent)' : 'transparent'}`,
        }}
      >
        <Bot size={11} />
        {label()}
        <ChevronDown size={11} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
          minWidth: 180, overflow: 'hidden', padding: 4,
        }}>
          {bots.map(bot => {
            const color = getBotColor(bot.id, bots)
            const checked = selected.has(bot.id)
            return (
              <label
                key={bot.id}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all"
                style={{ color: 'var(--text-1)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLLabelElement).style.background = 'var(--surface-2)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLLabelElement).style.background = 'transparent' }}
              >
                <input type="checkbox" checked={checked} onChange={() => toggle(bot.id)} style={{ accentColor: color }} />
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span className="truncate">{bot.name}</span>
              </label>
            )
          })}
          <label
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all"
            style={{
              color: 'var(--text-1)',
              borderTop: bots.length > 0 ? '1px solid var(--border)' : undefined,
              marginTop: bots.length > 0 ? 4 : 0,
              paddingTop: bots.length > 0 ? 8 : undefined,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLLabelElement).style.background = 'var(--surface-2)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLLabelElement).style.background = 'transparent' }}
          >
            <input type="checkbox" checked={selected.has(MANUAL_FILTER_VALUE)} onChange={() => toggle(MANUAL_FILTER_VALUE)} />
            <span className="truncate">Manuell</span>
          </label>
        </div>
      )}
    </div>
  )
}
