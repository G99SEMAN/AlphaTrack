'use client'

import { useTheme } from 'next-themes'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sun, Moon, Download, Upload, CheckCircle, XCircle, Package, Image, BarChart2, Palette } from 'lucide-react'
import { useStatsSettings, StatsSettings } from '@/hooks/useStatsSettings'
import { useAccentTheme, AccentTheme } from '@/hooks/useAccentTheme'
import { motion, AnimatePresence } from 'framer-motion'
import { Profile } from '@/types/profile'

interface Props {
  profiles: Profile[]
}

type ImportStatus =
  | { type: 'success'; profileCount: number; screenshotCount: number; fileCount: number }
  | { type: 'error'; message: string }
  | null

export default function EinstellungenClient({ profiles }: Props) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importStatus, setImportStatus] = useState<ImportStatus>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(profiles.map(p => p.id)))
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => setMounted(true), [])

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
        setImportStatus({ type: 'error', message: result.error ?? 'Import fehlgeschlagen.' })
      }
    } catch {
      setImportStatus({ type: 'error', message: 'Die Datei konnte nicht verarbeitet werden.' })
    } finally {
      setImporting(false)
    }
  }

  const { settings, updateSetting } = useStatsSettings()
  const { accent, setAccent } = useAccentTheme()
  const isDark = mounted ? theme === 'dark' : true

  const ACCENT_THEMES: { id: AccentTheme; label: string; color: string; darkBg: string; lightBg: string }[] = [
    { id: 'blue',   label: 'Blau',    color: '#3b82f6', darkBg: '#080b12', lightBg: '#f0f4f8' },
    { id: 'red',    label: 'Crimson', color: '#f43f5e', darkBg: '#110810', lightBg: '#fff0f3' },
    { id: 'violet', label: 'Violett', color: '#a855f7', darkBg: '#09080f', lightBg: '#f5f0fe' },
  ]

  const STATS_PANELS: { key: keyof StatsSettings; label: string }[] = [
    { key: 'showKpiRow',         label: 'KPI-Leiste (Profit Factor, Expectancy, ...)' },
    { key: 'showMonthlyPnl',     label: 'Monatlicher P&L Chart' },
    { key: 'showDirectionCards', label: 'Long / Short Aufteilung' },
    { key: 'showTopAssets',      label: 'Top 5 Assets' },
    { key: 'showStrategyTable',  label: 'Strategie-Tabelle' },
    { key: 'showInstrumentTable', label: 'Instrumente nach P&L' },
    { key: 'showWeekdayChart',   label: 'Wochentagsanalyse' },
    { key: 'showRMultipleChart', label: 'R-Multiple Verteilung' },
    { key: 'showTopTrades',      label: 'Beste Trades' },
  ]

  return (
    <div className="max-w-2xl space-y-4">

      {/* Statistik-Panels */}
      <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-1">
          <BarChart2 size={15} style={{ color: 'var(--text-3)' }} />
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
            Statistik-Panels
          </p>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--text-2)' }}>
          Wähle welche Auswertungen auf der Statistik-Seite angezeigt werden.
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

      {/* Farbschema */}
      <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-1">
          <Palette size={15} style={{ color: 'var(--text-3)' }} />
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
            Farbschema
          </p>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--text-2)' }}>
          Wähle ein Farbschema für die gesamte Oberfläche.
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
                  {/* Mini-Preview */}
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
                  {isActive && (
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: t.color }} />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Erscheinungsbild */}
      <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-3)' }}>
          Erscheinungsbild
        </p>
        <p className="text-sm mb-4" style={{ color: 'var(--text-2)' }}>
          Wähle zwischen hellem und dunklem Design.
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
            Hell
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
            Dunkel
          </button>
        </div>
      </div>

      {/* Export */}
      <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-3)' }}>
          Daten exportieren
        </p>
        <p className="text-sm mb-4" style={{ color: 'var(--text-2)' }}>
          Erstellt ein vollständiges ZIP-Backup der gewählten Profile inkl. Trades, Strategien und Screenshots.
        </p>

        {/* Profilauswahl */}
        <div className="mb-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
            Profile auswählen
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
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ background: profile.color ?? 'var(--accent)' }}
              />
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
                {profile.type === 'live' ? 'Live' : 'Demo'}
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
            ? 'Exportiere...'
            : selectedIds.size === 0
            ? 'Kein Profil ausgewählt'
            : `${selectedIds.size} ${selectedIds.size === 1 ? 'Profil' : 'Profile'} als ZIP exportieren`
          }
        </button>
      </div>

      {/* Import */}
      <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-3)' }}>
          Backup importieren
        </p>
        <p className="text-sm mb-4" style={{ color: 'var(--text-2)' }}>
          ZIP-Backup wiederherstellen. Importierte Profile werden hinzugefügt oder aktualisiert - andere Profile bleiben unverändert.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={handleImport}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer disabled:opacity-60"
          style={{
            background: 'var(--surface-2)',
            color: 'var(--text-1)',
            border: '1px solid var(--border)',
          }}
        >
          <Upload size={15} />
          {importing ? 'Importiere...' : 'ZIP-Backup hochladen'}
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
                    <p className="font-semibold">Import erfolgreich</p>
                    <div className="flex flex-wrap gap-3 opacity-80 text-xs mt-1">
                      <span className="flex items-center gap-1">
                        <Package size={12} />
                        {importStatus.profileCount} {importStatus.profileCount === 1 ? 'Profil' : 'Profile'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Image size={12} />
                        {importStatus.screenshotCount} Screenshots
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <XCircle size={16} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Import fehlgeschlagen</p>
                    <p className="opacity-80 mt-0.5">{importStatus.message}</p>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  )
}
