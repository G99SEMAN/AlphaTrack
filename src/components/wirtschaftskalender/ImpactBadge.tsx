import { EventImpact } from '@/types/wirtschaftskalender'

const IMPACT_CONFIG: Record<EventImpact, { color: string; bg: string; label: string }> = {
  High:    { color: '#ff4560', bg: 'rgba(255,69,96,0.12)',    label: 'Hoch' },
  Medium:  { color: '#f97316', bg: 'rgba(249,115,22,0.12)',   label: 'Mittel' },
  Low:     { color: '#00d97e', bg: 'rgba(0,217,126,0.12)',    label: 'Niedrig' },
  Holiday: { color: '#7a8fa6', bg: 'rgba(122,143,166,0.12)', label: 'Feiertag' },
}

interface Props {
  impact: EventImpact
  compact?: boolean
}

export default function ImpactBadge({ impact, compact = false }: Props) {
  const cfg = IMPACT_CONFIG[impact] ?? IMPACT_CONFIG.Low

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
