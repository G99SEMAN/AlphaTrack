'use client'

import { useState, useTransition, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, Trash2, Plus, User, PiggyBank, Copy, CheckCheck } from 'lucide-react'
import { Profile, PROFILE_COLORS, PROFILE_ICONS, PROFILE_ICON_MAP } from '@/types/profile'
import { currencySymbol } from '@/lib/currency'
import { updateProfileAction, addDepositAction, deleteDepositAction } from '@/lib/actions'
import { Banknote, Gamepad2 } from 'lucide-react'

const BROKERS = [
  'BlackBull Markets', 'Binance', 'Bybit', 'Interactive Brokers', 'Trade Republic',
  'DEGIRO', 'comdirect', 'Flatex', 'XTB', 'IG Markets', 'Sonstiger',
]

interface Props {
  profile: Profile
  onClose: () => void
}

const inputStyle = {
  width: '100%',
  padding: '0.6rem 0.85rem',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--surface-2)',
  color: 'var(--text-1)',
  fontSize: 14,
  outline: 'none',
  fontFamily: 'inherit',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-3)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 5,
  display: 'block',
}

function ProfileIdField({ profileId }: { profileId: string }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(profileId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <label style={labelStyle}>Profil-ID <span style={{ color: 'var(--text-3)', fontWeight: 400, textTransform: 'none' }}>(für Bot config.json)</span></label>
      <div className="flex items-center gap-2">
        <span
          className="flex-1 px-3 py-2 rounded-xl text-xs font-mono select-all"
          style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text-2)', letterSpacing: '0.04em' }}
        >
          {profileId}
        </span>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all"
          style={{
            background: copied ? 'rgba(0,217,126,0.1)' : 'var(--surface-2)',
            border: `1px solid ${copied ? 'var(--green)' : 'var(--border)'}`,
            color: copied ? 'var(--green)' : 'var(--text-3)',
          }}
          title="Kopieren"
        >
          {copied ? <CheckCheck size={13} /> : <Copy size={13} />}
        </button>
      </div>
    </div>
  )
}

