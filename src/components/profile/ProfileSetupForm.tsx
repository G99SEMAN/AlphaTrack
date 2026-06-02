'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { addProfileFromModalAction, importTradesAction, updateStartCapitalAction, finishSetupAction } from '@/lib/actions'
import { PROFILE_COLORS, PROFILE_ICONS, PROFILE_ICON_MAP } from '@/types/profile'
import { Trade } from '@/types/trade'
import { Banknote, Gamepad2, ChevronRight, Check, Upload, AlertCircle, FileText, ArrowLeft } from 'lucide-react'
import { extractInitialBalance, parseMT5Html } from '@/lib/parsers/mt5'


const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'USDT']

const BROKERS = [
  'BlackBull Markets', 'Binance', 'Bybit', 'Interactive Brokers', 'Trade Republic',
  'DEGIRO', 'comdirect', 'Flatex', 'XTB', 'IG Markets', 'Sonstiger',
]

const IMPORT_BROKERS = [
  { id: 'metatrader5', name: 'MetaTrader 5', description: 'Kontoauszug als HTML exportieren (Rechtsklick → Als HTML speichern)', fileTypes: 'HTML', available: true },
  { id: 'metatrader4', name: 'MetaTrader 4', description: 'Kontoauszug als HTML oder CSV exportieren', fileTypes: 'HTML, CSV', available: false },
  { id: 'tradingview', name: 'TradingView', description: 'Trade-History als CSV exportieren', fileTypes: 'CSV', available: false },
  { id: 'ctrader', name: 'cTrader', description: 'Kontoauszug als CSV exportieren', fileTypes: 'CSV', available: false },
  { id: 'ninja', name: 'NinjaTrader', description: 'Performance-Report als CSV exportieren', fileTypes: 'CSV', available: false },
  { id: 'ibkr', name: 'Interactive Brokers', description: 'Activity Statement als CSV exportieren', fileTypes: 'CSV', available: false },
]

interface Props {
  isFirstProfile?: boolean
  onClose?: () => void
}

type ImportSubStep = 'broker' | 'preview' | 'done'

