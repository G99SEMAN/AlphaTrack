'use client'

import { useEffect, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Bot, RefreshCw, Check, AlertCircle, TrendingUp, TrendingDown, Upload,
} from 'lucide-react'
import { Trade } from '@/types/trade'
import { Profile } from '@/types/profile'
import { BotEntry } from '@/types/bot'
import { importBotTradesAction } from '@/lib/actions'

interface AccountInfo {
  balance: number
  equity: number
  currency: string
}

interface RawDeal {
  date: string
  closeTime: string
  instrument: string
  type: 'long' | 'short'
  entry: number
  exit: number
  size: number
  pnl: number
  commission: number
  swap: number
  status: 'closed'
  externalId: string
}

type Step = 'config' | 'preview' | 'done'

interface Props {
  bots: BotEntry[]
  profiles: Profile[]
  existingExternalIdsByProfile: Record<string, Set<string>>
  onClose: () => void
}

export default function BotImportModal({ bots, profiles, existingExternalIdsByProfile, onClose }: Props) {
  const [step, setStep] = useState<Step>('config')
  const [selectedBotId, setSelectedBotId] = useState<string>(bots[0]?.id ?? '')
  const [selectedProfileId, setSelectedProfileId] = useState<string>(profiles[0]?.id ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [account, setAccount] = useState<AccountInfo | null>(null)
  const [deals, setDeals] = useState<RawDeal[]>([])
  const [startCapital, setStartCapital] = useState<string>('')
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const selectedProfile = profiles.find(p => p.id === selectedProfileId)
  const existingIds = existingExternalIdsByProfile[selectedProfileId] ?? new Set<string>()
  const duplicateCount = deals.filter(d => existingIds.has(d.externalId)).length
  const newCount = deals.length - duplicateCount

  async function fetchHistory() {
    if (!selectedBotId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/bridge/history?bridgeId=${selectedBotId}`)
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Bot nicht erreichbar')
        return
      }
      const data = await res.json()
      setDeals(data.deals ?? [])
      setAccount(data.account ?? null)
      if (data.account?.balance) {
        setStartCapital(String(data.account.balance))
      }
      setStep('preview')
    } catch {
      setError('Verbindung zum Bot fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }

  function handleImport() {
    const incoming: Omit<Trade, 'id'>[] = deals.map(d => ({
      date: d.date,
      closeTime: d.closeTime,
      instrument: d.instrument,
      type: d.type,
      entry: d.entry,
      exit: d.exit,
      size: d.size,
      pnl: d.pnl,
      commission: d.commission,
      swap: d.swap,
      status: 'closed' as const,
      externalId: d.externalId,
      outcome: d.pnl >= 0 ? 'win' : 'loss',
    }))

    const newCapital = startCapital ? parseFloat(startCapital) : undefined

    startTransition(async () => {
      const res = await importBotTradesAction(selectedProfileId, incoming, newCapital)
      setResult(res)
      setStep('done')
    })
  }

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', zIndex: 9999 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.18 }}
        onClick={e => e.stopPropagation()}
        className="w-full rounded-xl overflow-hidden flex flex-col"
        style={{
          maxWidth: step === 'preview' ? 720 : 480,
          maxHeight: '90vh',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(59,130,246,0.12)' }}>
              <Bot size={15} style={{ color: '#3b82f6' }} />
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: 'var(--text-1)' }}>
                {step === 'config' && 'Import via Bot'}
                {step === 'preview' && 'Vorschau'}
                {step === 'done' && 'Import abgeschlossen'}
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                {step === 'config' && 'MT5-Kontohistorie direkt vom Bot laden'}
                {step === 'preview' && `${deals.length} Trades gefunden · ${newCount} neu`}
                {step === 'done' && 'Trades wurden ins Journal übertragen'}
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer"
            style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">

            {/* Step 1: Konfiguration */}
            {step === 'config' && (
              <motion.div key="config"
                initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
                className="px-5 py-5 flex flex-col gap-5">

                {error && (
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <AlertCircle size={14} className="shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                    <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>
                  </div>
                )}

                {/* Bot-Auswahl */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-2"
                    style={{ color: 'var(--text-3)' }}>
                    Bot auswählen
                  </label>
                  <div className="flex flex-col gap-1.5">
                    {bots.map(bot => (
                      <button key={bot.id} onClick={() => setSelectedBotId(bot.id)}
                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all cursor-pointer"
                        style={{
                          background: selectedBotId === bot.id ? 'rgba(59,130,246,0.08)' : 'var(--surface-2)',
                          border: `1.5px solid ${selectedBotId === bot.id ? '#3b82f6' : 'var(--border)'}`,
                        }}>
                        <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                          style={{
                            background: selectedBotId === bot.id ? '#3b82f6' : 'transparent',
                            border: `1.5px solid ${selectedBotId === bot.id ? '#3b82f6' : 'var(--border)'}`,
                          }}>
                          {selectedBotId === bot.id && <Check size={10} color="#fff" strokeWidth={3} />}
                        </div>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{bot.name}</p>
                          <p className="text-xs font-mono" style={{ color: 'var(--text-3)' }}>{bot.url}</p>
                        </div>
                      </button>
                    ))}
                    {bots.length === 0 && (
                      <p className="text-sm px-1" style={{ color: 'var(--text-3)' }}>
                        Kein Bot konfiguriert. Bitte zuerst einen Bot im Bot-Dashboard einrichten.
                      </p>
                    )}
                  </div>
                </div>

                {/* Profil-Auswahl */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-2"
                    style={{ color: 'var(--text-3)' }}>
                    Ziel-Profil
                  </label>
                  <div className="flex flex-col gap-1.5">
                    {profiles.map(profile => (
                      <button key={profile.id} onClick={() => setSelectedProfileId(profile.id)}
                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all cursor-pointer"
                        style={{
                          background: selectedProfileId === profile.id ? 'rgba(59,130,246,0.08)' : 'var(--surface-2)',
                          border: `1.5px solid ${selectedProfileId === profile.id ? '#3b82f6' : 'var(--border)'}`,
                        }}>
                        <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                          style={{
                            background: selectedProfileId === profile.id ? '#3b82f6' : 'transparent',
                            border: `1.5px solid ${selectedProfileId === profile.id ? '#3b82f6' : 'var(--border)'}`,
                          }}>
                          {selectedProfileId === profile.id && <Check size={10} color="#fff" strokeWidth={3} />}
                        </div>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{profile.name}</p>
                          <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                            {profile.type === 'live' ? 'Live' : 'Demo'} · {profile.broker ?? '-'} · Startkapital: {profile.startCapital.toLocaleString('de-DE', { minimumFractionDigits: 2 })} {profile.currency}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 2: Vorschau */}
            {step === 'preview' && (
              <motion.div key="preview"
                initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
                className="px-5 py-5 flex flex-col gap-4">

                {/* Account-Info + Startkapital */}
                {account && (
                  <div className="rounded-xl px-4 py-4 flex flex-col gap-3"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-3)' }}>
                          MT5 Balance
                        </p>
                        <p className="text-lg font-black font-mono" style={{ color: 'var(--text-1)' }}>
                          {account.balance.toLocaleString('de-DE', { minimumFractionDigits: 2 })} {account.currency}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-3)' }}>
                          Equity
                        </p>
                        <p className="text-lg font-black font-mono" style={{ color: 'var(--text-1)' }}>
                          {account.equity.toLocaleString('de-DE', { minimumFractionDigits: 2 })} {account.currency}
                        </p>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-2)' }}>
                        Startkapital für Profil "{selectedProfile?.name}" setzen
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={startCapital}
                          onChange={e => setStartCapital(e.target.value)}
                          className="flex-1 px-3 py-2 rounded-lg text-sm font-mono outline-none"
                          style={{
                            background: 'var(--bg)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-1)',
                          }}
                          placeholder="z.B. 10000"
                        />
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-3)' }}>
                          {account.currency}
                        </span>
                        <button
                          onClick={() => setStartCapital(String(account.balance))}
                          className="px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-opacity hover:opacity-80"
                          style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.25)' }}>
                          Vom Konto
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Status-Banner */}
                <div className="flex items-center gap-4 px-4 py-3 rounded-lg flex-wrap"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  <span className="text-xs" style={{ color: 'var(--text-2)' }}>
                    <span className="font-bold" style={{ color: 'var(--text-1)' }}>{deals.length}</span> Trades gefunden
                  </span>
                  <span className="text-xs font-semibold" style={{ color: '#22c55e' }}>
                    {newCount} neu
                  </span>
                  {duplicateCount > 0 && (
                    <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                      {duplicateCount} bereits vorhanden (werden übersprungen)
                    </span>
                  )}
                  <span className="text-xs ml-auto" style={{ color: 'var(--text-3)' }}>
                    Profil: <span className="font-semibold" style={{ color: 'var(--text-2)' }}>{selectedProfile?.name}</span>
                  </span>
                </div>

                {/* Tabelle */}
                <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                          {['Symbol', 'Richtung', 'Eröffnung', 'Schließung', 'Entry', 'Exit', 'P&L', 'Lot', 'Status'].map(h => (
                            <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap"
                              style={{ color: 'var(--text-3)' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {deals.map((d, i) => {
                          const isDupe = existingIds.has(d.externalId)
                          return (
                            <tr key={i} style={{
                              borderBottom: i < deals.length - 1 ? '1px solid var(--border)' : undefined,
                              opacity: isDupe ? 0.35 : 1,
                            }}>
                              <td className="px-3 py-2 font-mono font-semibold whitespace-nowrap"
                                style={{ color: 'var(--text-1)' }}>
                                {d.instrument}
                              </td>
                              <td className="px-3 py-2">
                                <span className="flex items-center gap-1 whitespace-nowrap"
                                  style={{ color: d.type === 'long' ? '#22c55e' : '#ef4444' }}>
                                  {d.type === 'long'
                                    ? <TrendingUp size={10} />
                                    : <TrendingDown size={10} />}
                                  {d.type === 'long' ? 'Long' : 'Short'}
                                </span>
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--text-2)' }}>
                                {new Date(d.date).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--text-2)' }}>
                                {new Date(d.closeTime).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="px-3 py-2 font-mono whitespace-nowrap" style={{ color: 'var(--text-2)' }}>
                                {d.entry.toFixed(5)}
                              </td>
                              <td className="px-3 py-2 font-mono whitespace-nowrap" style={{ color: 'var(--text-2)' }}>
                                {d.exit.toFixed(5)}
                              </td>
                              <td className="px-3 py-2 font-mono font-semibold whitespace-nowrap"
                                style={{ color: d.pnl >= 0 ? '#22c55e' : '#ef4444' }}>
                                {d.pnl >= 0 ? '+' : ''}{d.pnl.toFixed(2)}
                              </td>
                              <td className="px-3 py-2 font-mono whitespace-nowrap" style={{ color: 'var(--text-2)' }}>
                                {d.size}
                              </td>
                              <td className="px-3 py-2">
                                {isDupe
                                  ? <span className="text-xs" style={{ color: 'var(--text-3)' }}>vorhanden</span>
                                  : <span className="px-1.5 py-0.5 rounded text-xs font-medium"
                                    style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                                    neu
                                  </span>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 3: Fertig */}
            {step === 'done' && result && (
              <motion.div key="done"
                initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center gap-4 px-6 py-12">
                <div className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(34,197,94,0.12)' }}>
                  <Check size={28} style={{ color: '#22c55e' }} strokeWidth={2.5} />
                </div>
                <div className="text-center">
                  <p className="text-base font-bold" style={{ color: 'var(--text-1)' }}>
                    {result.imported} Trade{result.imported !== 1 ? 's' : ''} importiert
                  </p>
                  {result.skipped > 0 && (
                    <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>
                      {result.skipped} bereits vorhandene übersprungen
                    </p>
                  )}
                  <p className="text-xs mt-2" style={{ color: 'var(--text-3)' }}>
                    Profil: {selectedProfile?.name}
                  </p>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 shrink-0"
          style={{ borderTop: '1px solid var(--border)' }}>

          {step === 'config' && (
            <>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                {bots.length === 0
                  ? 'Kein Bot konfiguriert'
                  : `Bot: ${bots.find(b => b.id === selectedBotId)?.name ?? '-'}`}
              </p>
              <div className="flex items-center gap-2">
                <button onClick={onClose}
                  className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                  Abbrechen
                </button>
                <button
                  disabled={!selectedBotId || !selectedProfileId || loading || bots.length === 0}
                  onClick={fetchHistory}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: '#3b82f6', color: '#fff' }}>
                  {loading
                    ? <RefreshCw size={13} className="animate-spin" />
                    : <Bot size={13} />}
                  {loading ? 'Lädt...' : 'Historie laden'}
                </button>
              </div>
            </>
          )}

          {step === 'preview' && (
            <>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                {newCount} von {deals.length} werden importiert
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => { setStep('config'); setDeals([]); setError(null) }}
                  className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                  Zurück
                </button>
                <button
                  disabled={newCount === 0 || isPending}
                  onClick={handleImport}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: newCount > 0 ? 'var(--accent)' : 'var(--surface-2)',
                    color: newCount > 0 ? '#fff' : 'var(--text-3)',
                    border: `1px solid ${newCount > 0 ? 'var(--accent)' : 'var(--border)'}`,
                  }}>
                  <Upload size={13} />
                  {isPending ? 'Importiere...' : `${newCount} Trade${newCount !== 1 ? 's' : ''} importieren`}
                </button>
              </div>
            </>
          )}

          {step === 'done' && (
            <div className="flex justify-end w-full">
              <button onClick={onClose}
                className="px-5 py-2 rounded-lg text-sm font-semibold cursor-pointer"
                style={{ background: 'var(--accent)', color: '#fff' }}>
                Fertig
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>,
    document.body
  )
}