export default function ProfileEditModal({ profile, onClose }: Props) {
  const [tab, setTab] = useState<'profile' | 'deposits'>('profile')
  const [isPending, startTransition] = useTransition()

  // Profil-Felder
  const [name, setName] = useState(profile.name)
  const [currency, setCurrency] = useState(profile.currency)
  const [type, setType] = useState<'live' | 'demo'>(profile.type)
  const [broker, setBroker] = useState(
    !profile.broker ? '' :
    BROKERS.includes(profile.broker) ? profile.broker : 'Sonstiger'
  )
  const [brokerCustom, setBrokerCustom] = useState(
    !profile.broker || BROKERS.includes(profile.broker) ? '' : profile.broker
  )
  const [saveError, setSaveError] = useState<string | null>(null)
  const [color, setColor] = useState(profile.color)
  const [icon, setIcon] = useState(profile.icon ?? '')
  const [notes, setNotes] = useState(profile.notes ?? '')

  // Einzahlungs-Formular
  const today = new Date().toISOString().slice(0, 10)
  const [depDate, setDepDate] = useState(today)
  const [depAmount, setDepAmount] = useState('')
  const [depNote, setDepNote] = useState('')

  const brokerValue = broker === 'Sonstiger' ? brokerCustom : broker

  function handleSaveProfile() {
    if (!name.trim() || !brokerValue) return
    setSaveError(null)
    const fd = new FormData()
    fd.set('name', name.trim())
    fd.set('type', type)
    fd.set('broker', brokerValue)
    fd.set('color', color)
    fd.set('icon', icon)
    fd.set('notes', notes)
    fd.set('currency', currency)
    startTransition(async () => {
      try {
        await updateProfileAction(profile.id, fd)
        onClose()
      } catch {
        setSaveError('Speichern fehlgeschlagen. Bitte erneut versuchen.')
      }
    })
  }

  function handleAddDeposit() {
    const amount = parseFloat(depAmount)
    if (!depDate || isNaN(amount) || amount <= 0) return
    const fd = new FormData()
    fd.set('date', depDate)
    fd.set('amount', String(amount))
    fd.set('note', depNote)
    startTransition(async () => {
      await addDepositAction(profile.id, fd)
      setDepAmount('')
      setDepNote('')
    })
  }

  function handleDeleteDeposit(id: string) {
    startTransition(async () => {
      await deleteDepositAction(profile.id, id)
    })
  }

  const deposits = profile.deposits ?? []
  const totalDeposited = deposits.reduce((s, d) => s + d.amount, 0)

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])
  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.18 }}
          className="w-full max-w-md rounded-2xl flex flex-col overflow-hidden"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--card-shadow)',
            maxHeight: '90vh',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                style={{ background: profile.color }}
              >
                {profile.name.charAt(0).toUpperCase()}
              </div>
              <p className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>
                {profile.name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-colors"
              style={{ color: 'var(--text-3)', background: 'var(--surface-2)' }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Tabs */}
          <div
            className="flex px-5 gap-1 pt-3 pb-0"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            {([
              { key: 'profile', label: 'Profil', Icon: User },
              { key: 'deposits', label: 'Einzahlungen', Icon: PiggyBank },
            ] as const).map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold transition-all cursor-pointer rounded-t-lg"
                style={{
                  color: tab === key ? 'var(--accent)' : 'var(--text-3)',
                  borderBottom: tab === key ? '2px solid var(--accent)' : '2px solid transparent',
                  marginBottom: -1,
                }}
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>

          {/* Inhalt */}
          <div className="flex-1 overflow-y-auto px-5 py-4">

            {/* Tab: Profil */}
            {tab === 'profile' && (
              <div className="flex flex-col gap-4">
                <div>
                  <label style={labelStyle}>Profilname</label>
                  <input
                    style={inputStyle}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    autoFocus
                  />
                </div>

                <div>
                  <label style={labelStyle}>Handelsmodus</label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { value: 'live', label: 'Echtgeld', Icon: Banknote },
                      { value: 'demo', label: 'Spielgeld', Icon: Gamepad2 },
                    ] as const).map(({ value, label, Icon }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setType(value)}
                        className="flex items-center gap-2 p-3 rounded-xl text-left transition-all cursor-pointer"
                        style={{
                          border: `2px solid ${type === value ? 'var(--accent)' : 'var(--border)'}`,
                          background: type === value ? 'var(--accent-bg)' : 'var(--surface-2)',
                        }}
                      >
                        <Icon size={15} style={{ color: type === value ? 'var(--accent)' : 'var(--text-3)' }} />
                        <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Broker</label>
                  <select
                    style={{ ...inputStyle, cursor: 'pointer' }}
                    value={broker}
                    onChange={e => setBroker(e.target.value)}
                  >
                    <option value="">Broker wählen…</option>
                    {BROKERS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                  {broker === 'Sonstiger' && (
                    <input
                      style={{ ...inputStyle, marginTop: 6 }}
                      placeholder="Broker-Name"
                      value={brokerCustom}
                      onChange={e => setBrokerCustom(e.target.value)}
                    />
                  )}
                </div>

                <div>
                  <label style={labelStyle}>Währung</label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { value: 'EUR', label: '€ Euro' },
                      { value: 'USD', label: '$ US-Dollar' },
                      { value: 'GBP', label: '£ Britisches Pfund' },
                      { value: 'CHF', label: 'CHF Schweizer Franken' },
                    ] as const).map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setCurrency(value)}
                        className="flex items-center gap-2 p-2.5 rounded-xl text-left transition-all cursor-pointer text-sm"
                        style={{
                          border: `2px solid ${currency === value ? 'var(--accent)' : 'var(--border)'}`,
                          background: currency === value ? 'var(--accent-bg)' : 'var(--surface-2)',
                          color: currency === value ? 'var(--accent)' : 'var(--text-2)',
                          fontWeight: currency === value ? 600 : 400,
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Profilfarbe</label>
                  <div className="flex gap-2.5">
                    {PROFILE_COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className="w-8 h-8 rounded-full flex items-center justify-center transition-transform cursor-pointer"
                        style={{
                          background: c,
                          transform: color === c ? 'scale(1.2)' : 'scale(1)',
                          boxShadow: color === c ? `0 0 0 3px var(--surface), 0 0 0 5px ${c}` : 'none',
                        }}
                      >
                        {color === c && <Check size={13} color="#fff" strokeWidth={3} />}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Profilbild (optional)</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setIcon('')}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all cursor-pointer"
                      style={{
                        background: icon === '' ? color : 'var(--surface-2)',
                        border: `2px solid ${icon === '' ? color : 'var(--border)'}`,
                        color: icon === '' ? '#fff' : 'var(--text-2)',
                        boxShadow: icon === '' ? `0 0 0 2px var(--surface), 0 0 0 4px ${color}` : 'none',
                      }}
                    >
                      {name ? name.charAt(0).toUpperCase() : 'A'}
                    </button>
                    {PROFILE_ICONS.map(iconName => {
                      const IconComp = PROFILE_ICON_MAP[iconName]
                      const isSelected = icon === iconName
                      return (
                        <button
                          key={iconName}
                          type="button"
                          onClick={() => setIcon(iconName)}
                          className="w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer"
                          style={{
                            background: isSelected ? color : 'var(--surface-2)',
                            border: `2px solid ${isSelected ? color : 'var(--border)'}`,
                            color: isSelected ? '#fff' : 'var(--text-2)',
                            boxShadow: isSelected ? `0 0 0 2px var(--surface), 0 0 0 4px ${color}` : 'none',
                          }}
                          title={iconName}
                        >
                          <IconComp size={14} />
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Notizen</label>
                  <textarea
                    style={{ ...inputStyle, resize: 'vertical', minHeight: 68 }}
                    placeholder="Ziele, Strategie oder Anmerkungen..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>

                {/* Profil-ID (für Bot-Konfiguration) */}
                <ProfileIdField profileId={profile.id} />

                {saveError && (
                  <p className="text-xs text-center" style={{ color: 'var(--red)' }}>{saveError}</p>
                )}
                {(!name.trim() || !brokerValue) && !isPending && (
                  <p className="text-xs text-center" style={{ color: 'var(--text-3)' }}>
                    {!name.trim() ? 'Profilname ist erforderlich.' : 'Bitte wähle einen Broker.'}
                  </p>
                )}
                <button
                  onClick={handleSaveProfile}
                  disabled={isPending || !name.trim() || !brokerValue}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: (!name.trim() || !brokerValue) && !isPending ? 'var(--surface-3)' : 'var(--accent)',
                    color: (!name.trim() || !brokerValue) && !isPending ? 'var(--text-3)' : '#fff',
                    cursor: (isPending || !name.trim() || !brokerValue) ? 'not-allowed' : 'pointer',
                    opacity: isPending ? 0.7 : 1,
                  }}
                >
                  {isPending ? 'Wird gespeichert…' : 'Änderungen speichern'}
                </button>
              </div>
            )}

            {/* Tab: Einzahlungen */}
            {tab === 'deposits' && (
              <div className="flex flex-col gap-4">
                {/* Startkapital Info */}
                <div
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                >
                  <span style={{ color: 'var(--text-2)' }}>Startkapital</span>
                  <span className="font-mono font-semibold" style={{ color: 'var(--text-1)' }}>
                    {profile.startCapital.toLocaleString('de-DE')} {currencySymbol(profile.currency)}
                  </span>
                </div>

                {/* Bestehende Einzahlungen */}
                {deposits.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
                      Nacheinzahlungen
                    </p>
                    {deposits
                      .slice()
                      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                      .map(dep => (
                        <div
                          key={dep.id}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-semibold" style={{ color: 'var(--green)' }}>
                                +{dep.amount.toLocaleString('de-DE')} {currencySymbol(profile.currency)}
                              </span>
                              <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                                {new Date(dep.date).toLocaleDateString('de-DE')}
                              </span>
                            </div>
                            {dep.note && (
                              <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-3)' }}>
                                {dep.note}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteDeposit(dep.id)}
                            disabled={isPending}
                            className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-colors shrink-0"
                            style={{ color: 'var(--text-3)' }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}

                    {/* Gesamt */}
                    <div
                      className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold"
                      style={{ background: 'var(--surface-3)' }}
                    >
                      <span style={{ color: 'var(--text-3)' }}>Gesamt eingezahlt</span>
                      <span className="font-mono" style={{ color: 'var(--text-1)' }}>
                        {(profile.startCapital + totalDeposited).toLocaleString('de-DE')} {currencySymbol(profile.currency)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Neue Einzahlung */}
                <div
                  className="flex flex-col gap-3 p-3 rounded-xl"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                >
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
                    Neue Einzahlung
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label style={labelStyle}>Datum</label>
                      <input
                        type="date"
                        style={inputStyle}
                        value={depDate}
                        onChange={e => setDepDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Betrag ({currencySymbol(profile.currency)})</label>
                      <input
                        type="number"
                        style={{ ...inputStyle, fontFamily: 'monospace' }}
                        placeholder="0.00"
                        min="0.01"
                        step="0.01"
                        value={depAmount}
                        onChange={e => setDepAmount(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Notiz (optional)</label>
                    <input
                      style={inputStyle}
                      placeholder="z.B. Monatliches Add-on"
                      value={depNote}
                      onChange={e => setDepNote(e.target.value)}
                    />
                  </div>
                  <button
                    onClick={handleAddDeposit}
                    disabled={isPending || !depAmount || parseFloat(depAmount) <= 0}
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all"
                    style={{
                      background: 'var(--green-bg)',
                      color: 'var(--green)',
                      border: '1px solid var(--green)',
                      opacity: isPending ? 0.7 : 1,
                    }}
                  >
                    <Plus size={14} />
                    Einzahlung hinzufügen
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}
