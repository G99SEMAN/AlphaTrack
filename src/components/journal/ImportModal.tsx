'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Upload, ChevronRight, Check, ArrowLeft, FileText, AlertCircle } from 'lucide-react'
import { Trade } from '@/types/trade'
import { parseMT5Html, extractInitialBalance } from '@/lib/parsers/mt5'
import { importTradesAction, updateStartCapitalAction } from '@/lib/actions'
import { useTranslations } from 'next-intl'

interface Broker {
  id: string
  name: string
  description: string
  fileTypes: string
  available: boolean
}

function getBrokers(t: ReturnType<typeof useTranslations<'journal.importModal'>>): Broker[] {
  return [
    {
      id: 'metatrader5',
      name: 'MetaTrader 5',
      description: t('brokerMt5Desc'),
      fileTypes: 'HTML',
      available: true,
    },
    {
      id: 'metatrader4',
      name: 'MetaTrader 4',
      description: t('brokerMt4Desc'),
      fileTypes: 'HTML, CSV',
      available: false,
    },
    {
      id: 'tradingview',
      name: 'TradingView',
      description: t('brokerTvDesc'),
      fileTypes: 'CSV',
      available: false,
    },
    {
      id: 'ctrader',
      name: 'cTrader',
      description: t('brokerCtraderDesc'),
      fileTypes: 'CSV',
      available: false,
    },
    {
      id: 'ninja',
      name: 'NinjaTrader',
      description: t('brokerNinjaDesc'),
      fileTypes: 'CSV',
      available: false,
    },
    {
      id: 'ibkr',
      name: 'Interactive Brokers',
      description: t('brokerIbkrDesc'),
      fileTypes: 'CSV',
      available: false,
    },
  ]
}

type Step = 'broker' | 'preview' | 'done'

interface Props {
  onClose: () => void
  existingExternalIds?: Set<string>
  profileStartCapital?: number
}

