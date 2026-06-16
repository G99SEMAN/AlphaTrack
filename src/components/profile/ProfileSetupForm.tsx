'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { addProfileFromModalAction, finishSetupAction, importBridgeHistoryAction } from '@/lib/actions'
import { PROFILE_COLORS, PROFILE_ICONS, PROFILE_ICON_MAP } from '@/types/profile'
import { Banknote, Gamepad2, ChevronRight, Check, AlertCircle, History, SkipForward, Loader2 } from 'lucide-react'

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'USDT']

const BROKERS = [
  'BlackBull Markets', 'Binance', 'Bybit', 'Interactive Brokers', 'Trade Republic',
  'DEGIRO', 'comdirect', 'Flatex', 'XTB', 'IG Markets', 'Sonstiger',
]

interface Props {
  isFirstProfile?: boolean
  onClose?: () => void
}

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

  // Schritt 4 - Trade-Sync
  const [syncPhase, setSyncPhase] = useState<'choice' | 'loading' | 'done' | 'no_bridge'>('choice')
  const [syncImported, setSyncImported] = useState<number>(0)

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

  async function handleFinish() {
    if (onClose) {
      onClose()
      router.push('/dashboard')
      return
    }
    await finishSetupAction()
  }

  async function handleBridgeSync() {
    setSyncPhase('loading')
    const result = await importBridgeHistoryAction()
    if (!result.ok) {
      setSyncPhase('no_bridge')
      return
    }
    setSyncImported(result.imported)
    setSyncPhase('done')
  }

  const cardStyle = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    boxShadow: 'var(--card-shadow)',
    padding: '2rem',
    width: '100%',
    maxWidth: 480,
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

  const stepLabels = ['Profil-Typ', 'Broker & Kapital', 'Details', 'Trade-Sync']

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

      {/* Schritt 4: Trade-Sync */}
      {step === 4 && (
        <motion.div
          key="step4"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-col gap-5"
        >
          <div>
            <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text-1)' }}>
              Trades synchronisieren
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>
              Möchtest du bestehende Trades aus MetaTrader laden oder erst ab heute dokumentieren?
            </p>
          </div>

          <AnimatePresence mode="wait">

            {/* Auswahl */}
            {syncPhase === 'choice' && (
              <motion.div
                key="choice"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-3"
              >
                <button
                  type="button"
                  onClick={handleBridgeSync}
                  className="w-full flex items-center gap-4 px-4 py-4 rounded-xl text-left transition-all cursor-pointer"
                  style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'var(--accent-bg)' }}
                  >
                    <History size={20} style={{ color: 'var(--accent)' }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
                      Alle historischen Trades laden
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>
                      Bridge muss verbunden sein — lädt alle bisherigen Trades aus MetaTrader
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleFinish}
                  className="w-full flex items-center gap-4 px-4 py-4 rounded-xl text-left transition-all cursor-pointer"
                  style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'var(--surface-3)' }}
                  >
                    <SkipForward size={20} style={{ color: 'var(--text-3)' }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
                      Erst ab heute dokumentieren
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>
                      Keine historischen Daten — neue Trades werden ab sofort erfasst
                    </p>
                  </div>
                </button>
              </motion.div>
            )}

            {/* Laden */}
            {syncPhase === 'loading' && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center gap-3 py-8"
              >
                <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent)' }} />
                <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                  Historische Trades werden geladen…
                </p>
              </motion.div>
            )}

            {/* Keine Bridge */}
            {syncPhase === 'no_bridge' && (
              <motion.div
                key="no_bridge"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col gap-4"
              >
                <div
                  className="px-4 py-3 rounded-xl"
                  style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}
                >
                  <p className="text-sm font-semibold" style={{ color: '#f59e0b' }}>
                    Keine Bridge verbunden
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-2)' }}>
                    Du kannst den historischen Import später unter Einstellungen nachholen, sobald die Bridge verbunden ist.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleFinish}
                  className="w-full py-3 rounded-xl font-semibold text-sm cursor-pointer"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  Zum Dashboard
                </button>
              </motion.div>
            )}

            {/* Fertig */}
            {syncPhase === 'done' && (
              <motion.div
                key="done"
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
                    {syncImported} Trade{syncImported !== 1 ? 's' : ''} importiert
                  </p>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>
                    Alle historischen Trades wurden synchronisiert
                  </p>
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
