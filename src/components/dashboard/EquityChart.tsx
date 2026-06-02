'use client'

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { currencySymbol } from '@/lib/currency'
import { useEffect, useState, useMemo } from 'react'

interface DataPoint { date: string; value: number }
interface Props { data: DataPoint[]; startCapital?: number; currency?: string }

function CustomTooltip({
  active, payload, label, startCapital,
}: {
  active?: boolean; payload?: { value: number }[]; label?: string; startCapital: number
}) {
  if (!active || !payload?.length) return null
  const balance = payload[0].value
  const pnl = balance - startCapital
  return (
    <div
      className="px-3 py-2 rounded-lg text-xs"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--card-shadow)',
      }}
    >
      <p style={{ color: 'var(--text-2)' }}>{label}</p>
      <p className="font-mono font-bold" style={{ color: 'var(--text-1)' }}>
        {balance.toLocaleString('de-DE')} €
      </p>
      <p className="font-mono text-xs" style={{ color: pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
        {pnl >= 0 ? '+' : ''}{pnl.toLocaleString('de-DE')} €
      </p>
    </div>
  )
}

export default function EquityChart({ data, startCapital = 0, currency = '€' }: Props) {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const absoluteData = useMemo<DataPoint[]>(() =>
    startCapital > 0 ? [{ date: 'Start', value: startCapital }, ...data] : data,
    [data, startCapital]
  )
  if (!mounted) return null

  const isDark = theme === 'dark'

  const lastBalance = absoluteData[absoluteData.length - 1]?.value ?? startCapital
  const pnl = lastBalance - startCapital
  const positive = pnl >= 0
  const strokeColor = positive ? 'var(--green)' : 'var(--red)'

  // Y-axis domain with a little padding
  const values = absoluteData.map(d => d.value)
  const minVal = Math.min(...values, startCapital)
  const maxVal = Math.max(...values, startCapital)
  const padding = (maxVal - minVal) * 0.15 || startCapital * 0.05 || 10
  const yDomain: [number, number] = [Math.floor(minVal - padding), Math.ceil(maxVal + padding)]

  return (
    <motion.div
      className="rounded-2xl p-5 flex flex-col gap-4 h-full"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--card-shadow)',
      }}
      whileHover={{ boxShadow: 'var(--card-shadow-hover)' }}
      transition={{ duration: 0.15 }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
            Kontostand
          </p>
          <p className="text-2xl font-bold font-mono mt-1" style={{ color: 'var(--text-1)' }}>
            {lastBalance.toLocaleString('de-DE')} {currencySymbol(currency)}
          </p>
          {startCapital > 0 && (
            <p className="text-xs font-mono mt-0.5" style={{ color: positive ? 'var(--green)' : 'var(--red)' }}>
              {pnl >= 0 ? '+' : ''}{pnl.toLocaleString('de-DE')} {currencySymbol(currency)} seit Deposit
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span
            className="text-xs px-2 py-1 rounded-md font-mono"
            style={{
              background: positive ? 'var(--green-bg)' : 'var(--red-bg)',
              color: positive ? 'var(--green)' : 'var(--red)',
            }}
          >
            {pnl >= 0 ? '+' : ''}{startCapital > 0 ? ((pnl / startCapital) * 100).toFixed(1) : '0.0'}%
          </span>
          <span className="text-xs" style={{ color: 'var(--text-3)' }}>
            {data.length} Trades
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0" style={{ minHeight: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={absoluteData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={positive ? 'var(--green)' : 'var(--red)'} stopOpacity={0.3} />
                <stop offset="100%" stopColor={positive ? 'var(--green)' : 'var(--red)'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fill: 'var(--text-3)', fontSize: 10, fontFamily: 'inherit' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: 'var(--text-3)', fontSize: 10, fontFamily: 'monospace' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => `${v.toLocaleString('de-DE')}€`}
              domain={yDomain}
              width={65}
            />
            {startCapital > 0 && (
              <ReferenceLine
                y={startCapital}
                stroke="var(--text-3)"
                strokeDasharray="3 3"
                strokeOpacity={0.5}
              />
            )}
            <Tooltip content={<CustomTooltip startCapital={startCapital} />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={strokeColor}
              strokeWidth={2}
              fill="url(#equityGradient)"
              dot={false}
              activeDot={{ r: 4, fill: strokeColor, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  )
}