export default function ImportModal({ onClose, existingExternalIds = new Set(), profileStartCapital }: Props) {
  const t = useTranslations('journal.importModal')
  const brokers = getBrokers(t)
  const [selected, setSelected] = useState<string | null>(null)
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])
  const [step, setStep] = useState<Step>('broker')
  const [parsed, setParsed] = useState<Omit<Trade, 'id'>[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)
  const [balanceMismatch, setBalanceMismatch] = useState<{ reportBalance: number } | null>(null)
  const [capitalUpdated, setCapitalUpdated] = useState(false)

  const duplicateCount = parsed.filter(
    t => t.externalId && existingExternalIds.has(t.externalId)
  ).length
  const newCount = parsed.length - duplicateCount

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setParseError(null)
    setBalanceMismatch(null)
    setCapitalUpdated(false)

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const html = ev.target?.result as string
        const trades = parseMT5Html(html)
        if (trades.length === 0) {
          setParseError(t('noFileFound'))
          return
        }
        // Balance-Abgleich
        const reportBalance = extractInitialBalance(html)
        if (reportBalance !== null && profileStartCapital !== undefined && reportBalance !== profileStartCapital) {
          setBalanceMismatch({ reportBalance })
        }
        setParsed(trades)
        setStep('preview')
      } catch {
        setParseError(t('fileReadError'))
      }
    }
    reader.readAsText(file, 'utf-8')
  }

  function handleAcceptBalance(reportBalance: number) {
    startTransition(async () => {
      await updateStartCapitalAction(reportBalance)
      setBalanceMismatch(null)
      setCapitalUpdated(true)
    })
  }

  function handleImport() {
    startTransition(async () => {
      const res = await importTradesAction(parsed)
      setResult(res)
      setStep('done')
    })
  }

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', zIndex: 9999 }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.18 }}
        onClick={e => e.stopPropagation()}
        className="w-full rounded-xl overflow-hidden flex flex-col"
        style={{
          maxWidth: step === 'preview' ? 700 : 520,
          maxHeight: '90vh',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2">
            {step === 'preview' && (
              <button
                onClick={() => { setStep('broker'); setParsed([]); setParseError(null) }}
                className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer"
                style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}
              >
                <ArrowLeft size={13} />
              </button>
            )}
            <div>
              <h2 className="text-base font-bold" style={{ color: 'var(--text-1)' }}>
                {step === 'broker' && t('titleBroker')}
                {step === 'preview' && t('titlePreview')}
                {step === 'done' && t('titleDone')}
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                {step === 'broker' && t('subtitleBroker')}
                {step === 'preview' && t('subtitlePreview', { count: parsed.length })}
                {step === 'done' && t('subtitleDone')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer"
            style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">

            {/* Step 1: Broker-Auswahl */}
            {step === 'broker' && (
              <motion.div
                key="broker"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="px-4 py-4 flex flex-col gap-2"
              >
                <p className="text-xs font-semibold uppercase tracking-wide px-1 mb-1" style={{ color: 'var(--text-3)' }}>
                  {t('brokerPlatformLabel')}
                </p>

                {parseError && (
                  <div
                    className="flex items-start gap-2 px-3 py-2.5 rounded-lg mb-1"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
                  >
                    <AlertCircle size={14} className="shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                    <p className="text-xs" style={{ color: '#ef4444' }}>{parseError}</p>
                  </div>
                )}

                {brokers.map(broker => (
                  <button
                    key={broker.id}
                    type="button"
                    onClick={() => broker.available && setSelected(broker.id === selected ? null : broker.id)}
                    disabled={!broker.available}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all"
                    style={{
                      background: selected === broker.id ? 'var(--accent-bg)' : 'var(--surface-2)',
                      border: `1.5px solid ${selected === broker.id ? 'var(--accent)' : 'var(--border)'}`,
                      cursor: broker.available ? 'pointer' : 'default',
                      opacity: broker.available ? 1 : 0.5,
                    }}
                  >
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      style={{
                        background: selected === broker.id ? 'var(--accent)' : 'transparent',
                        border: `1.5px solid ${selected === broker.id ? 'var(--accent)' : 'var(--border)'}`,
                      }}
                    >
                      <AnimatePresence>
                        {selected === broker.id && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            transition={{ duration: 0.12 }}
                          >
                            <Check size={11} color="#fff" strokeWidth={3} />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
                          {broker.name}
                        </p>
                        <span
                          className="px-1.5 py-0.5 rounded text-xs font-medium"
                          style={{ background: 'var(--surface-3)', color: 'var(--text-3)', border: '1px solid var(--border)' }}
                        >
                          {broker.fileTypes}
                        </span>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                        {broker.description}
                      </p>
                    </div>

                    {!broker.available && (
                      <span
                        className="text-xs font-medium px-2 py-1 rounded shrink-0"
                        style={{ background: 'rgba(255,165,0,0.1)', color: '#f59e0b', border: '1px solid rgba(255,165,0,0.2)' }}
                      >
                        {t('comingSoon')}
                      </span>
                    )}
                  </button>
                ))}
              </motion.div>
            )}

            {/* Step 2: Preview */}
            {step === 'preview' && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                className="px-4 py-4"
              >
                {/* Balance-Mismatch Banner */}
                {balanceMismatch && (
                  <div
                    className="flex flex-col gap-2 px-3 py-3 rounded-lg mb-3"
                    style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle size={14} className="shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold" style={{ color: '#f59e0b' }}>
                          {t('balanceMismatchTitle')}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>
                          {t('reportLabel')} <span className="font-mono font-semibold">{balanceMismatch.reportBalance.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                          {' · '}
                          {t('profileLabel')} <span className="font-mono font-semibold">{profileStartCapital?.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-5">
                      <button
                        onClick={() => handleAcceptBalance(balanceMismatch.reportBalance)}
                        disabled={isPending}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                        style={{ background: '#f59e0b', color: '#fff', opacity: isPending ? 0.7 : 1 }}
                      >
                        {t('acceptBalance', { balance: balanceMismatch.reportBalance.toLocaleString('de-DE', { minimumFractionDigits: 2 }) })}
                      </button>
                      <button
                        onClick={() => setBalanceMismatch(null)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                        style={{ color: 'var(--text-3)' }}
                      >
                        {t('keepBalance')}
                      </button>
                    </div>
                  </div>
                )}

                {capitalUpdated && (
                  <div
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg mb-3"
                    style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}
                  >
                    <Check size={13} style={{ color: '#22c55e' }} />
                    <p className="text-xs" style={{ color: '#22c55e' }}>{t('capitalUpdated')}</p>
                  </div>
                )}

                {/* Status-Banner */}
                <div
                  className="flex items-center gap-4 px-3 py-2.5 rounded-lg mb-4 flex-wrap"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                >
                  <span className="text-xs" style={{ color: 'var(--text-2)' }}>
                    <span className="font-bold" style={{ color: 'var(--text-1)' }}>{parsed.length}</span> {t('positionsFoundSuffix')}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: '#22c55e' }}>
                    {newCount} {t('newSuffix')}
                  </span>
                  {duplicateCount > 0 && (
                    <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                      {duplicateCount} {t('alreadyExistsSuffix')}
                    </span>
                  )}
                </div>

                {/* Tabelle */}
                <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                        {[t('tableSymbol'), t('tableDirection'), t('tableDate'), t('tableEntry'), t('tableExit'), t('tablePnl'), t('tableLot'), t('tableStatus')].map(h => (
                          <th key={h} className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--text-3)' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.map((trade, i) => {
                        const isDupe = trade.externalId ? existingExternalIds.has(trade.externalId) : false
                        return (
                          <tr
                            key={i}
                            style={{
                              borderBottom: i < parsed.length - 1 ? '1px solid var(--border)' : undefined,
                              opacity: isDupe ? 0.4 : 1,
                            }}
                          >
                            <td className="px-3 py-2 font-mono font-medium" style={{ color: 'var(--text-1)' }}>
                              {trade.instrument}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className="px-1.5 py-0.5 rounded text-xs font-semibold"
                                style={{
                                  background: trade.type === 'long' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                                  color: trade.type === 'long' ? '#22c55e' : '#ef4444',
                                }}
                              >
                                {trade.type === 'long' ? t('long') : t('short')}
                              </span>
                            </td>
                            <td className="px-3 py-2" style={{ color: 'var(--text-2)' }}>
                              {new Date(trade.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                            </td>
                            <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-2)' }}>
                              {trade.entry}
                            </td>
                            <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-2)' }}>
                              {trade.exit ?? '-'}
                            </td>
                            <td
                              className="px-3 py-2 font-mono font-semibold"
                              style={{
                                color: trade.pnl !== undefined
                                  ? (trade.pnl >= 0 ? '#22c55e' : '#ef4444')
                                  : 'var(--text-3)',
                              }}
                            >
                              {trade.pnl !== undefined ? (trade.pnl >= 0 ? '+' : '') + trade.pnl.toFixed(2) : '-'}
                            </td>
                            <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-2)' }}>
                              {trade.size}
                            </td>
                            <td className="px-3 py-2">
                              {isDupe ? (
                                <span className="text-xs" style={{ color: 'var(--text-3)' }}>{t('existing')}</span>
                              ) : (
                                <span
                                  className="px-1.5 py-0.5 rounded text-xs font-medium"
                                  style={{
                                    background: trade.status === 'open' ? 'rgba(249,115,22,0.1)' : 'rgba(34,197,94,0.1)',
                                    color: trade.status === 'open' ? '#f97316' : '#22c55e',
                                  }}
                                >
                                  {trade.status === 'open' ? t('statusOpen') : t('statusClosed')}
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {/* Step 3: Fertig */}
            {step === 'done' && result && (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center gap-4 px-6 py-10"
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(34,197,94,0.12)' }}
                >
                  <Check size={28} style={{ color: '#22c55e' }} strokeWidth={2.5} />
                </div>
                <div className="text-center">
                  <p className="text-base font-bold" style={{ color: 'var(--text-1)' }}>
                    {result.imported === 1 ? t('importedOne', { count: result.imported }) : t('importedMany', { count: result.imported })}
                  </p>
                  {result.skipped > 0 && (
                    <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>
                      {t('skippedCount', { count: result.skipped })}
                    </p>
                  )}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between gap-3 px-5 py-3.5 shrink-0"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          {step === 'broker' && (
            <>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                {selected
                  ? t('selectedBroker', { name: brokers.find(b => b.id === selected)?.name ?? '' })
                  : t('noBrokerSelected')}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
                >
                  {t('cancelBtn')}
                </button>
                <button
                  type="button"
                  disabled={!selected}
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
                  style={{
                    background: selected ? 'var(--accent)' : 'var(--surface-2)',
                    color: selected ? '#fff' : 'var(--text-3)',
                    border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                    cursor: selected ? 'pointer' : 'not-allowed',
                    opacity: selected ? 1 : 0.6,
                  }}
                >
                  <FileText size={14} />
                  {t('selectFileBtn')}
                  <ChevronRight size={13} />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".html,.htm"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </>
          )}

          {step === 'preview' && (
            <>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                {t('willImportOf', { newCount, total: parsed.length })}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setStep('broker'); setParsed([]) }}
                  className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
                >
                  {t('backBtn')}
                </button>
                <button
                  type="button"
                  disabled={newCount === 0 || isPending}
                  onClick={handleImport}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
                  style={{
                    background: newCount > 0 ? 'var(--accent)' : 'var(--surface-2)',
                    color: newCount > 0 ? '#fff' : 'var(--text-3)',
                    border: `1px solid ${newCount > 0 ? 'var(--accent)' : 'var(--border)'}`,
                    cursor: newCount > 0 && !isPending ? 'pointer' : 'not-allowed',
                    opacity: newCount > 0 && !isPending ? 1 : 0.6,
                  }}
                >
                  <Upload size={14} />
                  {isPending ? t('importingBtn') : (newCount === 1 ? t('importBtnOne', { count: newCount }) : t('importBtnMany', { count: newCount }))}
                </button>
              </div>
            </>
          )}

          {step === 'done' && (
            <div className="flex justify-end w-full">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-lg text-sm font-semibold cursor-pointer"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                {t('doneBtn')}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>,
    document.body
  )
}
