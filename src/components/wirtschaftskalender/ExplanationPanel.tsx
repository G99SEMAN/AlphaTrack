'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface ExplanationData {
  name: string
  zusammenfassung: string
  warum_wichtig: string
  einfluss: string
  kategorie: string
  timing?: string
}

interface Props {
  eventTitle: string
  country: string
  isExpanded: boolean
}

function InfluenceLines({ einfluss }: { einfluss: string }) {
  const parts = einfluss.split(/(?<=\.)\s+/)
  if (parts.length < 2) {
    return <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>{einfluss}</p>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {parts.map((part, i) => {
        const isBetter = /besser/i.test(part)
        const isWorse = /schlechter/i.test(part)
        const color = isBetter ? 'var(--green)' : isWorse ? 'var(--red)' : 'var(--text-2)'
        const prefix = isBetter ? '✅ ' : isWorse ? '❌ ' : ''
        return (
          <span key={i} style={{ fontSize: 13, color, lineHeight: 1.5 }}>
            {prefix}{part.trim()}
          </span>
        )
      })}
    </div>
  )
}

function SkeletonLine({ width }: { width: string }) {
  return (
    <div style={{
      height: 13, borderRadius: 4,
      background: 'var(--border)',
      width,
      animation: 'pulse 1.4s ease-in-out infinite',
    }} />
  )
}

export default function ExplanationPanel({ eventTitle, country, isExpanded }: Props) {
  const [data, setData] = useState<ExplanationData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [fetched, setFetched] = useState(false)

  useEffect(() => {
    if (!isExpanded || fetched) return
    setFetched(true)
    setLoading(true)
    setError(false)
    const url = `/api/wirtschaftskalender/erklaerung?title=${encodeURIComponent(eventTitle)}&country=${encodeURIComponent(country)}`
    fetch(url)
      .then(r => r.json())
      .then(json => {
        if (json.explanation) setData(json.explanation)
        else setError(true)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [isExpanded, fetched, eventTitle, country])

  const panelStyle: React.CSSProperties = {
    background: 'var(--surface-2)',
    borderTop: '1px solid var(--border)',
    padding: '14px 16px',
    overflow: 'hidden',
  }

  return (
    <AnimatePresence>
      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          style={panelStyle}
        >
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <SkeletonLine width="55%" />
              <SkeletonLine width="90%" />
              <SkeletonLine width="75%" />
            </div>
          )}

          {error && !loading && (
            <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>
              Keine Erklärung verfügbar
            </p>
          )}

          {data && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Header: Name + Kategorie-Badge */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', margin: 0, lineHeight: 1.3 }}>
                  {data.name}
                </p>
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  color: 'var(--accent)',
                  background: 'var(--accent-bg)',
                  padding: '2px 7px',
                  borderRadius: 20,
                  whiteSpace: 'nowrap',
                  letterSpacing: '0.03em',
                  textTransform: 'uppercase',
                  flexShrink: 0,
                }}>
                  {data.kategorie}
                </span>
              </div>

              {/* Was wird gemessen */}
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>
                  Was wird gemessen?
                </p>
                <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>
                  {data.zusammenfassung}
                </p>
              </div>

              {/* Warum wichtig */}
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>
                  Warum wichtig für Trader?
                </p>
                <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>
                  {data.warum_wichtig}
                </p>
              </div>

              {/* Einfluss */}
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>
                  Einfluss auf {country}
                </p>
                <InfluenceLines einfluss={data.einfluss} />
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
