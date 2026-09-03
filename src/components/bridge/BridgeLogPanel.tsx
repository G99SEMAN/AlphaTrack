'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { ScrollText, RefreshCw } from 'lucide-react'
import { BridgeLogEntry } from '@/types/bot'
import { useTranslations } from 'next-intl'

interface Props {
  botId: string
}

function getLevelStyle(t: ReturnType<typeof useTranslations<'bridge.logPanel'>>) {
  return {
    info:  { label: t('levelInfo'), color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
    warn:  { label: t('levelWarn'), color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    error: { label: t('levelErr'),  color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  }
}

export default function BridgeLogPanel({ botId }: Props) {
  const t = useTranslations('bridge.logPanel')
  const levelStyle = getLevelStyle(t)
  const [log, setLog] = useState<BridgeLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [autoScroll, setAutoScroll] = useState(true)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const poll = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch(`/api/bridge/log?bridgeId=${encodeURIComponent(botId)}`, { signal })
      if (res.ok) setLog((await res.json()).log ?? [])
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
    } finally { setLoading(false) }
  }, [botId])

  useEffect(() => {
    const controller = new AbortController()
    poll(controller.signal)
    const id = setInterval(() => poll(controller.signal), 5000)
    return () => { clearInterval(id); controller.abort() }
  }, [poll])
  useEffect(() => {
    if (autoScroll && scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0
  }, [log, autoScroll])

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
      className="rounded-2xl flex flex-col" style={{ background: 'var(--surface)', border: '1px solid var(--border)', minHeight: 320 }}>
      <div className="flex items-center justify-between px-5 pt-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <ScrollText size={15} style={{ color: 'var(--text-3)' }} />
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>{t('heading')}</p>
          <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}>{log.length}</span>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} className="rounded" />
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>{t('autoScroll')}</span>
          </label>
          <button onClick={() => poll()} className="cursor-pointer" title={t('refreshTooltip')}>
            <RefreshCw size={13} style={{ color: 'var(--text-3)' }} />
          </button>
        </div>
      </div>
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-3 flex flex-col gap-0.5 font-mono" style={{ maxHeight: 360 }}>
        {loading && <p className="text-xs p-4 text-center" style={{ color: 'var(--text-3)' }}>{t('loading')}</p>}
        {!loading && log.length === 0 && <p className="text-xs p-4 text-center" style={{ color: 'var(--text-3)' }}>{t('noEntries')}</p>}
        {log.map(entry => {
          const style = levelStyle[entry.level]
          const time = new Date(entry.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          return (
            <div key={entry.id} className="flex items-start gap-2 px-2 py-1.5 rounded-lg text-xs min-w-0"
              style={{ background: 'transparent' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <span className="shrink-0" style={{ color: 'var(--text-3)', minWidth: 62 }}>{time}</span>
              <span className="shrink-0 px-1.5 py-0 rounded font-bold leading-5"
                style={{ background: style.bg, color: style.color, minWidth: 36, textAlign: 'center' }}>
                {style.label}
              </span>
              <span className="min-w-0 flex-1" style={{ color: 'var(--text-2)', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                {entry.message}
                {entry.details && <span className="ml-1" style={{ color: 'var(--text-3)' }}>- {entry.details}</span>}
              </span>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}
