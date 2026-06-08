'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, CheckCircle, Loader2, WifiOff, Cpu } from 'lucide-react'

interface Props {
  onClose: () => void
  onDiscovered: () => void
}

type Step = 'input' | 'scanning' | 'searching' | 'success' | 'error'

export default function DiscoverBridgeModal({ onClose, onDiscovered }: Props) {
  const [url, setUrl] = useState('http://192.168.178.x:8765')
  const [step, setStep] = useState<Step>('scanning')
  const [error, setError] = useState<string | null>(null)
  const [foundName, setFoundName] = useState<string | null>(null)

  useEffect(() => {
    handleAutoScan()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAutoScan() {
    setStep('scanning')
    setError(null)
    try {
      const res = await fetch('/api/bridge/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) {
        setStep('input')
        return
      }
      setFoundName(data.bot?.name ?? 'Bridge')
      setStep('success')
      setTimeout(() => { onDiscovered(); onClose() }, 1800)
    } catch {
      setStep('input')
    }
  }

  async function handleDiscover() {
    setStep('searching')
    setError(null)
    try {
      const res = await fetch('/api/bridge/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Unbekannter Fehler')
        setStep('error')
        return
      }
      setFoundName(data.bot?.name ?? 'Bridge')
      setStep('success')
      setTimeout(() => { onDiscovered(); onClose() }, 1800)
    } catch {
      setError('Netzwerkfehler')
      setStep('error')
    }
  }

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.6)' }}
        onClick={e => { if (e.target === e.currentTarget) onClose() }}>

        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-sm rounded-2xl p-6"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)' }}>
                <Search size={16} style={{ color: '#a855f7' }} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>Bridge suchen</p>
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>Bridge automatisch suchen</p>
              </div>
            </div>
            <button onClick={onClose} className="cursor-pointer w-8 h-8 flex items-center justify-center rounded-lg"
              style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}>
              <X size={14} />
            </button>
          </div>

          {/* Automatischer Scan */}
          {step === 'scanning' && (
            <div className="flex flex-col items-center py-6 gap-3">
              <Loader2 size={28} className="animate-spin" style={{ color: '#a855f7' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
                Suche Bridge im Netzwerk...
              </p>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                Scanne 192.168.178.1–254 : 8765
              </p>
              <button
                onClick={() => setStep('input')}
                className="mt-2 text-xs cursor-pointer underline"
                style={{ color: 'var(--text-3)' }}>
                Manuell eingeben
              </button>
            </div>
          )}

          {/* Manuelle Eingabe */}
          {(step === 'input' || step === 'error') && (
            <>
              <div className="mb-4">
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                  style={{ color: 'var(--text-3)' }}>
                  Bridge-URL (Flask Command-Server)
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="http://192.168.178.x:8765"
                  className="w-full px-3 py-2.5 rounded-xl text-sm font-mono outline-none"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
                  onKeyDown={e => e.key === 'Enter' && handleDiscover()}
                  autoFocus
                />
                <p className="mt-1 text-[10px]" style={{ color: 'var(--text-3)' }}>
                  IP-Adresse des Mini PCs + Port 8765
                </p>
              </div>

              {step === 'error' && error && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-4"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <WifiOff size={13} style={{ color: '#ef4444', flexShrink: 0 }} />
                  <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                  Abbrechen
                </button>
                <button onClick={handleDiscover}
                  disabled={!url.trim()}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: '#a855f7', color: '#fff' }}>
                  <Search size={14} />
                  Suchen
                </button>
              </div>
            </>
          )}

          {/* Manuelle Suche läuft */}
          {step === 'searching' && (
            <div className="flex flex-col items-center py-6 gap-3">
              <Loader2 size={28} className="animate-spin" style={{ color: '#a855f7' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Verbinde mit Bridge...</p>
              <p className="text-xs font-mono" style={{ color: 'var(--text-3)' }}>{url}</p>
            </div>
          )}

          {/* Erfolg */}
          {step === 'success' && (
            <div className="flex flex-col items-center py-6 gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(0,217,126,0.12)' }}>
                <CheckCircle size={24} style={{ color: '#00d97e' }} />
              </div>
              <p className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>Bridge gefunden!</p>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ background: 'var(--surface-2)' }}>
                <Cpu size={13} style={{ color: '#a855f7' }} />
                <p className="text-xs font-semibold" style={{ color: 'var(--text-2)' }}>{foundName}</p>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>Wird hinzugefügt...</p>
            </div>
          )}

        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
