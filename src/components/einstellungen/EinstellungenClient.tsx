'use client'

import { useTheme } from 'next-themes'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Sun, Moon, Download, Upload, CheckCircle, XCircle, Package, Image, BarChart2, Palette, Clock, Banknote, Gamepad2, Check, Pencil, Trash2, AlertTriangle, Plus, RotateCcw, ShieldAlert } from 'lucide-react'
import { useStatsSettings, StatsSettings } from '@/hooks/useStatsSettings'
import { useAccentTheme, AccentTheme } from '@/hooks/useAccentTheme'
import { useTranslations, useLocale } from 'next-intl'
import { setLocaleAction } from '@/lib/locale'
import type { AppLocale } from '@/i18n/request'
import { useSessionSettings } from '@/hooks/useSessionSettings'
import { Profile, PROFILE_ICON_MAP } from '@/types/profile'
import { switchProfileAction, deleteProfileAction, stopBotsForProfileAction, checkStopAcknowledgedAction, resetTradesAction } from '@/lib/actions'
import ProfileEditModal from '@/components/profile/ProfileEditModal'
import ProfileSetupModal from '@/components/profile/ProfileSetupModal'

interface Props {
  profiles: Profile[]
  activeProfile: Profile | null
}

type Tab = 'darstellung' | 'dashboard' | 'profile' | 'daten'

type ImportStatus =
  | { type: 'success'; profileCount: number; screenshotCount: number; fileCount: number }
  | { type: 'error'; message: string }
  | null

