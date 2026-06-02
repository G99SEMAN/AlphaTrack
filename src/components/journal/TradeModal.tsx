'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { X, TrendingUp, TrendingDown, Loader2, ImagePlus, Trash2 } from 'lucide-react'
import { Trade } from '@/types/trade'
import { Strategy } from '@/types/strategy'
import { createTradeAction, updateTradeAction } from '@/lib/actions'

interface Props {
  trade?: Trade
  strategies: Strategy[]
  broker?: string
  onClose: () => void
}

const INSTRUMENTS = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CHF', 'NZD/USD', 'USD/CAD', 'EUR/GBP', 'XAU/USD', 'BTC/USDT']

export default function TradeModal({ trade, strategies, broker, onClose }: Props) {
  const [mounted, setMounted] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [saveError, setSaveError] = useState<string | null>(null)
  const [direction, setDirection] = useState<'long' | 'short'>(trade?.type ?? 'long')
  const [status, setStatus] = useState<'open' | 'closed' | 'cancelled'>(trade?.status ?? 'open')
  const [entry, setEntry] = useState<string>(trade?.entry?.toString() ?? '')
  const [tp, setTp] = useState<string>(trade?.tp?.toString() ?? '')
  const [sl, setSl] = useState<string>(trade?.sl?.toString() ?? '')
  const [size, setSize] = useState<string>(trade?.size?.toString() ?? '')
  const [commission, setCommission] = useState<string>(trade?.commission?.toString() ?? '')
  const [swap, setSwap] = useState<string>(trade?.swap?.toString() ?? '')
  const [spreadCost, setSpreadCost] = useState<string>(trade?.spreadCost?.toString() ?? '')
  const [pnlValue, setPnlValue] = useState<string>(trade?.pnl?.toString() ?? '')
  const [outcome, setOutcome] = useState<'win' | 'loss' | null>(trade?.outcome ?? null)

  const isBlackBull = broker === 'BlackBull Markets'

  function calcBlackBullCommission() {
    const lots = parseFloat(size)
    if (!isNaN(lots) && lots > 0) setCommission((lots * 6).toFixed(2))
  }
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(trade?.screenshot ?? null)
  const [removeScreenshot, setRemoveScreenshot] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const isEdit = !!trade

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setRemoveScreenshot(false)
    const reader = new FileReader()
    reader.onload = () => setScreenshotPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  function handleRemoveScreenshot() {
    setScreenshotPreview(null)
    setRemoveScreenshot(true)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const computedRR = (() => {
    const e = parseFloat(entry)
    const t = parseFloat(tp)
    const s = parseFloat(sl)
    if (isNaN(e) || isNaN(t) || isNaN(s)) return null
    const reward = direction === 'long' ? t - e : e - t
    const risk = direction === 'long' ? e - s : s - e
    if (risk <= 0) return null
    return Math.round((reward / risk) * 100) / 100
  })()

  useEffect(() => {
    setMounted(true)
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])
  if (!mounted) return null

  const today = new Date().toISOString().slice(0, 16)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const form = formRef.current
    if (!form) return
    const fd = new FormData(form)
    fd.set('type', direction)
    fd.set('status', status)
    fd.set('removeScreenshot', removeScreenshot ? 'true' : 'false')
    if (!pnlValue && outcome) fd.set('outcome', outcome)
    else if (pnlValue) fd.delete('outcome')

    setSaveError(null)
    startTransition(async () => {
      try {
        if (isEdit) {
          await updateTradeAction(trade!.id, fd)
        } else {
          await createTradeAction(fd)
        }
        onClose()
      } catch {
        setSaveError('Trade konnte nicht gespeichert werden.')
      }
    })
  }

  const inputClass = "w-full px-3 py-2 rounded-lg text-sm outline-none transition-all"
  const inputStyle = {
    background: 'var(--surface-3)',
    border: '1px solid var(--border)',
    color: 'var(--text-1)',
  }
  const labelClass = "block text-xs font-semibold mb-1.5 uppercase tracking-wide"

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.8)', zIndex: 9999 }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.18 }}
        onClick={e => e.stopPropagation()}
        className="relative w-full my-auto"
        style={{ maxWidth: 540 }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 rounded-t-xl"
          style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
        >
          <div>
            <h2 className="text-base font-bold" style={{ color: 'var(--text-1)' }}>
              {isEdit ? 'Trade bearbeiten' : 'Neuer Trade'}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
              {isEdit ? `ID: ${trade!.id}` : 'Trade eintragen und speichern'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all"
            style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Form */}
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="rounded-b-xl"
          style={{ background: 'var(--surface)' }}
        >
          <div className="px-5 py-4 flex flex-col gap-4">

            {/* Richtung Toggle */}
            <div>
              <label className={labelClass} style={{ color: 'var(--text-3)' }}>
                Richtung
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['long', 'short'] as const).map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDirection(d)}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition-all"
                    style={{
                      background: direction === d
                        ? d === 'long' ? 'rgba(0,217,126,0.15)' : 'rgba(255,69,96,0.15)'
                        : 'var(--surface-2)',
                      border: `1.5px solid ${direction === d
                        ? d === 'long' ? 'var(--green)' : 'var(--red)'
                        : 'var(--border)'}`,
                      color: direction === d
                        ? d === 'long' ? 'var(--green)' : 'var(--red)'
                        : 'var(--text-2)',
                    }}
                  >
                    {d === 'long' ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                    {d === 'long' ? 'Long' : 'Short'}
                  </button>
                ))}
              </div>
            </div>

            {/* Strategie */}
            {strategies.length > 0 && (
              <div>
                <label className={labelClass} style={{ color: 'var(--text-3)' }}>
                  Strategie
                </label>
                <select
                  name="strategyId"
                  defaultValue={trade?.strategyId ?? ''}
                  className={inputClass}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  <option value="">Keine Strategie</option>
                  {strategies.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.timeframe})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Datum + Instrument */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} style={{ color: 'var(--text-3)' }}>
                  Öffnungszeit
                </label>
                <input
                  name="date"
                  type="datetime-local"
                  defaultValue={trade?.date ? trade.date.slice(0, 16) : today}
                  required
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className={labelClass} style={{ color: 'var(--text-3)' }}>
                  Instrument
                </label>
                <input
                  name="instrument"
                  list="instruments-list"
                  defaultValue={trade?.instrument ?? ''}
                  placeholder="z.B. EUR/USD"
                  required
                  className={inputClass}
                  style={inputStyle}
                />
                <datalist id="instruments-list">
                  {INSTRUMENTS.map(i => <option key={i} value={i} />)}
                </datalist>
              </div>
            </div>

            {/* Schließzeit - nur bei closed */}
            {status === 'closed' && (
              <div>
                <label className={labelClass} style={{ color: 'var(--text-3)' }}>
                  Schließzeit
                </label>
                <input
                  name="closeTime"
                  type="datetime-local"
                  defaultValue={trade?.closeTime ? trade.closeTime.slice(0, 16) : ''}
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
            )}

            {/* Entry + Exit + Size */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass} style={{ color: 'var(--text-3)' }}>
                  Einstieg
                </label>
                <input
                  name="entry"
                  type="number"
                  step="any"
                  value={entry}
                  onChange={e => setEntry(e.target.value)}
                  placeholder="0.00"
                  required
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className={labelClass} style={{ color: 'var(--text-3)' }}>
                  Ausstieg
                </label>
                <input
                  name="exit"
                  type="number"
                  step="any"
                  defaultValue={trade?.exit ?? ''}
                  placeholder="0.00"
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className={labelClass} style={{ color: 'var(--text-3)' }}>
                  Grosse / Lots
                </label>
                <input
                  name="size"
                  type="number"
                  step="any"
                  value={size}
                  onChange={e => setSize(e.target.value)}
                  placeholder="0.01"
                  required
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* TP + SL + RR */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass} style={{ color: 'var(--text-3)' }}>
                  Take Profit
                </label>
                <input
                  name="tp"
                  type="number"
                  step="any"
                  value={tp}
                  onChange={e => setTp(e.target.value)}
                  placeholder="0.00"
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className={labelClass} style={{ color: 'var(--text-3)' }}>
                  Stop Loss
                </label>
                <input
                  name="sl"
                  type="number"
                  step="any"
                  value={sl}
                  onChange={e => setSl(e.target.value)}
                  placeholder="0.00"
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className={labelClass} style={{ color: 'var(--text-3)' }}>
                  Risk/Reward
                </label>
                <input type="hidden" name="rr" value={computedRR ?? ''} />
                <div
                  className="w-full px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5"
                  style={{
                    background: 'var(--surface-3)',
                    border: '1px solid var(--border)',
                    color: computedRR === null
                      ? 'var(--text-3)'
                      : computedRR >= 1
                        ? 'var(--green)'
                        : 'var(--red)',
                    opacity: computedRR === null ? 0.5 : 1,
                  }}
                >
                  {computedRR === null ? (
                    <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>Automatisch</span>
                  ) : (
                    <>
                      <span>1 : {computedRR}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* P&L */}
            <div>
              <label className={labelClass} style={{ color: 'var(--text-3)' }}>
                P&L (Brutto)
              </label>
              <input
                name="pnl"
                type="number"
                step="any"
                value={pnlValue}
                onChange={e => {
                  setPnlValue(e.target.value)
                  if (e.target.value) setOutcome(null)
                }}
                placeholder="+150.00"
                className={inputClass}
                style={inputStyle}
              />
              {!pnlValue && (
                <div className="flex items-center gap-2 mt-2">
                  <input type="hidden" name="outcome" value={outcome ?? ''} />
                  <button
                    type="button"
                    onClick={() => setOutcome(v => v === 'win' ? null : 'win')}
                    className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                    style={{
                      background: outcome === 'win' ? 'rgba(0,217,126,0.18)' : 'var(--surface-3)',
                      color: outcome === 'win' ? 'var(--green)' : 'var(--text-3)',
                      border: outcome === 'win' ? '1px solid rgba(0,217,126,0.4)' : '1px solid var(--border)',
                    }}
                  >
                    WIN
                  </button>
                  <button
                    type="button"
                    onClick={() => setOutcome(v => v === 'loss' ? null : 'loss')}
                    className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                    style={{
                      background: outcome === 'loss' ? 'rgba(255,69,96,0.18)' : 'var(--surface-3)',
                      color: outcome === 'loss' ? 'var(--red)' : 'var(--text-3)',
                      border: outcome === 'loss' ? '1px solid rgba(255,69,96,0.4)' : '1px solid var(--border)',
                    }}
                  >
                    LOSS
                  </button>
                </div>
              )}
            </div>

            {/* Kosten */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={labelClass} style={{ color: 'var(--text-3)', marginBottom: 0 }}>
                  Kosten & Gebühren
                </label>
                {isBlackBull && (
                  <button
                    type="button"
                    onClick={calcBlackBullCommission}
                    className="text-xs px-2 py-1 rounded-md font-semibold cursor-pointer transition-all"
                    style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent)' }}
                  >
                    BlackBull Auto ($6/Lot)
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Kommission</p>
                  <input
                    name="commission"
                    type="number"
                    step="any"
                    value={commission}
                    onChange={e => setCommission(e.target.value)}
                    placeholder="0.00"
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Swap / Overnight</p>
                  <input
                    name="swap"
                    type="number"
                    step="any"
                    value={swap}
                    onChange={e => setSwap(e.target.value)}
                    placeholder="0.00"
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Spread-Kosten</p>
                  <input
                    name="spreadCost"
                    type="number"
                    step="any"
                    value={spreadCost}
                    onChange={e => setSpreadCost(e.target.value)}
                    placeholder="0.00"
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
              </div>
              {(commission || swap || spreadCost) && (
                <p className="text-xs mt-1.5 font-mono" style={{ color: 'var(--red)' }}>
                  Gesamt: -{(
                    (parseFloat(commission) || 0) +
                    (parseFloat(swap) || 0) +
                    (parseFloat(spreadCost) || 0)
                  ).toFixed(2)}
                </p>
              )}
            </div>

            {/* Status */}
            <div>
              <label className={labelClass} style={{ color: 'var(--text-3)' }}>
                Status
              </label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { val: 'open', label: 'Offen', color: 'var(--accent)' },
                  { val: 'closed', label: 'Geschlossen', color: 'var(--green)' },
                  { val: 'cancelled', label: 'Abgebrochen', color: 'var(--text-3)' },
                ] as const).map(({ val, label, color }) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setStatus(val)}
                    className="py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                    style={{
                      background: status === val ? `${color}22` : 'var(--surface-2)',
                      border: `1.5px solid ${status === val ? color : 'var(--border)'}`,
                      color: status === val ? color : 'var(--text-2)',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className={labelClass} style={{ color: 'var(--text-3)' }}>
                Tags <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(Komma-getrennt)</span>
              </label>
              <input
                name="tags"
                type="text"
                defaultValue={trade?.tags?.join(', ') ?? ''}
                placeholder="breakout, trend, news"
                className={inputClass}
                style={inputStyle}
              />
            </div>

            {/* Screenshot */}
            <div>
              <label className={labelClass} style={{ color: 'var(--text-3)' }}>
                Chart Screenshot
              </label>
              <input
                ref={fileInputRef}
                name="screenshot"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleFileChange}
                className="hidden"
              />
              {screenshotPreview ? (
                <div className="relative rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={screenshotPreview}
                    alt="Chart Screenshot"
                    className="w-full object-cover"
                    style={{ maxHeight: 200 }}
                  />
                  <div className="absolute top-2 right-2 flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer"
                      style={{ background: 'rgba(0,0,0,0.7)', color: '#fff', backdropFilter: 'blur(4px)' }}
                    >
                      <ImagePlus size={12} />
                      Ersetzen
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveScreenshot}
                      className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-semibold cursor-pointer"
                      style={{ background: 'rgba(255,69,96,0.8)', color: '#fff', backdropFilter: 'blur(4px)' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-2 py-6 rounded-lg cursor-pointer transition-all"
                  style={{
                    background: 'var(--surface-3)',
                    border: '1.5px dashed var(--border)',
                    color: 'var(--text-3)',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'
                    ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'
                    ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-3)'
                  }}
                >
                  <ImagePlus size={20} />
                  <span className="text-xs font-medium">Chart-Screenshot hochladen</span>
                  <span className="text-xs opacity-60">PNG, JPG, WebP</span>
                </button>
              )}
            </div>

            {/* Notizen */}
            <div>
              <label className={labelClass} style={{ color: 'var(--text-3)' }}>
                Notizen
              </label>
              <textarea
                name="notes"
                defaultValue={trade?.notes ?? ''}
                placeholder="Setup-Beschreibung, Gedanken, Lessons Learned..."
                rows={3}
                className={inputClass + ' resize-none'}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-end gap-2 px-5 py-3.5"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all"
              style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all"
              style={{
                background: isPending ? 'var(--accent-bg)' : 'var(--accent)',
                color: isPending ? 'var(--accent)' : '#fff',
                border: '1px solid var(--accent)',
              }}
            >
              {isPending && <Loader2 size={14} className="animate-spin" />}
              {isEdit ? 'Speichern' : 'Trade hinzufugen'}
            </button>
          </div>
          {saveError && (
            <p className="text-xs text-center mt-2" style={{ color: 'var(--red)' }}>{saveError}</p>
          )}
        </form>
      </motion.div>
    </div>,
    document.body
  )
}
