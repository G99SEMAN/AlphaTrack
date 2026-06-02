'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ScrollText, RefreshCw, Search, Trash2, Download,
  ChevronDown, AlertTriangle, Info, X,
} from 'lucide-react'
import { BotEntry, BridgeLogEntry } from '@/types/bot'

interface Props {
  bots: BotEntry[]
  initialLogs: Record<string, BridgeLogEntry[]>
}

const LEVEL_STYLE = {
  info:  { label: 'INFO', color: '#60a5fa', bg: 'rgba(96,165,250,0.08)'  },
  warn:  { label: 'WARN', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)'  },
  error: { label: 'ERR',  color: '#ef4444', bg: 'rgba(239,68,68,0.08)'   },
}

type LevelFilter = 'all' | 'info' | 'warn' | 'error'

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function exportJSON(entries: BridgeLogEntry[], filename: string) {
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function exportCSV(entries: BridgeLogEntry[], filename: string) {
  const header = 'Datum/Uhrzeit;Level;Bot;Nachricht;Details'
  const rows = entries.map(e =>
    [fmtDateTime(e.timestamp), e.level.toUpperCase(), e.botName ?? e.botId ?? '', e.message, e.details ?? '']
      .map(v => `"${String(v).replace(/"/g, '""')}"`)
      .join(';')
  )
  const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function BridgeLogClient({ bots, initialLogs }: Props) {
  const [logs, setLogs] = useState<Record<string, BridgeLogEntry[]>>(initialLogs)
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all')
  const [botFilter, setBotFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [confirmClear, setConfirmClear] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)

  const fetchAll = useCallback(async () => {
    const updated: Record<string, BridgeLogEntry[]> = {}
    await Promise.all(
      bots.map(async bot => {
        try {
          const res = await fetch(`/api/bridge/log?bridgeId=${encodeURIComponent(bot.id)}`)
          if (res.ok) updated[bot.id] = (await res.json()).log ?? []
        } catch { /* silent */ }
      })
    )
    if (Object.keys(updated).length > 0) setLogs(prev => ({ ...prev, ...updated }))
  }, [bots])

  useEffect(() => {
    const id = setInterval(fetchAll, 10_000)
    return () => clearInterval(id)
  }, [fetchAll])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExport(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const allEntries: BridgeLogEntry[] = Object.entries(logs)
    .flatMap(([, entries]) => entries)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  const filtered = allEntries.filter(e => {
    if (levelFilter !== 'all' && e.level !== levelFilter) return false
    if (botFilter !== 'all' && e.botId !== botFilter) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      if (
        !e.message.toLowerCase().includes(q) &&
        !(e.details ?? '').toLowerCase().includes(q) &&
        !(e.botName ?? '').toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  const grouped: { date: string; entries: BridgeLogEntry[] }[] = []
  for (const entry of filtered) {
    const d = fmtDate(entry.timestamp)
    const last = grouped[grouped.length - 1]
    if (!last || last.date !== d) grouped.push({ date: d, entries: [entry] })
    else last.entries.push(entry)
  }

  const totalEntries = allEntries.length
  const warnCount  = allEntries.filter(e => e.level === 'warn').length
  const errorCount = allEntries.filter(e => e.level === 'error').length

  async function handleClear(botId: string) {
    setClearing(true)
    try {
      await fetch(`/api/bridge/log?bridgeId=${encodeURIComponent(botId)}`, { method: 'DELETE' })
      setLogs(prev => ({ ...prev, [botId]: [] }))
    } finally {
      setClearing(false)
      setConfirmClear(null)
    }
  }

  const now = new Date().toISOString().slice(0, 10)
  const exportFilename = `bridgelog-${now}`

  return (
    <main className="flex-1 min-w-0 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.25)' }}
          >
            <ScrollText size={17} style={{ color: '#60a5fa' }} />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: 'var(--text-1)' }}>Bridge Log</h1>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>
              Systemzeit - alle Meldungen aller Bots
            </p>
          </div>
        </div>
      </div>

      {bots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <ScrollText size={36} style={{ color: 'var(--text-3)', opacity: 0.4 }} />
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>Kein Bot konfiguriert.</p>
        </div>
      ) : (
        <>
          {/* KPI-Zeile */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: 'Einträge gesamt', value: totalEntries, color: 'var(--text-1)' },
              { label: 'Warnungen', value: warnCount,  color: '#f59e0b' },
              { label: 'Fehler',    value: errorCount, color: '#ef4444' },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="rounded-xl px-4 py-3 text-center"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <p className="text-xl font-black font-mono" style={{ color }}>{value}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{label}</p>
              </div>
            ))}
          </div>

          {/* Filter + Aktionen */}
          <div className="rounded-2xl p-4 mb-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

            {/* Suchfeld */}
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Suche in Nachrichten, Details, Bot-Name..."
                className="w-full pl-9 pr-4 py-2 rounded-xl text-sm outline-none"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                  style={{ color: 'var(--text-3)' }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Level-Filter */}
              <div className="flex items-center gap-1.5">
                {(['all', 'info', 'warn', 'error'] as const).map(lvl => (
                  <button
                    key={lvl}
                    onClick={() => setLevelFilter(lvl)}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all"
                    style={levelFilter === lvl ? {
                      background: lvl === 'all' ? 'var(--accent-bg)' : LEVEL_STYLE[lvl]?.bg,
                      color: lvl === 'all' ? 'var(--accent)' : LEVEL_STYLE[lvl]?.color,
                      border: `1px solid ${lvl === 'all' ? 'var(--accent)' : LEVEL_STYLE[lvl]?.color}44`,
                    } : {
                      background: 'var(--bg)',
                      color: 'var(--text-3)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {lvl === 'all' ? 'Alle Level' : LEVEL_STYLE[lvl].label}
                  </button>
                ))}
              </div>

              <div className="h-4 w-px" style={{ background: 'var(--border)' }} />

              {/* Bot-Filter */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setBotFilter('all')}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all"
                  style={botFilter === 'all' ? {
                    background: 'var(--accent-bg)', color: 'var(--accent)',
                    border: '1px solid var(--accent)44',
                  } : {
                    background: 'var(--bg)', color: 'var(--text-3)', border: '1px solid var(--border)',
                  }}
                >
                  Alle Bots
                </button>
                {bots.map(bot => (
                  <button
                    key={bot.id}
                    onClick={() => setBotFilter(bot.id)}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all"
                    style={botFilter === bot.id ? {
                      background: 'rgba(96,165,250,0.12)', color: '#60a5fa',
                      border: '1px solid rgba(96,165,250,0.35)',
                    } : {
                      background: 'var(--bg)', color: 'var(--text-3)', border: '1px solid var(--border)',
                    }}
                  >
                    {bot.name}
                  </button>
                ))}
              </div>

              <div className="ml-auto flex items-center gap-2">
                {/* Aktualisieren */}
                <button
                  onClick={fetchAll}
                  className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-colors"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-3)' }}
                  title="Aktualisieren"
                >
                  <RefreshCw size={13} />
                </button>

                {/* Export-Dropdown */}
                <div className="relative" ref={exportRef}>
                  <button
                    onClick={() => setShowExport(v => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
                  >
                    <Download size={13} /> Export <ChevronDown size={11} />
                  </button>
                  <AnimatePresence>
                    {showExport && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="absolute right-0 top-full mt-1 rounded-xl z-20 overflow-hidden"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)', minWidth: 150 }}
                      >
                        <button
                          onClick={() => { exportJSON(filtered, `${exportFilename}.json`); setShowExport(false) }}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-left cursor-pointer transition-colors"
                          style={{ color: 'var(--text-1)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <Download size={12} /> Als JSON
                        </button>
                        <button
                          onClick={() => { exportCSV(filtered, `${exportFilename}.csv`); setShowExport(false) }}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-left cursor-pointer transition-colors"
                          style={{ color: 'var(--text-1)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <Download size={12} /> Als CSV
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Log löschen */}
                <div className="relative">
                  <button
                    onClick={() => setConfirmClear(botFilter === 'all' ? '__all__' : botFilter)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                    style={{
                      background: 'rgba(239,68,68,0.08)',
                      border: '1px solid rgba(239,68,68,0.25)',
                      color: '#ef4444',
                    }}
                    title="Log löschen"
                  >
                    <Trash2 size={13} />
                    {botFilter === 'all' ? 'Alle löschen' : 'Log löschen'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Log-Feed */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
                {filtered.length} Einträge
                {(levelFilter !== 'all' || botFilter !== 'all' || search) && (
                  <span className="ml-1.5" style={{ color: 'var(--accent)' }}>(gefiltert)</span>
                )}
              </p>
            </div>

            <div className="font-mono overflow-y-auto" style={{ maxHeight: 'calc(100vh - 380px)', minHeight: 200 }}>
              {filtered.length === 0 ? (
                <p className="text-xs p-8 text-center" style={{ color: 'var(--text-3)' }}>
                  {allEntries.length === 0 ? 'Noch keine Log-Einträge vorhanden.' : 'Keine Einträge für diesen Filter.'}
                </p>
              ) : (
                grouped.map(({ date, entries: dayEntries }) => (
                  <div key={date}>
                    <div
                      className="flex items-center gap-3 px-5 py-2 sticky top-0 z-10"
                      style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}
                    >
                      <span className="text-xs font-bold" style={{ color: 'var(--text-3)' }}>{date}</span>
                      <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                        {dayEntries.length} Einträge
                      </span>
                    </div>

                    {dayEntries.map(entry => {
                      const style = LEVEL_STYLE[entry.level]
                      const timeStr = new Date(entry.timestamp).toLocaleTimeString('de-DE', {
                        hour: '2-digit', minute: '2-digit', second: '2-digit',
                      })
                      const botName = entry.botName ?? entry.botId?.slice(0, 8) ?? '?'

                      return (
                        <div
                          key={entry.id}
                          className="flex items-start gap-3 px-5 py-2 text-xs transition-colors"
                          style={{ borderBottom: '1px solid var(--border-subtle)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <span
                            className="shrink-0 tabular-nums"
                            style={{ color: 'var(--text-3)', minWidth: 70 }}
                          >
                            {timeStr}
                          </span>
                          <span
                            className="shrink-0 px-1.5 rounded font-black leading-5 text-center"
                            style={{ background: style.bg, color: style.color, minWidth: 36 }}
                          >
                            {style.label}
                          </span>
                          {bots.length > 1 && (
                            <span
                              className="shrink-0 px-1.5 py-0 rounded leading-5 text-center"
                              style={{
                                background: 'rgba(96,165,250,0.08)',
                                color: '#60a5fa',
                                minWidth: 50,
                                maxWidth: 90,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {botName}
                            </span>
                          )}
                          <span className="flex-1 min-w-0" style={{ color: 'var(--text-1)', wordBreak: 'break-word' }}>
                            {entry.message}
                            {entry.details && (
                              <span className="ml-2" style={{ color: 'var(--text-3)' }}>
                                - {entry.details}
                              </span>
                            )}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Bestätigungs-Dialog: Log löschen */}
      <AnimatePresence>
        {confirmClear && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.6)' }}
              onClick={() => setConfirmClear(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div
                className="w-full max-w-sm rounded-2xl p-6"
                style={{ background: 'var(--surface)', border: '1px solid rgba(239,68,68,0.3)' }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(239,68,68,0.12)' }}
                  >
                    <AlertTriangle size={18} style={{ color: '#ef4444' }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>Log löschen?</p>
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                      {confirmClear === '__all__'
                        ? 'Alle Bridge-Logs werden unwiderruflich gelöscht.'
                        : `Log von "${bots.find(b => b.id === confirmClear)?.name ?? confirmClear}" löschen.`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg mb-4"
                  style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <Info size={12} style={{ color: '#ef4444', flexShrink: 0 }} />
                  <p className="text-xs" style={{ color: '#ef4444' }}>
                    Diese Aktion kann nicht rückgängig gemacht werden.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmClear(null)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
                    style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={async () => {
                      if (confirmClear === '__all__') {
                        for (const bot of bots) await handleClear(bot.id)
                      } else {
                        await handleClear(confirmClear)
                      }
                    }}
                    disabled={clearing}
                    className="flex-1 py-2.5 rounded-xl text-sm font-black cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ background: '#ef4444', color: '#fff' }}
                  >
                    {clearing ? 'Löschen...' : 'Löschen'}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </main>
  )
}