export default function EinstellungenClient({ profiles, activeProfile }: Props) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('darstellung')
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importStatus, setImportStatus] = useState<ImportStatus>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(profiles.map(p => p.id)))
  const [deleteConfirm, setDeleteConfirm] = useState<Profile | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteStatusMsg, setDeleteStatusMsg] = useState<string | null>(null)
  const [switching, setSwitching] = useState<string | null>(null)
  const [showEditModal, setShowEditModal] = useState<Profile | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetResult, setResetResult] = useState<
    | { type: 'success'; deletedJournal: number; deletedBridge: number; cutoffSet: boolean; bridgeOffline: boolean }
    | { type: 'error' }
    | null
  >(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
    const hash = window.location.hash.replace('#', '') as Tab
    if (['darstellung', 'dashboard', 'profile', 'daten'].includes(hash)) {
      setActiveTab(hash)
    }
  }, [])

  useEffect(() => {
    if (deleteConfirm) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [deleteConfirm])

  function handleTabChange(tab: Tab) {
    setActiveTab(tab)
    window.history.replaceState(null, '', `/einstellungen#${tab}`)
  }

  function toggleProfile(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleExport() {
    if (selectedIds.size === 0) return
    setExporting(true)
    try {
      const res = await fetch('/api/einstellungen/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileIds: Array.from(selectedIds) }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Server-Fehler beim Export')
      }
      const blob = await res.blob()
      const date = new Date().toISOString().slice(0, 10)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `alphatrack-backup-${date}.zip`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (err) {
      console.error('Export fehlgeschlagen:', err)
    } finally {
      setExporting(false)
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImportStatus(null)
    setImporting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/einstellungen/import', { method: 'POST', body: fd })
      const result = await res.json()
      if (result.success) {
        setImportStatus({
          type: 'success',
          profileCount: result.profileCount,
          screenshotCount: result.screenshotCount,
          fileCount: result.restoredFiles.length,
        })
        router.refresh()
      } else {
        setImportStatus({ type: 'error', message: result.error ?? t('daten.importFailedTitle') })
      }
    } catch {
      setImportStatus({ type: 'error', message: t('daten.fileProcessingFailedMsg') })
    } finally {
      setImporting(false)
    }
  }

  async function handleSwitch(profileId: string) {
    if (profileId === activeProfile?.id) return
    setSwitching(profileId)
    try {
      await switchProfileAction(profileId)
      router.refresh()
    } finally {
      setSwitching(null)
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return
    const id = deleteConfirm.id
    setDeleteConfirm(null)
    setDeleting(true)

    try {
      // Schritt 1: Stop-Commands an alle aktiven Bots senden
      const stops = await stopBotsForProfileAction(id)

      if (stops.length > 0) {
        setDeleteStatusMsg(t('profile.stoppingBotsMsg'))
        // Max 5 Sekunden auf Acknowledgment warten
        const deadline = Date.now() + 5000
        while (Date.now() < deadline) {
          const allDone = await checkStopAcknowledgedAction(stops)
          if (allDone) break
          await new Promise(r => setTimeout(r, 500))
        }
      }

      // Schritt 2: Profil und alle Daten löschen
      setDeleteStatusMsg(t('profile.deletingProfileMsg'))
      await deleteProfileAction(id)
      router.refresh()
    } finally {
      setDeleting(false)
      setDeleteStatusMsg(null)
    }
  }

  async function handleResetTrades() {
    setShowResetConfirm(false)
    setResetting(true)
    setResetResult(null)
    try {
      const result = await resetTradesAction()
      if (result.success) {
        setResetResult({ type: 'success', ...result })
        router.refresh()
      } else {
        setResetResult({ type: 'error' })
      }
    } catch {
      setResetResult({ type: 'error' })
    } finally {
      setResetting(false)
    }
  }

  const { settings, updateSetting } = useStatsSettings()
  const { accent, setAccent } = useAccentTheme()
  const tCommon = useTranslations('common')
  const t = useTranslations('einstellungen')
  const locale = useLocale() as AppLocale
  const { settings: sessionSettings, updateExchanges } = useSessionSettings()
  const isDark = mounted ? theme === 'dark' : true

  const ACCENT_THEMES: { id: AccentTheme; label: string; color: string; darkBg: string; lightBg: string }[] = [
    { id: 'blue',   label: t('darstellung.accentBlue'),    color: '#3b82f6', darkBg: '#080b12', lightBg: '#f0f4f8' },
    { id: 'red',    label: t('darstellung.accentCrimson'), color: '#f43f5e', darkBg: '#110810', lightBg: '#fff0f3' },
    { id: 'violet', label: t('darstellung.accentViolet'),  color: '#a855f7', darkBg: '#09080f', lightBg: '#f5f0fe' },
  ]

  const STATS_PANELS: { key: keyof StatsSettings; label: string }[] = [
    { key: 'showKpiRow',          label: t('dashboard.panelKpiRow') },
    { key: 'showMonthlyPnl',      label: t('dashboard.panelMonthlyPnl') },
    { key: 'showDirectionCards',  label: t('dashboard.panelDirectionCards') },
    { key: 'showTopAssets',       label: t('dashboard.panelTopAssets') },
    { key: 'showStrategyTable',   label: t('dashboard.panelStrategyTable') },
    { key: 'showInstrumentTable', label: t('dashboard.panelInstrumentTable') },
    { key: 'showWeekdayChart',    label: t('dashboard.panelWeekdayChart') },
    { key: 'showRMultipleChart',  label: t('dashboard.panelRMultipleChart') },
    { key: 'showTopTrades',       label: t('dashboard.panelTopTrades') },
  ]

  const TABS: { id: Tab; label: string }[] = [
    { id: 'darstellung', label: t('tabs.darstellung') },
    { id: 'dashboard',   label: t('tabs.dashboard') },
    { id: 'profile',     label: t('tabs.profile') },
    { id: 'daten',       label: t('tabs.daten') },
  ]

  return (
    <>
      {/* Tab-Leiste */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer"
              style={{
                background: isActive ? 'var(--accent-bg)' : 'var(--surface-2)',
                color: isActive ? 'var(--accent)' : 'var(--text-2)',
                border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      <div className="max-w-2xl space-y-4">

        {/* ── Tab: Darstellung ── */}
        {activeTab === 'darstellung' && (
          <>
            {/* Farbschema */}
            <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2 mb-1">
                <Palette size={15} style={{ color: 'var(--text-3)' }} />
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
                  {t('darstellung.colorSchemeHeading')}
                </p>
              </div>
              <p className="text-sm mb-4" style={{ color: 'var(--text-2)' }}>
                {t('darstellung.colorSchemeDescription')}
              </p>
              {mounted && (
                <div className="flex gap-3">
                  {ACCENT_THEMES.map(t => {
                    const isActive = accent === t.id
                    const bg = isDark ? t.darkBg : t.lightBg
                    return (
                      <button
                        key={t.id}
                        onClick={() => setAccent(t.id)}
                        className="flex-1 flex flex-col items-center gap-2.5 px-3 py-3 rounded-xl cursor-pointer transition-all"
                        style={{
                          border: isActive ? `2px solid ${t.color}` : '2px solid var(--border)',
                          background: isActive ? `${t.color}18` : 'var(--surface-2)',
                        }}
                      >
                        <div className="w-full h-10 rounded-lg overflow-hidden flex gap-1 p-1.5" style={{ background: bg }}>
                          <div className="w-2 rounded-sm" style={{ background: t.color, opacity: 0.9 }} />
                          <div className="flex-1 flex flex-col gap-1 justify-center">
                            <div className="h-1.5 rounded-full w-3/4" style={{ background: t.color, opacity: 0.5 }} />
                            <div className="h-1.5 rounded-full w-1/2" style={{ background: t.color, opacity: 0.25 }} />
                          </div>
                          <div className="w-4 h-4 rounded-md self-center" style={{ background: t.color }} />
                        </div>
                        <span className="text-xs font-semibold" style={{ color: isActive ? t.color : 'var(--text-2)' }}>
                          {t.label}
                        </span>
                        {isActive && <div className="w-1.5 h-1.5 rounded-full" style={{ background: t.color }} />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Sprache */}
            <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-3)' }}>
                {tCommon('language')}
              </p>
              <div className="flex gap-3 mt-4">
                {(['de', 'en'] as AppLocale[]).map(l => {
                  const isActive = locale === l
                  return (
                    <button
                      key={l}
                      onClick={() => setLocaleAction(l)}
                      className="flex-1 px-3 py-3 rounded-xl text-sm font-semibold cursor-pointer transition-all"
                      style={{
                        border: isActive ? '2px solid var(--accent)' : '2px solid var(--border)',
                        background: isActive ? 'var(--accent-bg)' : 'var(--surface-2)',
                        color: isActive ? 'var(--accent)' : 'var(--text-2)',
                      }}
                    >
                      {l === 'de' ? tCommon('german') : tCommon('english')}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Erscheinungsbild */}
            <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-3)' }}>
                {t('darstellung.appearanceHeading')}
              </p>
              <p className="text-sm mb-4" style={{ color: 'var(--text-2)' }}>
                {t('darstellung.appearanceDescription')}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setTheme('light')}
                  className="flex-1 flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all cursor-pointer"
                  style={{
                    background: !isDark ? 'var(--accent-bg)' : 'var(--surface-2)',
                    color: !isDark ? 'var(--accent)' : 'var(--text-2)',
                    border: !isDark ? '1px solid var(--accent)' : '1px solid var(--border)',
                  }}
                >
                  <Sun size={16} />
                  {t('darstellung.lightMode')}
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className="flex-1 flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all cursor-pointer"
                  style={{
                    background: isDark ? 'var(--accent-bg)' : 'var(--surface-2)',
                    color: isDark ? 'var(--accent)' : 'var(--text-2)',
                    border: isDark ? '1px solid var(--accent)' : '1px solid var(--border)',
                  }}
                >
                  <Moon size={16} />
                  {t('darstellung.darkMode')}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Tab: Dashboard ── */}
        {activeTab === 'dashboard' && (
          <>
            {/* Statistik-Panels */}
            <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2 mb-1">
                <BarChart2 size={15} style={{ color: 'var(--text-3)' }} />
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
                  {t('dashboard.statsPanelsHeading')}
                </p>
              </div>
              <p className="text-sm mb-4" style={{ color: 'var(--text-2)' }}>
                {t('dashboard.statsPanelsDescription')}
              </p>
              <div className="space-y-2">
                {mounted && STATS_PANELS.map(({ key, label }) => (
                  <label
                    key={key}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all"
                    style={{
                      background: settings[key] ? 'var(--accent-bg)' : 'var(--surface-2)',
                      border: `1px solid ${settings[key] ? 'var(--accent)' : 'var(--border)'}`,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={settings[key]}
                      onChange={e => updateSetting(key, e.target.checked)}
                      className="w-4 h-4 rounded accent-[var(--accent)] cursor-pointer"
                    />
                    <span className="text-sm font-medium flex-1" style={{ color: 'var(--text-1)' }}>
                      {label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Börsen-Sessions */}
            <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2 mb-1">
                <Clock size={15} style={{ color: 'var(--text-3)' }} />
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
                  {t('dashboard.exchangeSessionsHeading')}
                </p>
              </div>
              <p className="text-sm mb-4" style={{ color: 'var(--text-2)' }}>
                {t('dashboard.exchangeSessionsDescription')}
              </p>
              <div className="space-y-2">
                {mounted && [
                  { id: 'nyse',  label: t('dashboard.exchangeNyse') },
                  { id: 'lse',   label: t('dashboard.exchangeLse') },
                  { id: 'xetra', label: t('dashboard.exchangeXetra') },
                  { id: 'tse',   label: t('dashboard.exchangeTse') },
                ].map(({ id, label }) => {
                  const visible = sessionSettings.visibleExchanges.includes(id)
                  return (
                    <label
                      key={id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all"
                      style={{
                        background: visible ? 'var(--accent-bg)' : 'var(--surface-2)',
                        border: `1px solid ${visible ? 'var(--accent)' : 'var(--border)'}`,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={visible}
                        onChange={e => {
                          const next = e.target.checked
                            ? [...sessionSettings.visibleExchanges, id]
                            : sessionSettings.visibleExchanges.filter(x => x !== id)
                          void updateExchanges(next)
                        }}
                        className="w-4 h-4 rounded accent-[var(--accent)] cursor-pointer"
                      />
                      <span className="text-sm font-medium flex-1" style={{ color: 'var(--text-1)' }}>
                        {label}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* ── Tab: Profile ── */}
        {activeTab === 'profile' && (
          <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-3)' }}>
              {t('profile.profileHeading')}
            </p>
            <p className="text-sm mb-4" style={{ color: 'var(--text-2)' }}>
              {t('profile.profileDescription')}
            </p>

            {profiles.length === 0 ? (
              <p className="text-sm py-4 text-center" style={{ color: 'var(--text-3)' }}>
                {t('profile.noProfilesYet')}
              </p>
            ) : (
              <div className="space-y-2 mb-4">
                {profiles.map(profile => {
                  const isActive = profile.id === activeProfile?.id
                  const TypeIcon = profile.type === 'live' ? Banknote : Gamepad2
                  const ProfileIcon = profile.icon && PROFILE_ICON_MAP[profile.icon as keyof typeof PROFILE_ICON_MAP]
                    ? PROFILE_ICON_MAP[profile.icon as keyof typeof PROFILE_ICON_MAP]
                    : null
                  const isSwitch = switching === profile.id

                  return (
                    <div
                      key={profile.id}
                      className="flex items-center gap-3 px-3 py-3 rounded-lg transition-all cursor-pointer"
                      style={{
                        background: isActive ? 'var(--accent-bg)' : 'var(--surface-2)',
                        border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                        opacity: isSwitch ? 0.6 : 1,
                      }}
                      onClick={() => handleSwitch(profile.id)}
                    >
                      {/* Avatar */}
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0"
                        style={{ background: profile.color }}
                      >
                        {ProfileIcon
                          ? <ProfileIcon size={15} color="#fff" />
                          : <span className="text-sm font-bold">{profile.name.charAt(0).toUpperCase()}</span>
                        }
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold truncate" style={{ color: isActive ? 'var(--accent)' : 'var(--text-1)' }}>
                            {profile.name}
                          </p>
                          <span
                            className="text-xs px-1.5 py-0.5 rounded font-medium shrink-0"
                            style={{
                              background: profile.type === 'live' ? 'rgba(0,217,126,0.1)' : 'rgba(100,100,255,0.1)',
                              color: profile.type === 'live' ? 'var(--green)' : 'var(--accent)',
                            }}
                          >
                            {profile.type === 'live' ? t('profile.liveLabel') : t('profile.demoLabel')}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <TypeIcon size={10} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                          <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>
                            {profile.broker} · {profile.startCapital.toLocaleString('de-DE')} {profile.currency}
                          </p>
                        </div>
                      </div>

                      {/* Aktiv-Check */}
                      {isActive && <Check size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />}

                      {/* Aktions-Buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={e => { e.stopPropagation(); setShowEditModal(profile) }}
                          className="p-1.5 rounded-lg transition-all"
                          style={{ color: 'var(--text-3)' }}
                          onMouseEnter={e => {
                            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-1)'
                            ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-3)'
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-3)'
                            ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                          }}
                          title={t('profile.editProfileTooltip')}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); setDeleteConfirm(profile) }}
                          className="p-1.5 rounded-lg transition-all"
                          style={{ color: 'var(--text-3)' }}
                          onMouseEnter={e => {
                            (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'
                            ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.1)'
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-3)'
                            ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                          }}
                          title={t('profile.deleteProfileTooltip')}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {deleting && deleteStatusMsg && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs mb-4"
                style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
              >
                <span className="animate-spin text-base">⟳</span>
                {deleteStatusMsg}
              </div>
            )}

            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer"
              style={{
                background: 'var(--surface-2)',
                color: 'var(--text-2)',
                border: '1px dashed var(--border)',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-2)' }}
            >
              <Plus size={14} />
              {t('profile.newProfileBtn')}
            </button>
          </div>
        )}

        {/* ── Tab: Daten ── */}
        {activeTab === 'daten' && (
          <>
            {/* Export */}
            <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-3)' }}>
                {t('daten.exportHeading')}
              </p>
              <p className="text-sm mb-4" style={{ color: 'var(--text-2)' }}>
                {t('daten.exportDescription')}
              </p>

              <div className="mb-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
                  {t('daten.selectProfilesLabel')}
                </p>
                {profiles.map(profile => (
                  <label
                    key={profile.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all"
                    style={{
                      background: selectedIds.has(profile.id) ? 'var(--accent-bg)' : 'var(--surface-2)',
                      border: `1px solid ${selectedIds.has(profile.id) ? 'var(--accent)' : 'var(--border)'}`,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(profile.id)}
                      onChange={() => toggleProfile(profile.id)}
                      className="w-4 h-4 rounded accent-[var(--accent)] cursor-pointer"
                    />
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ background: profile.color ?? 'var(--accent)' }} />
                    <span className="text-sm font-medium flex-1" style={{ color: 'var(--text-1)' }}>
                      {profile.name}
                    </span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-md font-medium"
                      style={{
                        background: profile.type === 'live' ? 'rgba(0,217,126,0.1)' : 'rgba(100,100,255,0.1)',
                        color: profile.type === 'live' ? 'var(--green)' : 'var(--accent)',
                      }}
                    >
                      {profile.type === 'live' ? t('profile.liveLabel') : t('profile.demoLabel')}
                    </span>
                  </label>
                ))}
              </div>

              <button
                onClick={handleExport}
                disabled={exporting || selectedIds.size === 0}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer disabled:opacity-50"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                <motion.span
                  animate={exporting ? { rotate: 360 } : { rotate: 0 }}
                  transition={exporting ? { repeat: Infinity, duration: 1, ease: 'linear' } : {}}
                >
                  <Download size={15} />
                </motion.span>
                {exporting
                  ? t('daten.exportingBtn')
                  : selectedIds.size === 0
                  ? t('daten.noProfileSelectedBtn')
                  : selectedIds.size === 1
                  ? t('daten.exportBtnOne', { count: selectedIds.size })
                  : t('daten.exportBtnMany', { count: selectedIds.size })
                }
              </button>
            </div>

            {/* Import */}
            <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-3)' }}>
                {t('daten.importHeading')}
              </p>
              <p className="text-sm mb-4" style={{ color: 'var(--text-2)' }}>
                {t('daten.importDescription')}
              </p>
              <input ref={fileRef} type="file" accept=".zip" className="hidden" onChange={handleImport} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={importing}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer disabled:opacity-60"
                style={{ background: 'var(--surface-2)', color: 'var(--text-1)', border: '1px solid var(--border)' }}
              >
                <Upload size={15} />
                {importing ? t('daten.importingBtn') : t('daten.uploadBtn')}
              </button>

              <AnimatePresence>
                {importStatus && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-4 rounded-lg p-3 text-sm flex items-start gap-2.5"
                    style={
                      importStatus.type === 'success'
                        ? { background: 'rgba(0,217,126,0.1)', color: 'var(--green)', border: '1px solid rgba(0,217,126,0.3)' }
                        : { background: 'rgba(255,69,96,0.1)', color: 'var(--red)', border: '1px solid rgba(255,69,96,0.3)' }
                    }
                  >
                    {importStatus.type === 'success' ? (
                      <>
                        <CheckCircle size={16} className="shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="font-semibold">{t('daten.importSuccessTitle')}</p>
                          <div className="flex flex-wrap gap-3 opacity-80 text-xs mt-1">
                            <span className="flex items-center gap-1">
                              <Package size={12} />
                              {importStatus.profileCount === 1
                                ? t('daten.profileCountOne', { count: importStatus.profileCount })
                                : t('daten.profileCountMany', { count: importStatus.profileCount })}
                            </span>
                            <span className="flex items-center gap-1">
                              <Image size={12} />
                              {importStatus.screenshotCount} {t('daten.screenshotsLabel')}
                            </span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <XCircle size={16} className="shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">{t('daten.importFailedTitle')}</p>
                          <p className="opacity-80 mt-0.5">{importStatus.message}</p>
                        </div>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Gefahrenzone */}
            <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid rgba(239,68,68,0.4)' }}>
              <div className="flex items-center gap-2 mb-1">
                <ShieldAlert size={15} style={{ color: '#ef4444' }} />
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#ef4444' }}>
                  {t('daten.dangerZoneHeading')}
                </p>
              </div>
              <p className="text-sm mb-3" style={{ color: 'var(--text-2)' }}>
                {t('daten.dangerZoneWarning')}
              </p>

              <div className="flex items-start justify-between gap-4 py-3" style={{ borderTop: '1px solid var(--border)' }}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{t('daten.resetTradesHeading')}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                    {t('daten.resetTradesDescription')}
                  </p>
                </div>
                <button
                  onClick={() => { setShowResetConfirm(true); setResetResult(null) }}
                  disabled={resetting}
                  className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer disabled:opacity-50"
                  style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
                >
                  <RotateCcw size={13} />
                  {resetting ? t('daten.resettingBtn') : t('daten.resetBtn')}
                </button>
              </div>

              <AnimatePresence>
                {resetResult && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-3 rounded-lg p-3 text-sm flex items-start gap-2.5"
                    style={
                      resetResult.type === 'success'
                        ? { background: 'rgba(0,217,126,0.1)', color: 'var(--green)', border: '1px solid rgba(0,217,126,0.3)' }
                        : { background: 'rgba(255,69,96,0.1)', color: 'var(--red)', border: '1px solid rgba(255,69,96,0.3)' }
                    }
                  >
                    {resetResult.type === 'success' ? (
                      <>
                        <CheckCircle size={16} className="shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <p className="font-semibold">{t('daten.resetSuccessTitle')}</p>
                          <p className="text-xs opacity-80">
                            {resetResult.deletedJournal === 1
                              ? t('daten.journalTradesOne', { count: resetResult.deletedJournal })
                              : t('daten.journalTradesMany', { count: resetResult.deletedJournal })}
                            {' '}{t('daten.andConnector')}{' '}
                            {resetResult.deletedBridge === 1
                              ? t('daten.bridgeTradesOne', { count: resetResult.deletedBridge })
                              : t('daten.bridgeTradesMany', { count: resetResult.deletedBridge })}
                            {' '}{t('daten.deletedSuffix')}
                            {' '}{resetResult.cutoffSet ? t('daten.cutoffSetMsg') : resetResult.bridgeOffline ? t('daten.bridgeOfflineCutoffMsg') : ''}
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <XCircle size={16} className="shrink-0 mt-0.5" />
                        <p className="font-semibold">{t('daten.resetFailedTitle')}</p>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}

      </div>

      {/* Modals */}
      <AnimatePresence>
        {showEditModal && (
          <ProfileEditModal
            profile={showEditModal}
            onClose={() => { setShowEditModal(null); router.refresh() }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCreateModal && (
          <ProfileSetupModal onClose={() => { setShowCreateModal(false); router.refresh() }} />
        )}
      </AnimatePresence>

      {/* Löschen-Bestätigung */}
      {mounted && createPortal(
        <AnimatePresence>
          {deleteConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 8 }}
                transition={{ duration: 0.15 }}
                className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }}
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(239,68,68,0.15)' }}>
                    <AlertTriangle size={20} style={{ color: '#ef4444' }} />
                  </div>
                  <div>
                    <p className="text-base font-semibold" style={{ color: 'var(--text-1)' }}>{t('profile.deleteConfirmTitle')}</p>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>
                      {t('profile.deleteConfirmBody', { name: deleteConfirm.name })}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    disabled={deleting}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                    style={{ background: 'var(--surface-2)', color: 'var(--text-1)', border: '1px solid var(--border)' }}
                  >
                    {t('profile.cancelBtn')}
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2"
                    style={{ background: '#ef4444', color: '#fff', opacity: deleting ? 0.6 : 1 }}
                  >
                    <Trash2 size={14} />
                    {deleting ? t('profile.deletingBtnLabel') : t('profile.deleteBtnLabel')}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Reset-Bestätigung */}
      {mounted && createPortal(
        <AnimatePresence>
          {showResetConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
              onClick={() => setShowResetConfirm(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 8 }}
                transition={{ duration: 0.15 }}
                className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }}
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(239,68,68,0.15)' }}>
                    <AlertTriangle size={20} style={{ color: '#ef4444' }} />
                  </div>
                  <div>
                    <p className="text-base font-semibold" style={{ color: 'var(--text-1)' }}>{t('daten.resetConfirmTitle')}</p>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>
                      {t('daten.resetConfirmBodyPart1')}{' '}
                      <span className="font-semibold" style={{ color: '#ef4444' }}>{t('daten.resetConfirmBodyEmphasis')}</span>.
                      {t('daten.resetConfirmBodyPart2')}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer"
                    style={{ background: 'var(--surface-2)', color: 'var(--text-1)', border: '1px solid var(--border)' }}
                  >
                    {t('daten.cancelBtn')}
                  </button>
                  <button
                    onClick={handleResetTrades}
                    className="px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer"
                    style={{ background: '#ef4444', color: '#fff' }}
                  >
                    <RotateCcw size={14} />
                    {t('daten.resetNowBtn')}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
