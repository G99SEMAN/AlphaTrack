'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, RefreshCw, Newspaper, AlertCircle } from 'lucide-react'
import { NewsItem, NewsCategory } from '@/types/news'
import NewsCard from './NewsCard'

type TimeRange = '24h' | '3d' | '7d' | '10d'

interface Props {
  initialNews: NewsItem[]
  initialFetchedAt: string
}

const CATEGORY_LABELS: Record<NewsCategory, string> = {
  'monetary-policy': 'Geldpolitik',
  'earnings':        'Earnings',
  'geopolitical':    'Geopolitik',
  'commodities':     'Rohstoffe',
  'crypto':          'Krypto',
  'general':         'Allgemein',
}

const TIME_RANGES: { value: TimeRange; label: string; hours: number }[] = [
  { value: '24h', label: '24h',    hours: 24 },
  { value: '3d',  label: '3 Tage', hours: 72 },
  { value: '7d',  label: '7 Tage', hours: 168 },
  { value: '10d', label: '10 Tage', hours: 240 },
]

function formatFetchedAt(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diff < 1) return 'gerade aktualisiert'
  if (diff === 1) return 'vor 1 Min.'
  if (diff < 60) return `vor ${diff} Min.`
  const h = Math.floor(diff / 60)
  return h === 1 ? 'vor 1 Std.' : `vor ${h} Std.`
}

export default function NewsClient({ initialNews, initialFetchedAt }: Props) {
  const [news, setNews] = useState<NewsItem[]>(initialNews)
  const [fetchedAt, setFetchedAt] = useState(initialFetchedAt)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<NewsCategory | 'all'>('all')
  const [timeRange, setTimeRange] = useState<TimeRange>('7d')
  const [search, setSearch] = useState('')

  async function handleRefresh() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/news', { cache: 'no-store' })
      if (!res.ok) throw new Error('Fehler beim Laden')
      const data = await res.json()
      setNews(data.items)
      setFetchedAt(data.fetchedAt)
    } catch {
      setError('Nachrichten konnten nicht geladen werden. Bitte Internetverbindung prüfen.')
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const maxAge = TIME_RANGES.find(t => t.value === timeRange)!.hours * 3_600_000
    const now = Date.now()
    const q = search.toLowerCase()

    return news.filter(item => {
      // Fehlerhafte / leere News herausfiltern
      if (!item.title || item.title.length < 15) return false
      if (!item.url || !item.url.startsWith('http')) return false
      const age = now - new Date(item.publishedAt).getTime()
      if (isNaN(age) || age < 0) return false

      if (category !== 'all' && item.category !== category) return false
      if (age > maxAge) return false
      if (q && !item.title.toLowerCase().includes(q) && !item.summary.toLowerCase().includes(q)) return false
      return true
    })
  }, [news, category, timeRange, search])

  return (
    <div className="flex flex-col gap-4">

      {/* Toolbar */}
      <div
        className="rounded-xl px-4 py-3 flex flex-col gap-3"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {/* Zeile 1: Suche + Refresh */}
        <div className="flex gap-3">
          <div
            className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
          >
            <Search size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Suche in Nachrichten..."
              className="flex-1 text-sm bg-transparent outline-none"
              style={{ color: 'var(--text-1)' }}
            />
          </div>

          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all shrink-0"
            style={{
              background: 'var(--surface-2)',
              color: 'var(--text-2)',
              border: '1px solid var(--border)',
              opacity: loading ? 0.6 : 1,
            }}
            onMouseEnter={e => {
              if (!loading) {
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'
                ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'
              }
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-2)'
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Aktualisieren</span>
          </button>
        </div>

        {/* Zeile 2: Kategorie + Zeitraum + Status */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Kategorie-Chips */}
          <div className="flex flex-wrap items-center gap-1">
            {(['all', ...Object.keys(CATEGORY_LABELS)] as (NewsCategory | 'all')[]).map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className="px-2.5 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all"
                style={{
                  background: category === cat ? 'var(--accent-bg)' : 'transparent',
                  color: category === cat ? 'var(--accent)' : 'var(--text-3)',
                  border: `1px solid ${category === cat ? 'var(--accent)' : 'transparent'}`,
                }}
              >
                {cat === 'all' ? 'Alle' : CATEGORY_LABELS[cat as NewsCategory]}
              </button>
            ))}
          </div>

          {/* Trennlinie */}
          <div className="hidden sm:block h-5 w-px" style={{ background: 'var(--border)' }} />

          {/* Zeitraum-Chips */}
          <div className="flex items-center gap-1">
            {TIME_RANGES.map(t => (
              <button
                key={t.value}
                onClick={() => setTimeRange(t.value)}
                className="px-2.5 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all"
                style={{
                  background: timeRange === t.value ? 'var(--surface-2)' : 'transparent',
                  color: timeRange === t.value ? 'var(--text-1)' : 'var(--text-3)',
                  border: `1px solid ${timeRange === t.value ? 'var(--border)' : 'transparent'}`,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Aktualisierungszeit */}
          <span className="text-xs ml-auto" style={{ color: 'var(--text-3)' }}>
            {formatFetchedAt(fetchedAt)}
          </span>
        </div>
      </div>

      {/* Fehlermeldung */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}
          >
            <AlertCircle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
            <span className="text-sm" style={{ color: 'var(--text-2)' }}>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ergebnis-Anzahl */}
      {filtered.length > 0 && (
        <p className="text-xs px-1" style={{ color: 'var(--text-3)' }}>
          {filtered.length} {filtered.length === 1 ? 'Artikel' : 'Artikel'} gefunden
          {filtered.length !== news.length && ` (von ${news.length} gesamt)`}
        </p>
      )}

      {/* News-Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Newspaper size={36} style={{ color: 'var(--text-3)', opacity: 0.4 }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-3)' }}>
            {news.length === 0
              ? 'Keine Nachrichten geladen - Verbindung prüfen'
              : 'Keine Artikel mit diesen Filtern'}
          </p>
          {news.length === 0 && (
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer mt-1"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              <RefreshCw size={14} />
              Erneut versuchen
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.5) }}
            >
              <NewsCard item={item} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
