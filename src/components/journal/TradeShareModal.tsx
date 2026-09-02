'use client'

import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { X, Download, Loader2 } from 'lucide-react'
import { Trade } from '@/types/trade'
import { Strategy } from '@/types/strategy'
import TradeShareCard, { VisibleSections } from './TradeShareCard'
import { useTranslations } from 'next-intl'

interface Props {
  trade: Trade
  broker: string
  currency: string
  startCapital: number
  strategies: Strategy[]
  onClose: () => void
}

function getToggles(t: ReturnType<typeof useTranslations<'journal.tradeShare'>>): { key: keyof VisibleSections; label: string }[] {
  return [
    { key: 'pnl',      label: t('togglePnl') },
    { key: 'prices',   label: t('togglePrices') },
    { key: 'sltp',     label: t('toggleSltp') },
    { key: 'rrLots',   label: t('toggleRrLots') },
    { key: 'strategy', label: t('toggleStrategy') },
  ]
}

// Skalierungsfaktor für die Vorschau (Karte ist 400px breit)
const PREVIEW_SCALE = 0.58

export default function TradeShareModal({ trade, broker, currency, startCapital, strategies, onClose }: Props) {
  const t = useTranslations('journal.tradeShare')
  const toggles = getToggles(t)
  const captureRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState<VisibleSections>({
    pnl: true,
    prices: true,
    sltp: true,
    rrLots: true,
    strategy: true,
  })

  function toggle(key: keyof VisibleSections) {
    setVisible(v => ({ ...v, [key]: !v[key] }))
  }

  async function handleDownload() {
    if (!captureRef.current) return
    setLoading(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(captureRef.current, {
        scale: 2,
        backgroundColor: '#080b12',
        useCORS: true,
        allowTaint: true,
        logging: false,
        width: captureRef.current.offsetWidth || 400,
        height: captureRef.current.offsetHeight,
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: document.documentElement.scrollHeight,
      })
      const link = document.createElement('a')
      const dateStr = new Date(trade.date).toISOString().slice(0, 10).replace(/-/g, '')
      link.download = `alphatrack-${trade.instrument.replace('/', '')}-${dateStr}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } finally {
      setLoading(false)
    }
  }

  const cardProps = { trade, broker, currency, startCapital, strategies, visible }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Unsichtbare Karte in voller Größe für html2canvas */}
      <div style={{ position: 'absolute', top: '-9999px', left: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <TradeShareCard ref={captureRef} {...cardProps} />
      </div>

      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-2xl rounded-2xl overflow-hidden"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 className="text-base font-bold" style={{ color: 'var(--text-1)' }}>{t('title')}</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{t('subtitle')}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer"
            style={{ color: 'var(--text-3)', background: 'var(--surface-2)' }}
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex flex-col md:flex-row">
          {/* Toggles */}
          <div className="md:w-52 shrink-0 p-5" style={{ borderRight: '1px solid var(--border)' }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--text-3)' }}>
              {t('visibleInfoLabel')}
            </p>
            <div className="flex flex-col gap-3">
              {toggles.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggle(key)}
                  className="flex items-center gap-3 text-left cursor-pointer"
                >
                  <div style={{
                    width: 32, height: 18, borderRadius: 99, flexShrink: 0, position: 'relative',
                    background: visible[key] ? 'var(--accent)' : 'var(--surface-3)',
                    border: `1px solid ${visible[key] ? 'var(--accent)' : 'var(--border)'}`,
                    transition: 'background 0.15s, border-color 0.15s',
                  }}>
                    <div style={{
                      position: 'absolute', top: 2,
                      left: visible[key] ? 'calc(100% - 14px)' : 2,
                      width: 12, height: 12,
                      borderRadius: '50%', background: '#fff',
                      transition: 'left 0.15s ease',
                    }} />
                  </div>
                  <span className="text-sm" style={{ color: visible[key] ? 'var(--text-1)' : 'var(--text-3)' }}>
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Sichtbare Vorschau (skaliert, eigene Instanz) */}
          <div className="flex-1 flex items-center justify-center p-6" style={{ background: 'var(--surface-2)', minHeight: 340 }}>
            <div style={{
              transform: `scale(${PREVIEW_SCALE})`,
              transformOrigin: 'top center',
              width: 400,
              marginBottom: `calc((${Math.round(400 * PREVIEW_SCALE)}px - 400px))`,
            }}>
              <TradeShareCard {...cardProps} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
            style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
          >
            {t('cancelBtn')}
          </button>
          <button
            onClick={handleDownload}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer"
            style={{ background: 'var(--accent)', color: '#fff', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {loading ? t('creatingBtn') : t('saveAsPngBtn')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
