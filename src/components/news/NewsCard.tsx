'use client'

import { ExternalLink, Clock } from 'lucide-react'
import { NewsItem, NewsCategory } from '@/types/news'

const CATEGORY_CONFIG: Record<NewsCategory, { label: string; color: string; bg: string }> = {
  'monetary-policy': { label: 'Geldpolitik', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  'earnings':        { label: 'Earnings',    color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
  'geopolitical':    { label: 'Geopolitik',  color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  'commodities':     { label: 'Rohstoffe',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  'crypto':          { label: 'Krypto',      color: '#06b6d4', bg: 'rgba(6,182,212,0.12)' },
  'general':         { label: 'Allgemein',   color: 'var(--text-3)', bg: 'var(--surface-2)' },
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 2) return 'gerade eben'
  if (mins < 60) return `vor ${mins}m`
  const h = Math.floor(mins / 60)
  if (h < 24) return `vor ${h}h`
  const d = Math.floor(h / 24)
  return `vor ${d}d`
}

export default function NewsCard({ item }: { item: NewsItem }) {
  const cat = CATEGORY_CONFIG[item.category]

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col gap-3 p-4 rounded-xl transition-all h-full"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        textDecoration: 'none',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--accent)'
        ;(e.currentTarget as HTMLAnchorElement).style.background = 'var(--surface-2)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border)'
        ;(e.currentTarget as HTMLAnchorElement).style.background = 'var(--surface)'
      }}
    >
      {/* Kopfzeile: Kategorie + Zeit */}
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-md shrink-0"
          style={{ background: cat.bg, color: cat.color }}
        >
          {cat.label}
        </span>
        <span className="text-xs flex items-center gap-1 shrink-0" style={{ color: 'var(--text-3)' }}>
          <Clock size={11} />
          {relativeTime(item.publishedAt)}
        </span>
      </div>

      {/* Titel */}
      <p
        className="text-sm font-semibold leading-snug line-clamp-2 flex-1"
        style={{ color: 'var(--text-1)' }}
      >
        {item.title}
      </p>

      {/* Summary */}
      {item.summary.length > 30 && (
        <p
          className="text-xs leading-relaxed line-clamp-2"
          style={{ color: 'var(--text-3)' }}
        >
          {item.summary}
        </p>
      )}

      {/* Fusszeile: Quelle + Link */}
      <div className="flex items-center justify-between gap-2 mt-auto pt-1">
        <span className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>
          {item.source}
        </span>
        <ExternalLink
          size={12}
          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          style={{ color: 'var(--accent)' }}
        />
      </div>
    </a>
  )
}
