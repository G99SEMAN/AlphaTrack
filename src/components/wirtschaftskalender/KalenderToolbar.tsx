'use client'

import { RefreshCw, CalendarCheck } from 'lucide-react'
import { EventImpact } from '@/types/wirtschaftskalender'
import { useTranslations } from 'next-intl'

export type TimeFilter = 'rolling' | 'thisweek' | 'nextweek' | 'all'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD'] as const
const IMPACTS: EventImpact[] = ['High', 'Medium', 'Low']

const IMPACT_COLORS: Record<EventImpact, string> = {
  High:    '#ff4560',
  Medium:  '#f97316',
  Low:     '#00d97e',
  Holiday: '#7a8fa6',
}

function formatFetchedAt(iso: string, t: ReturnType<typeof useTranslations<'kalender.toolbar'>>): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diff < 1) return t('justUpdated')
  if (diff === 1) return t('minuteAgo')
  if (diff < 60) return t('minutesAgo', { count: diff })
  const h = Math.floor(diff / 60)
  return h === 1 ? t('hourAgo') : t('hoursAgo', { count: h })
}

interface Props {
  timeFilter: TimeFilter
  onTimeFilter: (v: TimeFilter) => void
  currencies: Set<string>
  onToggleCurrency: (c: string) => void
  onClearCurrencies: () => void
  impactFilter: Set<EventImpact>
  onToggleImpact: (imp: EventImpact) => void
  fetchedAt: string
  loading: boolean
  onRefresh: () => void
  onScrollToToday: () => void
}

export default function KalenderToolbar({
  timeFilter, onTimeFilter,
  currencies, onToggleCurrency, onClearCurrencies,
  impactFilter, onToggleImpact,
  fetchedAt, loading, onRefresh, onScrollToToday,
}: Props) {
  const t = useTranslations('kalender.toolbar')
  const chip: React.CSSProperties = {
    padding: '4px 10px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
    border: '1px solid transparent',
    whiteSpace: 'nowrap',
  }

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {/* Zeile 1: Zeitraum + Refresh + Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {([
            { v: 'rolling'  as TimeFilter, l: t('filter7Days') },
            { v: 'thisweek' as TimeFilter, l: t('filterThisWeek') },
            { v: 'nextweek' as TimeFilter, l: t('filterNextWeek') },
            { v: 'all'      as TimeFilter, l: t('filterAll') },
          ]).map(({ v, l }) => (
            <button
              key={v}
              onClick={() => onTimeFilter(v)}
              style={{
                ...chip,
                background: timeFilter === v ? 'var(--accent-bg)' : 'transparent',
                color: timeFilter === v ? 'var(--accent)' : 'var(--text-2)',
                borderColor: timeFilter === v ? 'var(--accent)' : 'transparent',
              }}
            >
              {l}
            </button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {formatFetchedAt(fetchedAt, t)}
          </span>
          <button
            onClick={onScrollToToday}
            title={t('todayTitle')}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              height: 30, padding: '0 10px', borderRadius: 7,
              background: 'var(--accent-bg)',
              border: '1px solid var(--accent)',
              cursor: 'pointer',
              color: 'var(--accent)',
              fontSize: 12, fontWeight: 600,
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            <CalendarCheck size={12} />
            {t('today')}
          </button>
          <button
            onClick={onRefresh}
            disabled={loading}
            title={t('refreshTitle')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 30, height: 30, borderRadius: 7,
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              color: 'var(--text-2)',
              flexShrink: 0,
            }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Zeile 2: Währungs-Chips */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, marginRight: 2 }}>{t('currencyLabel')}</span>
        {CURRENCIES.map(c => {
          const active = currencies.has(c)
          return (
            <button
              key={c}
              onClick={() => onToggleCurrency(c)}
              style={{
                ...chip,
                padding: '3px 8px',
                background: active ? 'var(--surface-3)' : 'transparent',
                color: active ? 'var(--text-1)' : 'var(--text-3)',
                borderColor: active ? 'var(--border)' : 'transparent',
                fontWeight: active ? 700 : 500,
              }}
            >
              {c}
            </button>
          )
        })}
        {currencies.size > 0 && (
          <button
            onClick={onClearCurrencies}
            style={{ ...chip, padding: '3px 7px', color: 'var(--text-3)', fontSize: 11 }}
          >
            {t('clearAll')}
          </button>
        )}
      </div>

      {/* Zeile 3: Impact-Chips */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, marginRight: 2 }}>{t('impactLabel')}</span>
        {IMPACTS.map(imp => {
          const active = impactFilter.has(imp)
          const color = IMPACT_COLORS[imp]
          return (
            <button
              key={imp}
              onClick={() => onToggleImpact(imp)}
              style={{
                ...chip,
                padding: '3px 8px',
                background: active ? `${color}18` : 'transparent',
                color: active ? color : 'var(--text-3)',
                borderColor: active ? `${color}55` : 'transparent',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
              {imp === 'High' ? t('impactHigh') : imp === 'Medium' ? t('impactMedium') : t('impactLow')}
            </button>
          )
        })}
      </div>
    </div>
  )
}
