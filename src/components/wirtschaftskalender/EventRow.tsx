import { WirtschaftsEvent } from '@/types/wirtschaftskalender'
import ImpactBadge from './ImpactBadge'
import ExplanationPanel from './ExplanationPanel'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'

const FLAG_CODES: Record<string, string> = {
  USD: 'us', EUR: 'eu', GBP: 'gb', JPY: 'jp',
  CHF: 'ch', AUD: 'au', CAD: 'ca', NZD: 'nz',
}

function Flag({ country }: { country: string }) {
  const code = FLAG_CODES[country]
  if (!code) return <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{country}</span>
  return (
    <img
      src={`https://flagcdn.com/20x15/${code}.png`}
      width={20}
      height={15}
      alt={country}
      style={{ borderRadius: 2, display: 'inline-block', flexShrink: 0 }}
    />
  )
}

function parseNum(val: string | null): number | null {
  if (!val) return null
  const cleaned = val.replace(/[%$€£¥B Mm]/g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

function ActualValue({ actual, forecast }: { actual: string | null; forecast: string | null }) {
  if (!actual) return <span style={{ color: 'var(--text-3)' }}>-</span>

  const a = parseNum(actual)
  const f = parseNum(forecast)
  let color = 'var(--text-1)'
  if (a !== null && f !== null) {
    if (a > f) color = 'var(--green)'
    else if (a < f) color = 'var(--red)'
  }

  return <span style={{ color, fontWeight: 600 }}>{actual}</span>
}

interface Props {
  event: WirtschaftsEvent
  isToday: boolean
  isExpanded: boolean
  onToggle: () => void
}

// Desktop-Tabellenzeile
export function DesktopRow({ event, isToday, isExpanded, onToggle }: Props) {
  return (
    <>
      <tr
        onClick={onToggle}
        style={{
          background: isToday ? 'rgba(59,130,246,0.04)' : 'transparent',
          borderBottom: isExpanded ? 'none' : '1px solid var(--border)',
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = isToday ? 'rgba(59,130,246,0.08)' : 'var(--surface-2)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = isToday ? 'rgba(59,130,246,0.04)' : 'transparent' }}
      >
        <td className="py-2.5 pl-4 pr-3 text-sm tabular-nums" style={{ color: 'var(--text-2)', width: 72, whiteSpace: 'nowrap' }}>
          {event.time}
        </td>
        <td className="py-2.5 px-3 text-sm font-medium" style={{ width: 64 }}>
          <span className="flex items-center gap-1.5">
            <Flag country={event.country} />
            <span style={{ color: 'var(--text-3)', fontSize: 11 }}>{event.country}</span>
          </span>
        </td>
        <td className="py-2.5 px-3 text-sm" style={{ color: 'var(--text-1)' }}>
          {event.title}
        </td>
        <td className="py-2.5 px-3" style={{ width: 90 }}>
          <ImpactBadge impact={event.impact} />
        </td>
        <td className="py-2.5 px-3 text-sm tabular-nums text-right" style={{ color: 'var(--text-2)', width: 80 }}>
          {event.forecast ?? '-'}
        </td>
        <td className="py-2.5 px-3 text-sm tabular-nums text-right" style={{ color: 'var(--text-2)', width: 80 }}>
          {event.previous ?? '-'}
        </td>
        <td className="py-2.5 px-3 text-sm tabular-nums text-right" style={{ width: 80 }}>
          <ActualValue actual={event.actual} forecast={event.forecast} />
        </td>
        <td className="py-2.5 px-3 pr-4 text-right" style={{ width: 36 }}>
          {isExpanded
            ? <ChevronDown size={14} style={{ color: 'var(--text-3)', display: 'inline-block' }} />
            : <ChevronRight size={14} style={{ color: 'var(--text-3)', display: 'inline-block' }} />
          }
        </td>
      </tr>

      {/* Expansion row */}
      {isExpanded && (
        <tr style={{ borderBottom: '1px solid var(--border)' }}>
          <td colSpan={8} style={{ padding: 0 }}>
            <ExplanationPanel
              eventTitle={event.title}
              country={event.country}
              isExpanded={isExpanded}
            />
          </td>
        </tr>
      )}
    </>
  )
}

// Mobile-Karte
export function MobileCard({ event, isToday, isExpanded, onToggle }: Props) {
  const t = useTranslations('kalender.eventRow')
  return (
    <div
      onClick={onToggle}
      style={{
        background: isToday ? 'rgba(59,130,246,0.05)' : 'var(--surface)',
        border: `1px solid ${isToday ? 'rgba(59,130,246,0.25)' : 'var(--border)'}`,
        borderRadius: 10,
        overflow: 'hidden',
        cursor: 'pointer',
      }}
    >
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Zeile 1: Impact + Wahrung + Zeit + Chevron */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ImpactBadge impact={event.impact} compact />
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Flag country={event.country} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>{event.country}</span>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
              {event.time}
            </span>
            {isExpanded
              ? <ChevronDown size={13} style={{ color: 'var(--text-3)' }} />
              : <ChevronRight size={13} style={{ color: 'var(--text-3)' }} />
            }
          </div>
        </div>

        {/* Titel */}
        <p style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 500, lineHeight: 1.35, margin: 0 }}>
          {event.title}
        </p>

        {/* Werte */}
        <div style={{ display: 'flex', gap: 12 }}>
          {[
            { label: t('forecast'), value: event.forecast },
            { label: t('previous'), value: event.previous },
            { label: t('actual'),   value: null, actual: event.actual, forecast: event.forecast },
          ].map(({ label, value, actual, forecast }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {label}
              </span>
              {actual !== undefined ? (
                <ActualValue actual={actual} forecast={forecast ?? null} />
              ) : (
                <span style={{ fontSize: 12, color: value ? 'var(--text-2)' : 'var(--text-3)', fontWeight: 500 }}>
                  {value ?? '-'}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Expansion Panel */}
      <ExplanationPanel
        eventTitle={event.title}
        country={event.country}
        isExpanded={isExpanded}
      />
    </div>
  )
}
