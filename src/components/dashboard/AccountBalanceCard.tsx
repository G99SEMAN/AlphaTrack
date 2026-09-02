'use client'

import { useMemo, useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { currencySymbol } from '@/lib/currency'
import { useTranslations } from 'next-intl'

interface DataPoint { date: string; value: number }

interface Props {
  equityCurve: DataPoint[]
  depositCurve: DataPoint[]
  startCapital: number
  currency: string
}

function CustomTooltip({ active, payload, label, sym }: { active?: boolean; payload?: { value: number; dataKey: string }[]; label?: string; sym: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 10 }}>
      <p style={{ color: 'var(--text-3)', marginBottom: 4 }}>{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.dataKey === 'balance' ? '#3b82f6' : '#ef4444', fontFamily: 'var(--font-dm-mono)', fontWeight: 700 }}>
          {p.value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {sym}
        </p>
      ))}
    </div>
  )
}

export default function AccountBalanceCard({ equityCurve, depositCurve, startCapital, currency }: Props) {
  const t = useTranslations('dashboard.accountBalance')
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const sym = currencySymbol(currency)

  const chartData = useMemo(() => {
    const base = startCapital > 0
      ? [{ date: 'Start', balance: startCapital, deposits: 0 }, ...equityCurve.map((pt, i) => ({ date: pt.date, balance: pt.value, deposits: depositCurve[i]?.value ?? 0 }))]
      : equityCurve.map((pt, i) => ({ date: pt.date, balance: pt.value, deposits: depositCurve[i]?.value ?? 0 }))
    // Deduplicate by date (keep last)
    const map = new Map<string, { date: string; balance: number; deposits: number }>()
    for (const d of base) map.set(d.date, d)
    return Array.from(map.values())
  }, [equityCurve, depositCurve, startCapital])

  const lastBalance = chartData[chartData.length - 1]?.balance ?? startCapital

  if (!mounted) return null

  return (
    <div
      className="rounded-2xl"
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        boxShadow: 'var(--card-shadow)', padding: 14, overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <p style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: 3 }}>
            {t('title')}
          </p>
          <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em', fontFamily: 'var(--font-dm-mono)', fontVariantNumeric: 'tabular-nums' }}>
            {lastBalance.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {sym}
          </p>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} />
          <span style={{ fontSize: 9, color: 'var(--text-3)' }}>{t('balance')}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
          <span style={{ fontSize: 9, color: 'var(--text-3)' }}>{t('deposits')}</span>
        </div>
      </div>

      {/* Chart */}
      <div style={{ height: 130 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="date"
              tick={{ fill: 'var(--text-3)', fontSize: 8, fontFamily: 'inherit' }}
              axisLine={false} tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis hide />
            <Tooltip content={<CustomTooltip sym={sym} />} />
            <Line
              type="monotone" dataKey="balance"
              stroke="#3b82f6" strokeWidth={1.5} dot={false}
              activeDot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }}
            />
            <Line
              type="stepAfter" dataKey="deposits"
              stroke="#ef4444" strokeWidth={1.5} dot={false}
              activeDot={{ r: 3, fill: '#ef4444', strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
