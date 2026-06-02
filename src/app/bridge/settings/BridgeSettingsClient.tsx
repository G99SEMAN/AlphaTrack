'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  SlidersHorizontal, Globe, KeyRound, User, Timer,
  Monitor, Eye, EyeOff, Save, AlertTriangle, CheckCircle,
  WifiOff, RefreshCw, Hash, RotateCcw,
} from 'lucide-react'
import { BotEntry } from '@/types/bot'
import { Profile } from '@/types/profile'

interface BridgeConfig {
  alphatrack_url: string
  api_key: string
  bridge_id: string
  bridge_name: string
  profile_id: string
  heartbeat_interval_sec: number
  trade_sync_interval_sec: number
  command_server_port: number
  mt5_login: number
  mt5_password: string
  mt5_server: string
  mt5_exe_path: string
  mt5_restart_wait_sec: number
  mt5_restart_max_attempts: number
  mt5_startup_wait_sec: number
}

interface Props {
  bots: BotEntry[]
  profiles: Profile[]
}

type SaveState = 'idle' | 'saving' | 'success' | 'error'

function Section({ title, icon: Icon, children, restartRequired }: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  restartRequired?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-2.5 px-5 py-3.5" style={{ borderBottom: '1px solid var(--border)' }}>
        <Icon size={15} style={{ color: 'var(--text-3)' }} />
        <p className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>{title}</p>
        {restartRequired && (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>
            <AlertTriangle size={9} />
            Neustart erforderlich
          </span>
        )}
      </div>
      <div className="px-5 py-4">{children}</div>
    </motion.div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 last:mb-0">
      <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-2)' }}>
        {label}
      </label>
      {children}
      {hint && <p className="text-[10px] mt-1" style={{ color: 'var(--text-3)' }}>{hint}</p>}
    </div>
  )
}

function Input({ value, onChange, type = 'text', readOnly, mono }: {
  value: string | number
  onChange?: (v: string) => void
  type?: string
  readOnly?: boolean
  mono?: boolean
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange?.(e.target.value)}
      readOnly={readOnly}
      className={`w-full px-3 py-2 rounded-xl text-sm outline-none transition-colors ${mono ? 'font-mono' : ''}`}
      style={{
        background: readOnly ? 'var(--surface-2)' : 'var(--bg)',
        border: '1px solid var(--border)',
        color: readOnly ? 'var(--text-3)' : 'var(--text-1)',
        cursor: readOnly ? 'default' : 'text',
      }}
    />
  )
}

function NumberInput({ value, onChange, min, max }: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={e => {
        const n = parseInt(e.target.value)
        if (!isNaN(n)) onChange(n)
      }}
      className="w-full px-3 py-2 rounded-xl text-sm outline-none font-mono"
      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
    />
  )
}

