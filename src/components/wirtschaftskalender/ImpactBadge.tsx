import { EventImpact } from '@/types/wirtschaftskalender'
import { useTranslations } from 'next-intl'

function getImpactConfig(t: ReturnType<typeof useTranslations<'kalender.impact'>>): Record<EventImpact, { color: string; bg: string; label: string }> {
  return {
    High:    { color: '#ff4560', bg: 'rgba(255,69,96,0.12)',    label: t('high') },
    Medium:  { color: '#f97316', bg: 'rgba(249,115,22,0.12)',   label: t('medium') },
    Low:     { color: '#00d97e', bg: 'rgba(0,217,126,0.12)',    label: t('low') },
    Holiday: { color: '#7a8fa6', bg: 'rgba(122,143,166,0.12)', label: t('holiday') },
  }
}

interface Props {
  impact: EventImpact
  compact?: boolean
}

export default function ImpactBadge({ impact, compact = false }: Props) {
  const t = useTranslations('kalender.impact')
  const cfg = getImpactConfig(t)[impact] ?? getImpactConfig(t).Low

  if (compact) {
    return (
      <span
        style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: cfg.color,
          flexShrink: 0,
          boxShadow: `0 0 6px ${cfg.color}66`,
        }}
        title={cfg.label}
      />
    )
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 7px',
        borderRadius: 6,
        background: cfg.bg,
        border: `1px solid ${cfg.color}44`,
        fontSize: 11,
        fontWeight: 600,
        color: cfg.color,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: cfg.color,
          flexShrink: 0,
        }}
      />
      {cfg.label}
    </span>
  )
}
