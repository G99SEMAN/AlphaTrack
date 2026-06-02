'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const PERIODS = [
  { value: 'tag',    label: 'Tag' },
  { value: 'woche',  label: 'Woche' },
  { value: 'monat',  label: 'Monat' },
  { value: 'jahr',   label: 'Jahr' },
  { value: 'gesamt', label: 'Gesamt' },
]

export default function DashboardTimeFilter() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const current = searchParams.get('period') ?? 'gesamt'

  function setPeriod(period: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('period', period)
    router.push(`/dashboard?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-1">
      {PERIODS.map(p => (
        <button
          key={p.value}
          onClick={() => setPeriod(p.value)}
          className="px-2.5 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all"
          style={{
            background: current === p.value ? 'var(--accent-bg)' : 'var(--surface-2)',
            color: current === p.value ? 'var(--accent)' : 'var(--text-3)',
            border: `1px solid ${current === p.value ? 'var(--accent)' : 'var(--border)'}`,
          }}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
