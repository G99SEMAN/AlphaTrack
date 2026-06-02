'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { ScrollText, RefreshCw, Trash2, ChevronDown } from 'lucide-react'
import { BridgeLogEntry } from '@/types/bot'
import { BotEntry } from '@/types/bot'

interface Props {
  initialLogs: BridgeLogEntry[]
  bots: BotEntry[]
}

const BOT_COLORS = ['#3b82f6', '#a855f7', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#f97316']

function getBotColor(botId: string, bots: BotEntry[]): string {
  const idx = bots.findIndex(b => b.id === botId)
  return BOT_COLORS[idx % BOT_COLORS.length] ?? '#64748b'
}

const LEVEL_COLORS: Record<string, string> = {
  error: '#ef4444',
  warn:  '#f59e0b',
  info:  'var(--text-3)',
}

function formatTs(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch { return ts }
}

export default function BotsLogsClient({ initialLogs, bots }: Props) {
  const [logs, setLogs] = useState<BridgeLogEntry[]>(initialLogs)
  const [botFilter, setBotFilter] = useState<string>('all')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const listRef = useRef<HTMLDivElement>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/bridge/logs/all')
      if (res.ok) {
        const { logs: data } = await res.json()
        setLogs(data)
      }
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    const id = setInterval(refresh, 5000)
    return () => clearInterval(id)
  }, [refresh])

  useEffect(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollTop = 0
    }
  }, [logs, autoScroll])

  const filtered = logs.filter(l => {
    if (botFilter !== 'all' && l.botId !== botFilter) return false
    if (levelFilter !== 'all' && l.level !== levelFilter) return false
    return true
  })

  return (
    <main className="flex-1 min-w-0 p-4 md:p-6">

      {/* Header */}
      <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Bot Logs</h1>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>
            Aggregierte Logs aller Bots
          </p>
        </div>
        <button onClick={refresh}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
          <RefreshCw size={12} /> Aktualisieren
        </button>
      </div>

      {/* Filter-Leiste */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Bot-Filter */}
        <div className="relative">
          <select
            value={botFilter}
            onChange={e => setBotFilter(e.target.value)}
            className="appearance-none pl-3 pr-7 py-1.5 rounded-xl text-xs font-semibold outline-none cursor-pointer"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
            <option value="all">Alle Bots</option>
            {bots.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--text-3)' }} />
        </div>

        {/* Level-Filter */}
        <div className="relative">
          <select
            value={levelFilter}
            onChange={e => setLevelFilter(e.target.value)}
            className="appearance-none pl-3 pr-7 py-1.5 rounded-xl text-xs font-semibold outline-none cursor-pointer"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
            <option value="all">Alle Level</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--text-3)' }} />
        </div>

        {/* Auto-Scroll Toggle */}
        <button
          onClick={() => setAutoScroll(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer"
          style={{
            background: autoScroll ? 'var(--accent-bg)' : 'var(--surface)',
            border: '1px solid var(--border)',
            color: autoScroll ? 'var(--accent)' : 'var(--text-3)',
          }}>
          Auto-Scroll {autoScroll ? 'an' : 'aus'}
        </button>

        <p className="ml-auto text-[11px]" style={{ color: 'var(--text-3)' }}>
          {filtered.length} Einträge
        </p>
      </div>

      {/* Log-Liste */}
      <div
        ref={listRef}
        className="rounded-2xl overflow-auto"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          maxHeight: 'calc(100vh - 280px)',
          minHeight: 300,
        }}>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <ScrollText size={28} style={{ color: 'var(--text-3)' }} />
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>Keine Einträge</p>
          </div>
        )}

        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {filtered.map((entry, i) => {
            const botColor = entry.botId ? getBotColor(entry.botId, bots) : '#64748b'
            const levelColor = LEVEL_COLORS[entry.level] ?? 'var(--text-3)'
            return (
              <motion.div key={entry.id ?? i}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex items-start gap-3 px-4 py-2.5 text-xs"
                style={{ fontFamily: 'var(--font-mono, monospace)' }}>

                {/* Bot-Farb-Indikator */}
                <span className="shrink-0 mt-0.5 rounded-sm" style={{ width: 3, height: 14, background: botColor, display: 'block' }} />

                {/* Timestamp */}
                <span className="shrink-0 w-20 text-[10px]" style={{ color: 'var(--text-3)' }}>
                  {formatTs(entry.timestamp)}
                </span>

                {/* Bot-Name */}
                {entry.botName && (
                  <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: `${botColor}15`, color: botColor }}>
                    {entry.botName}
                  </span>
                )}

                {/* Level */}
                <span className="shrink-0 text-[10px] uppercase font-semibold w-8" style={{ color: levelColor }}>
                  {entry.level}
                </span>

                {/* Message */}
                <span className="flex-1 break-all" style={{ color: entry.level === 'error' ? '#ef4444' : 'var(--text-2)' }}>
                  {entry.message}
                  {entry.details && (
                    <span className="ml-2" style={{ color: 'var(--text-3)' }}>
                      · {entry.details}
                    </span>
                  )}
                </span>
              </motion.div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
