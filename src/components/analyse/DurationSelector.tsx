'use client'

import { useTranslations } from 'next-intl'

export type Duration = 'scalping' | 'intraday'

interface Props {
  value: Duration
  onChange: (d: Duration) => void
  disabled?: boolean
}

function getOptions(t: ReturnType<typeof useTranslations<'analyse.duration'>>): { value: Duration; label: string; sub: string }[] {
  return [
    { value: 'scalping', label: 'Scalping', sub: t('scalpingSub') },
    { value: 'intraday', label: 'Intraday', sub: t('intradaySub') },
  ]
}

export default function DurationSelector({ value, onChange, disabled }: Props) {
  const t = useTranslations('analyse.duration')
  const options = getOptions(t)
  return (
    <div className="flex gap-2">
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            disabled={disabled}
            className="flex flex-col items-start px-4 py-3 rounded-xl border text-sm font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: active ? 'var(--accent-bg)' : 'var(--surface-2)',
              borderColor: active ? 'var(--accent)' : 'var(--border)',
              color: active ? 'var(--accent)' : 'var(--text-1)',
            }}
          >
            <span className="font-semibold">{opt.label}</span>
            <span className="text-xs mt-0.5" style={{ color: active ? 'var(--accent)' : 'var(--text-3)', opacity: 0.8 }}>
              {opt.sub}
            </span>
          </button>
        )
      })}
    </div>
  )
}