function SaveButton({ state, onClick }: { state: SaveState; onClick: () => void }) {
  return (
    <div className="flex items-center gap-2 mt-5">
      <button
        onClick={onClick}
        disabled={state === 'saving'}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all disabled:opacity-50"
        style={{ background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)' }}
      >
        {state === 'saving'
          ? <><RefreshCw size={13} className="animate-spin" />Speichern...</>
          : <><Save size={13} />Speichern</>}
      </button>
      {state === 'success' && (
        <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#22c55e' }}>
          <CheckCircle size={13} />Gespeichert
        </span>
      )}
      {state === 'error' && (
        <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#ef4444' }}>
          <AlertTriangle size={13} />Fehler beim Speichern
        </span>
      )}
    </div>
  )
}

export default function BridgeSettingsClient({ bots, profiles }: Props) {
  const [selectedBotId, setSelectedBotId] = useState<string>(bots[0]?.id ?? '')
  const [config, setConfig] = useState<BridgeConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [offline, setOffline] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const [saveState, setSaveState] = useState<Record<string, SaveState>>({
    connection: 'idle',
    identity: 'idle',
    intervals: 'idle',
    mt5: 'idle',
  })

  const loadConfig = useCallback(async (botId: string) => {
    if (!botId) return
    setLoading(true)
    setOffline(false)
    try {
      const res = await fetch(`/api/bridge/config?bridgeId=${botId}`)
      if (res.status === 503) { setOffline(true); return }
      if (res.ok) setConfig(await res.json())
    } catch {
      setOffline(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadConfig(selectedBotId) }, [selectedBotId, loadConfig])

  async function save(section: string, fields: Partial<BridgeConfig>) {
    setSaveState(s => ({ ...s, [section]: 'saving' }))
    try {
      const res = await fetch(`/api/bridge/config?bridgeId=${selectedBotId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      setSaveState(s => ({ ...s, [section]: res.ok ? 'success' : 'error' }))
      setTimeout(() => setSaveState(s => ({ ...s, [section]: 'idle' })), 3000)
    } catch {
      setSaveState(s => ({ ...s, [section]: 'error' }))
      setTimeout(() => setSaveState(s => ({ ...s, [section]: 'idle' })), 3000)
    }
  }

  function set<K extends keyof BridgeConfig>(key: K, value: BridgeConfig[K]) {
    setConfig(c => c ? { ...c, [key]: value } : c)
  }

  return (
    <main className="flex-1 min-w-0 p-4 md:p-6">

      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)' }}>
            <SlidersHorizontal size={20} style={{ color: '#6366f1' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Bridge Settings</h1>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>Konfiguration der Python-Bridge auf dem Mini PC</p>
          </div>
        </div>

        {/* Bot-Auswahl */}
        {bots.length > 1 && (
          <div className="flex gap-2">
            {bots.map(bot => (
              <button key={bot.id}
                onClick={() => setSelectedBotId(bot.id)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all"
                style={{
                  background: selectedBotId === bot.id ? 'var(--accent-bg)' : 'var(--surface)',
                  border: selectedBotId === bot.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                  color: selectedBotId === bot.id ? 'var(--accent)' : 'var(--text-2)',
                }}>
                {bot.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Kein Bot */}
      {bots.length === 0 && (
        <div className="rounded-2xl p-10 flex flex-col items-center text-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <SlidersHorizontal size={28} style={{ color: 'var(--text-3)', marginBottom: 12 }} />
          <p className="text-sm font-bold mb-1" style={{ color: 'var(--text-1)' }}>Kein Bot konfiguriert</p>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>Bitte zuerst einen Bot im Bridge-Dashboard registrieren.</p>
        </div>
      )}

      {/* Laden */}
      {loading && (
        <div className="flex items-center gap-2 py-10 justify-center">
          <RefreshCw size={16} className="animate-spin" style={{ color: 'var(--text-3)' }} />
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>Lade Konfiguration von Bridge...</p>
        </div>
      )}

      {/* Bridge offline */}
      {!loading && offline && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-8 flex flex-col items-center text-center"
          style={{ background: 'var(--surface)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(239,68,68,0.1)' }}>
            <WifiOff size={24} style={{ color: '#ef4444' }} />
          </div>
          <p className="text-sm font-bold mb-1" style={{ color: 'var(--text-1)' }}>Bridge nicht erreichbar</p>
          <p className="text-xs mb-4" style={{ color: 'var(--text-3)' }}>
            Die Python-Bridge muss laufen damit Einstellungen geladen werden können.
          </p>
          <button onClick={() => loadConfig(selectedBotId)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
            style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent)' }}>
            <RefreshCw size={12} />Erneut versuchen
          </button>
        </motion.div>
      )}

      {/* Settings-Sektionen */}
      {!loading && !offline && config && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Bridge-Verbindung */}
          <Section title="Bridge-Verbindung" icon={Globe}>
            <Field label="AlphaTrack URL"
              hint="URL der AlphaTrack-Webapp im Heimnetz">
              <Input value={config.alphatrack_url} mono
                onChange={v => set('alphatrack_url', v)} />
            </Field>
            <Field label="API-Key">
              <Input value={config.api_key} mono
                onChange={v => set('api_key', v)} />
            </Field>
            <SaveButton state={saveState.connection}
              onClick={() => save('connection', {
                alphatrack_url: config.alphatrack_url,
                api_key: config.api_key,
              })} />
          </Section>

          {/* Bridge-Identität */}
          <Section title="Bridge-Identität" icon={User}>
            <Field label="Bridge-Name">
              <Input value={config.bridge_name}
                onChange={v => set('bridge_name', v)} />
            </Field>
            <Field label="Profil-ID"
              hint="Trading-Profil dem diese Bridge zugeordnet ist">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input value={config.profile_id} mono
                    onChange={v => set('profile_id', v)} />
                </div>
                {profiles.length > 0 && (
                  <div className="relative group">
                    <select
                      value={config.profile_id}
                      onChange={e => set('profile_id', e.target.value)}
                      className="px-3 py-2 rounded-xl text-xs outline-none cursor-pointer h-full"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                      {profiles.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </Field>
            <Field label="Bridge-ID" hint="Automatisch vergeben - leeren erzwingt Neu-Registrierung">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input value={config.bridge_id || '(nicht registriert)'} mono readOnly />
                </div>
                {config.bridge_id && (
                  <button
                    onClick={() => set('bridge_id', '')}
                    title="Bridge-ID leeren (Neu-Registrierung beim nächsten Start)"
                    className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all"
                    style={{
                      background: 'rgba(239,68,68,0.08)',
                      border: '1px solid rgba(239,68,68,0.25)',
                      color: '#ef4444',
                    }}>
                    <RotateCcw size={11} />Reset
                  </button>
                )}
              </div>
            </Field>
            <SaveButton state={saveState.identity}
              onClick={() => save('identity', {
                bridge_name: config.bridge_name,
                profile_id: config.profile_id,
                bridge_id: config.bridge_id,
              })} />
          </Section>

          {/* Intervalle & Ports */}
          <Section title="Intervalle & Ports" icon={Timer} restartRequired>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Heartbeat (Sek)"
                hint="Wie oft die Bridge ihren Status sendet">
                <NumberInput value={config.heartbeat_interval_sec} min={1} max={60}
                  onChange={v => set('heartbeat_interval_sec', v)} />
              </Field>
              <Field label="Trade-Sync (Sek)"
                hint="Wie oft Trades synchronisiert werden">
                <NumberInput value={config.trade_sync_interval_sec} min={5} max={300}
                  onChange={v => set('trade_sync_interval_sec', v)} />
              </Field>
              <Field label="Command-Port"
                hint="Flask-Server Port (Neustart nötig)">
                <div className="flex items-center gap-2">
                  <Hash size={13} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                  <NumberInput value={config.command_server_port} min={1024} max={65535}
                    onChange={v => set('command_server_port', v)} />
                </div>
              </Field>
            </div>
            <SaveButton state={saveState.intervals}
              onClick={() => save('intervals', {
                heartbeat_interval_sec: config.heartbeat_interval_sec,
                trade_sync_interval_sec: config.trade_sync_interval_sec,
                command_server_port: config.command_server_port,
              })} />
          </Section>

          {/* MT5-Zugangsdaten */}
          <Section title="MetaTrader 5" icon={Monitor} restartRequired>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Login (Kontonummer)">
                <NumberInput value={config.mt5_login} min={0}
                  onChange={v => set('mt5_login', v)} />
              </Field>
              <Field label="Passwort">
                <div className="relative">
                  <Input
                    value={config.mt5_password}
                    type={showPassword ? 'text' : 'password'}
                    onChange={v => set('mt5_password', v)}
                    mono
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                    style={{ color: 'var(--text-3)' }}>
                    {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </Field>
            </div>
            <Field label="Server">
              <Input value={config.mt5_server}
                onChange={v => set('mt5_server', v)} />
            </Field>
            <Field label="MT5 Exe-Pfad"
              hint="Pfad zu terminal64.exe für automatischen Neustart">
              <Input value={config.mt5_exe_path} mono
                onChange={v => set('mt5_exe_path', v)} />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Wartezeit (Sek)">
                <NumberInput value={config.mt5_restart_wait_sec} min={1}
                  onChange={v => set('mt5_restart_wait_sec', v)} />
              </Field>
              <Field label="Max. Versuche">
                <NumberInput value={config.mt5_restart_max_attempts} min={1} max={10}
                  onChange={v => set('mt5_restart_max_attempts', v)} />
              </Field>
              <Field label="Startup-Wait (Sek)">
                <NumberInput value={config.mt5_startup_wait_sec} min={5}
                  onChange={v => set('mt5_startup_wait_sec', v)} />
              </Field>
            </div>
            <SaveButton state={saveState.mt5}
              onClick={() => save('mt5', {
                mt5_login: config.mt5_login,
                mt5_password: config.mt5_password,
                mt5_server: config.mt5_server,
                mt5_exe_path: config.mt5_exe_path,
                mt5_restart_wait_sec: config.mt5_restart_wait_sec,
                mt5_restart_max_attempts: config.mt5_restart_max_attempts,
                mt5_startup_wait_sec: config.mt5_startup_wait_sec,
              })} />
          </Section>

        </div>
      )}
    </main>
  )
}