export default function ProfileSetupForm({ isFirstProfile, onClose }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [pending, setPending] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '',
    type: 'live' as 'live' | 'demo',
    broker: '',
    brokerCustom: '',
    startCapital: '',
    currency: 'EUR',
    color: PROFILE_COLORS[0],
    icon: '',
    notes: '',
  })

  // Step 4 - Import
  const [importSubStep, setImportSubStep] = useState<ImportSubStep>('broker')
  const [importBrokerSelected, setImportBrokerSelected] = useState<string | null>(null)
  const [importParsed, setImportParsed] = useState<Omit<Trade, 'id'>[]>([])
  const [importParseError, setImportParseError] = useState<string | null>(null)
  const [importBalanceMismatch, setImportBalanceMismatch] = useState<{ reportBalance: number } | null>(null)
  const [importCapitalUpdated, setImportCapitalUpdated] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null)
  const [isPending, startTransition] = useTransition()
  const importFileRef4 = useRef<HTMLInputElement>(null)

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }))
  const brokerValue = form.broker === 'Sonstiger' ? form.brokerCustom : form.broker

  async function handleCreateProfile() {
    if (!form.name || !brokerValue || !form.startCapital) return
    setPending(true)
    setCreateError(null)
    const fd = new FormData()
    fd.set('name', form.name)
    fd.set('type', form.type)
    fd.set('broker', brokerValue)
    fd.set('startCapital', form.startCapital)
    fd.set('currency', form.currency)
    fd.set('color', form.color)
    fd.set('icon', form.icon)
    fd.set('notes', form.notes)
    try {
      await addProfileFromModalAction(fd)
      setStep(4)
    } catch {
      setCreateError('Profil konnte nicht gespeichert werden. Bitte versuche es erneut.')
    } finally {
      setPending(false)
    }
  }

  function handleImportFile4(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportParseError(null)
    setImportBalanceMismatch(null)
    setImportCapitalUpdated(false)

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const html = ev.target?.result as string
        const trades = parseMT5Html(html)
        if (trades.length === 0) {
          setImportParseError('Keine Positionen gefunden. Bitte eine MT5-Kontohistorie im HTML-Format hochladen.')
          return
        }
        const reportBalance = extractInitialBalance(html)
        const enteredCapital = parseFloat(form.startCapital)
        if (reportBalance !== null && !isNaN(enteredCapital) && reportBalance !== enteredCapital) {
          setImportBalanceMismatch({ reportBalance })
        }
        setImportParsed(trades)
        setImportSubStep('preview')
      } catch {
        setImportParseError('Datei konnte nicht gelesen werden. Bitte eine gultige MT5-HTML-Datei verwenden.')
      }
    }
    reader.readAsText(file, 'utf-8')
    e.target.value = ''
  }

  function handleAcceptBalance(reportBalance: number) {
    startTransition(async () => {
      await updateStartCapitalAction(reportBalance)
      setImportBalanceMismatch(null)
      setImportCapitalUpdated(true)
    })
  }

  function handleDoImport() {
    startTransition(async () => {
      const res = await importTradesAction(importParsed)
      setImportResult(res)
      setImportSubStep('done')
    })
  }

  async function handleFinish() {
    if (onClose) {
      onClose()
      router.push('/dashboard')
      return
    }
    await finishSetupAction()
  }

  const isWidePreview = step === 4 && importSubStep === 'preview'

  const cardStyle = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    boxShadow: 'var(--card-shadow)',
    padding: '2rem',
    width: '100%',
    maxWidth: isWidePreview ? 700 : 480,
    transition: 'max-width 0.3s ease',
  }

  const inputStyle = {
    width: '100%',
    padding: '0.65rem 0.9rem',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--surface-2)',
    color: 'var(--text-1)',
    fontSize: 14,
    outline: 'none',
    fontFamily: 'inherit',
  }

  const labelStyle = {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-2)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginBottom: 6,
    display: 'block',
  }

  const stepLabels = ['Profil-Typ', 'Broker & Kapital', 'Details', 'Trade-Import']

  return (
    <motion.div
      style={cardStyle}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      {/* Schrittanzeige */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3, 4].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all shrink-0"
              style={{
                background: step >= s ? 'var(--accent)' : 'var(--surface-3)',
                color: step >= s ? '#fff' : 'var(--text-3)',
              }}
            >
              {step > s ? <Check size={12} /> : s}
            </div>
            {s < 4 && (
              <div
                className="h-0.5 w-6 rounded shrink-0"
                style={{ background: step > s ? 'var(--accent)' : 'var(--border)' }}
              />
            )}
          </div>
        ))}
        <p className="ml-2 text-xs" style={{ color: 'var(--text-3)' }}>
          {stepLabels[step - 1]}
        </p>
      </div>

      {/* Schritt 1: Name + Typ */}
      {step === 1 && (
        <motion.div
          key="step1"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-col gap-5"
        >
          <div>
            <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text-1)' }}>
              {isFirstProfile ? 'Dein erstes Profil' : 'Neues Profil'}
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>
              Gib deinem Profil einen Namen und wahle den Handelsmodus.
            </p>
          </div>

          <div>
            <label style={labelStyle}>Profilname</label>
            <input
              style={inputStyle}
              placeholder='z.B. "Echtgeld - Bybit" oder "Demo Account"'
              value={form.name}
              onChange={e => set('name', e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label style={labelStyle}>Handelsmodus</label>
            <div className="grid grid-cols-2 gap-3">
              {([
                { value: 'live', label: 'Echtgeld', desc: 'Echtes Kapital im Einsatz', Icon: Banknote },
                { value: 'demo', label: 'Spielgeld', desc: 'Demo / Paper Trading', Icon: Gamepad2 },
              ] as const).map(({ value, label, desc, Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => set('type', value)}
                  className="flex flex-col gap-2 p-4 rounded-xl text-left transition-all cursor-pointer"
                  style={{
                    border: `2px solid ${form.type === value ? 'var(--accent)' : 'var(--border)'}`,
                    background: form.type === value ? 'var(--accent-bg)' : 'var(--surface-2)',
                  }}
                >
                  <Icon size={20} style={{ color: form.type === value ? 'var(--accent)' : 'var(--text-3)' }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{label}</p>
                    <p className="text-xs" style={{ color: 'var(--text-2)' }}>{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Profilfarbe</label>
            <div className="flex gap-2">
              {PROFILE_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => set('color', color)}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-transform cursor-pointer"
                  style={{
                    background: color,
                    transform: form.color === color ? 'scale(1.2)' : 'scale(1)',
                    boxShadow: form.color === color ? `0 0 0 3px var(--surface), 0 0 0 5px ${color}` : 'none',
                  }}
                >
                  {form.color === color && <Check size={14} color="#fff" strokeWidth={3} />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Profilbild (optional)</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => set('icon', '')}
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all cursor-pointer"
                style={{
                  background: form.icon === '' ? form.color : 'var(--surface-2)',
                  border: form.icon === '' ? `2px solid ${form.color}` : '2px solid var(--border)',
                  color: form.icon === '' ? '#fff' : 'var(--text-2)',
                  boxShadow: form.icon === '' ? `0 0 0 2px var(--surface), 0 0 0 4px ${form.color}` : 'none',
                }}
              >
                {form.name ? form.name.charAt(0).toUpperCase() : 'A'}
              </button>
              {PROFILE_ICONS.map(iconName => {
                const IconComp = PROFILE_ICON_MAP[iconName]
                const isSelected = form.icon === iconName
                return (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => set('icon', iconName)}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer"
                    style={{
                      background: isSelected ? form.color : 'var(--surface-2)',
                      border: `2px solid ${isSelected ? form.color : 'var(--border)'}`,
                      color: isSelected ? '#fff' : 'var(--text-2)',
                      boxShadow: isSelected ? `0 0 0 2px var(--surface), 0 0 0 4px ${form.color}` : 'none',
                    }}
                    title={iconName}
                  >
                    <IconComp size={14} />
                  </button>
                )
              })}
            </div>
          </div>

          <button
            onClick={() => form.name.trim() && setStep(2)}
            disabled={!form.name.trim()}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm transition-all cursor-pointer"
            style={{
              background: form.name.trim() ? 'var(--accent)' : 'var(--surface-3)',
              color: form.name.trim() ? '#fff' : 'var(--text-3)',
            }}
          >
            Weiter <ChevronRight size={16} />
          </button>
        </motion.div>
      )}

      {/* Schritt 2: Broker + Kapital */}
      {step === 2 && (
        <motion.div
          key="step2"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-col gap-5"
        >
          <div>
            <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text-1)' }}>
              Broker & Startkapital
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>
              Mit welchem Broker und wie viel Kapital startest du?
            </p>
          </div>

          <div>
            <label style={labelStyle}>Broker / Borse</label>
            <select
              style={{ ...inputStyle, cursor: 'pointer' }}
              value={form.broker}
              onChange={e => set('broker', e.target.value)}
            >
              <option value="">Broker wahlen...</option>
              {BROKERS.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            {form.broker === 'Sonstiger' && (
              <input
                style={{ ...inputStyle, marginTop: 8 }}
                placeholder="Broker-Name eingeben"
                value={form.brokerCustom}
                onChange={e => set('brokerCustom', e.target.value)}
                autoFocus
              />
            )}
          </div>

          <div>
            <label style={labelStyle}>Startkapital</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  style={{ ...inputStyle, paddingRight: 70, fontFamily: 'var(--font-dm-mono, monospace)' }}
                  type="number"
                  placeholder="500"
                  min="0"
                  step="0.01"
                  value={form.startCapital}
                  onChange={e => set('startCapital', e.target.value)}
                />
                <span
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono"
                  style={{ color: 'var(--text-3)' }}
                >
                  {form.currency}
                </span>
              </div>
              <select
                style={{ ...inputStyle, width: 80, flexShrink: 0 }}
                value={form.currency}
                onChange={e => set('currency', e.target.value)}
              >
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all cursor-pointer"
              style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
            >
              Zuruck
            </button>
            <button
              onClick={() => (form.broker || form.brokerCustom) && form.startCapital && setStep(3)}
              disabled={!(form.broker || form.brokerCustom) || !form.startCapital}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all cursor-pointer"
              style={{
                background: (form.broker || form.brokerCustom) && form.startCapital ? 'var(--accent)' : 'var(--surface-3)',
                color: (form.broker || form.brokerCustom) && form.startCapital ? '#fff' : 'var(--text-3)',
              }}
            >
              Weiter <ChevronRight size={16} />
            </button>
          </div>
        </motion.div>
      )}

      {/* Schritt 3: Zusammenfassung + Notizen */}
      {step === 3 && (
        <motion.div
          key="step3"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-col gap-5"
        >
          <div>
            <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text-1)' }}>
              Zusammenfassung
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>
              Alles korrekt? Im nachsten Schritt kannst du bestehende Trades importieren.
            </p>
          </div>

          {/* Vorschau-Karte */}
          <div
            className="rounded-xl p-4 flex items-center gap-3"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0"
              style={{ background: form.color }}
            >
              {form.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-1)' }}>{form.name}</p>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    background: form.type === 'live' ? 'var(--green-bg)' : 'var(--accent-bg)',
                    color: form.type === 'live' ? 'var(--green)' : 'var(--accent)',
                  }}
                >
                  {form.type === 'live' ? 'Echtgeld' : 'Spielgeld'}
                </span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>
                {brokerValue} · Start: {parseFloat(form.startCapital || '0').toLocaleString('de-DE')} {form.currency}
              </p>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Notizen (optional)</label>
            <textarea
              style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }}
              placeholder="Ziele, Strategie oder sonstige Anmerkungen..."
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>

          {createError && (
            <div
              className="flex items-start gap-2 px-3 py-2.5 rounded-lg"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              <AlertCircle size={14} className="shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
              <p className="text-xs" style={{ color: '#ef4444' }}>{createError}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all cursor-pointer"
              style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
            >
              Zuruck
            </button>
            <button
              onClick={handleCreateProfile}
              disabled={pending}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all cursor-pointer"
              style={{ background: 'var(--accent)', color: '#fff', opacity: pending ? 0.7 : 1 }}
            >
              {pending ? 'Wird erstellt...' : <>Weiter <ChevronRight size={16} /></>}
            </button>
          </div>
        </motion.div>
      )}

      {/* Schritt 4: Trade-Import */}
      {step === 4 && (
        <motion.div
          key="step4"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-col gap-5"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text-1)' }}>
                Trades importieren
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                Importiere bestehende Trades direkt ins Journal - oder uberspringe diesen Schritt.
              </p>
            </div>
            {importSubStep !== 'done' && (
              <button
                type="button"
                onClick={handleFinish}
                className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all"
                style={{ background: 'var(--surface-2)', color: 'var(--text-3)', border: '1px solid var(--border)' }}
              >
                Uberspringen
              </button>
            )}
          </div>

          <AnimatePresence mode="wait">

            {/* Sub-Step: Broker-Auswahl */}
            {importSubStep === 'broker' && (
              <motion.div
                key="import-broker"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex flex-col gap-2"
              >
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
                  Plattform auswahlen
                </p>

                {importParseError && (
                  <div
                    className="flex items-start gap-2 px-3 py-2.5 rounded-lg"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
                  >
                    <AlertCircle size={14} className="shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                    <p className="text-xs" style={{ color: '#ef4444' }}>{importParseError}</p>
                  </div>
                )}

                {IMPORT_BROKERS.map(broker => (
                  <button
                    key={broker.id}
                    type="button"
                    onClick={() => broker.available && setImportBrokerSelected(broker.id === importBrokerSelected ? null : broker.id)}
                    disabled={!broker.available}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all"
                    style={{
                      background: importBrokerSelected === broker.id ? 'var(--accent-bg)' : 'var(--surface-2)',
                      border: `1.5px solid ${importBrokerSelected === broker.id ? 'var(--accent)' : 'var(--border)'}`,
                      cursor: broker.available ? 'pointer' : 'default',
                      opacity: broker.available ? 1 : 0.5,
                    }}
                  >
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      style={{
                        background: importBrokerSelected === broker.id ? 'var(--accent)' : 'transparent',
                        border: `1.5px solid ${importBrokerSelected === broker.id ? 'var(--accent)' : 'var(--border)'}`,
                      }}
                    >
                      <AnimatePresence>
                        {importBrokerSelected === broker.id && (
                          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ duration: 0.12 }}>
                            <Check size={11} color="#fff" strokeWidth={3} />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{broker.name}</p>
                        <span className="px-1.5 py-0.5 rounded text-xs font-medium" style={{ background: 'var(--surface-3)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
                          {broker.fileTypes}
                        </span>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{broker.description}</p>
                    </div>
                    {!broker.available && (
                      <span className="text-xs font-medium px-2 py-1 rounded shrink-0" style={{ background: 'rgba(255,165,0,0.1)', color: '#f59e0b', border: '1px solid rgba(255,165,0,0.2)' }}>
                        Bald
                      </span>
                    )}
                  </button>
                ))}

                <div className="flex items-center justify-between gap-3 pt-1">
                  <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                    {importBrokerSelected ? `${IMPORT_BROKERS.find(b => b.id === importBrokerSelected)?.name} ausgewahlt` : 'Keinen Broker ausgewahlt'}
                  </p>
                  <button
                    type="button"
                    disabled={!importBrokerSelected}
                    onClick={() => importFileRef4.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
                    style={{
                      background: importBrokerSelected ? 'var(--accent)' : 'var(--surface-2)',
                      color: importBrokerSelected ? '#fff' : 'var(--text-3)',
                      border: `1px solid ${importBrokerSelected ? 'var(--accent)' : 'var(--border)'}`,
                      cursor: importBrokerSelected ? 'pointer' : 'not-allowed',
                      opacity: importBrokerSelected ? 1 : 0.6,
                    }}
                  >
                    <FileText size={14} />
                    Datei auswahlen
                    <ChevronRight size={13} />
                  </button>
                  <input
                    ref={importFileRef4}
                    type="file"
                    accept=".html,.htm"
                    className="hidden"
                    onChange={handleImportFile4}
                  />
                </div>
              </motion.div>
            )}

            {/* Sub-Step: Vorschau */}
            {importSubStep === 'preview' && (
              <motion.div
                key="import-preview"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex flex-col gap-3"
              >
                {/* Balance-Mismatch Banner */}
                {importBalanceMismatch && (
                  <div
                    className="flex flex-col gap-2 px-3 py-3 rounded-lg"
                    style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle size={14} className="shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold" style={{ color: '#f59e0b' }}>
                          Startkapital stimmt nicht uberein
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>
                          Bericht: <span className="font-mono font-semibold">{importBalanceMismatch.reportBalance.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                          {' · '}
                          Profil: <span className="font-mono font-semibold">{parseFloat(form.startCapital || '0').toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-5">
                      <button
                        onClick={() => handleAcceptBalance(importBalanceMismatch.reportBalance)}
                        disabled={isPending}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                        style={{ background: '#f59e0b', color: '#fff', opacity: isPending ? 0.7 : 1 }}
                      >
                        Ja, auf {importBalanceMismatch.reportBalance.toLocaleString('de-DE', { minimumFractionDigits: 2 })} anpassen
                      </button>
                      <button
                        onClick={() => setImportBalanceMismatch(null)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                        style={{ color: 'var(--text-3)' }}
                      >
                        Nein, beibehalten
                      </button>
                    </div>
                  </div>
                )}

                {importCapitalUpdated && (
                  <div
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
                    style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}
                  >
                    <Check size={13} style={{ color: '#22c55e' }} />
                    <p className="text-xs" style={{ color: '#22c55e' }}>Startkapital im Profil aktualisiert</p>
                  </div>
                )}

                {/* Status-Banner */}
                <div
                  className="flex items-center gap-4 px-3 py-2.5 rounded-lg flex-wrap"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                >
                  <span className="text-xs" style={{ color: 'var(--text-2)' }}>
                    <span className="font-bold" style={{ color: 'var(--text-1)' }}>{importParsed.length}</span> Positionen gefunden
                  </span>
                  <span className="text-xs font-semibold" style={{ color: '#22c55e' }}>
                    {importParsed.length} neu
                  </span>
                </div>

                {/* Tabelle */}
                <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)', maxHeight: 280, overflowY: 'auto', overflowX: 'auto' }}>
                  <table className="w-full text-xs" style={{ minWidth: 480 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                        {['Symbol', 'Richtung', 'Datum', 'Entry', 'Exit', 'P&L', 'Lot'].map(h => (
                          <th key={h} className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--text-3)' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importParsed.map((t, i) => (
                        <tr
                          key={i}
                          style={{ borderBottom: i < importParsed.length - 1 ? '1px solid var(--border)' : undefined }}
                        >
                          <td className="px-3 py-2 font-mono font-medium" style={{ color: 'var(--text-1)' }}>{t.instrument}</td>
                          <td className="px-3 py-2">
                            <span
                              className="px-1.5 py-0.5 rounded text-xs font-semibold"
                              style={{
                                background: t.type === 'long' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                                color: t.type === 'long' ? '#22c55e' : '#ef4444',
                              }}
                            >
                              {t.type === 'long' ? 'Long' : 'Short'}
                            </span>
                          </td>
                          <td className="px-3 py-2" style={{ color: 'var(--text-2)' }}>
                            {new Date(t.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                          </td>
                          <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-2)' }}>{t.entry}</td>
                          <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-2)' }}>{t.exit ?? '-'}</td>
                          <td
                            className="px-3 py-2 font-mono font-semibold"
                            style={{ color: t.pnl !== undefined ? (t.pnl >= 0 ? '#22c55e' : '#ef4444') : 'var(--text-3)' }}
                          >
                            {t.pnl !== undefined ? (t.pnl >= 0 ? '+' : '') + t.pnl.toFixed(2) : '-'}
                          </td>
                          <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-2)' }}>{t.size}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Buttons */}
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => { setImportSubStep('broker'); setImportParsed([]); setImportParseError(null); setImportBalanceMismatch(null) }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
                    style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
                  >
                    <ArrowLeft size={14} /> Zuruck
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={handleDoImport}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer"
                    style={{ background: 'var(--accent)', color: '#fff', opacity: isPending ? 0.7 : 1 }}
                  >
                    <Upload size={14} />
                    {isPending ? 'Importiere...' : `${importParsed.length} Trade${importParsed.length !== 1 ? 's' : ''} importieren`}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Sub-Step: Fertig */}
            {importSubStep === 'done' && importResult && (
              <motion.div
                key="import-done"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-4 py-6"
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(34,197,94,0.12)' }}
                >
                  <Check size={28} style={{ color: '#22c55e' }} strokeWidth={2.5} />
                </div>
                <div className="text-center">
                  <p className="text-base font-bold" style={{ color: 'var(--text-1)' }}>
                    {importResult.imported} Trade{importResult.imported !== 1 ? 's' : ''} importiert
                  </p>
                  {importResult.skipped > 0 && (
                    <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>
                      {importResult.skipped} bereits vorhandene ubersprungen
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleFinish}
                  className="px-6 py-2.5 rounded-xl font-semibold text-sm cursor-pointer"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  Zum Dashboard
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </motion.div>
      )}
    </motion.div>
  )
}
