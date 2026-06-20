'use client'

import { memo, useMemo, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { currencySymbol } from '@/lib/currency'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

interface DataPoint { date: string; value: number }

interface Props {
  totalPnl: number
  monthlyPnl: number
  dailyPnl: number
  netPnl: number
  netMonthlyPnl: number
  netDailyPnl: number
  totalCosts: number
  currency: string
  equityCurve?: DataPoint[]
  startCapital?: number
}

function fmt(val: number, currency: string) {
  const sym = currencySymbol(currency)
  const sign = val >= 0 ? '+' : ''
  return `${sign}${val.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${sym}`
}

function niceScale(min: number, max: number, targetTicks = 5): number[] {
  if (min === max) return [min]
  const range = max - min
  const roughStep = range / (targetTicks - 1)
  const mag = Math.pow(10, Math.floor(Math.log10(roughStep)))
  const residual = roughStep / mag
  let step: number
  if (residual <= 1.5) step = mag
  else if (residual <= 3) step = 2 * mag
  else if (residual <= 7) step = 5 * mag
  else step = 10 * mag
  const niceMin = Math.floor(min / step) * step
  const niceMax = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = niceMin; v <= niceMax + step * 0.5; v += step) {
    ticks.push(Math.round(v * 100) / 100)
  }
  return ticks
}

function PnLTooltip({ active, payload, label, sym }: { active?: boolean; payload?: { value: number }[]; label?: string; sym: string }) {
  if (!active || !payload?.length) return null
  const v = payload[0].value
  return (
    <div
      className="px-3 py-2 rounded-lg text-xs"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}
    >
      <p style={{ color: 'var(--text-2)' }}>{label}</p>
      <p className="font-mono font-bold" style={{ color: v >= 0 ? 'var(--green)' : 'var(--red)' }}>
        {v >= 0 ? '+' : ''}{v.toLocaleString('de-DE')} {sym}
      </p>
    </div>
  )
}

function PnLCard({ totalPnl, monthlyPnl, dailyPnl, netPnl, netMonthlyPnl, netDailyPnl, totalCosts, currency, equityCurve = [], startCapital = 0 }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const positive = netPnl >= 0
  const hasCosts = totalCosts > 0
  const color = positive ? 'var(--green)' : 'var(--red)'
  const sym = currencySymbol(currency)

  const pnlData = useMemo(() => {
    if (equityCurve.length < 2) return []
    const dayMap = new Map<string, number>()
    for (const d of equityCurve) {
      dayMap.set(d.date, d.value - startCapital)
    }
    return [{ date: 'Start', value: 0 }, ...Array.from(dayMap, ([date, value]) => ({ date, value }))]
  }, [equityCurve, startCapital])

  const { yTicks, yDomain } = useMemo(() => {
    if (pnlData.length === 0) return { yTicks: [0], yDomain: [0, 0] as [number, number] }
    const values = pnlData.map(d => d.value)
    const min = Math.min(0, ...values)
    const max = Math.max(0, ...values)
    const t = niceScale(min, max, 4)
    return { yTicks: t, yDomain: [t[0], t[t.length - 1]] as [number, number] }
  }, [pnlData])

  return (
    <motion.div
      className="rounded-2xl flex flex-col h-full"
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        boxShadow: 'var(--card-shadow)', padding: 16,
        position: 'relative', overflow: 'hidden',
      }}
      whileHover={{ boxShadow: 'var(--card-shadow-hover)', y: -1 }}
      transition={{ duration: 0.15 }}
    >
      {/* Top-Glow */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: 'linear-gradient(90deg,transparent,rgba(59,130,246,0.18),transparent)',
      }} />

      <p style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: 10 }}>
        {hasCosts ? 'Netto P&L · Gesamt' : 'P&L · Gesamt'}
      </p>

      <motion.p
        style={{
          fontSize: 32, fontWeight: 800, color, letterSpacing: '-0.04em', lineHeight: 1,
          fontFamily: 'var(--font-dm-mono)', fontVariantNumeric: 'tabular-nums',
          marginBottom: 8,
        }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        {fmt(netPnl, currency)}
      </motion.p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {hasCosts && (
          <span style={{
            fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
            background: 'rgba(255,69,96,0.08)', border: '1px solid rgba(255,69,96,0.18)', color: 'var(--red)',
            fontFamily: 'var(--font-dm-mono)',
          }}>
            Kosten: -{totalCosts.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} {currencySymbol(currency)}
          </span>
        )}
        {netDailyPnl !== 0 && (
          <span style={{
            fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
            background: netDailyPnl >= 0 ? 'rgba(0,217,126,0.08)' : 'rgba(255,69,96,0.08)',
            border: netDailyPnl >= 0 ? '1px solid rgba(0,217,126,0.18)' : '1px solid rgba(255,69,96,0.18)',
            color: netDailyPnl >= 0 ? 'var(--green)' : 'var(--red)',
            fontFamily: 'var(--font-dm-mono)',
          }}>
            Heute: {fmt(netDailyPnl, currency)}
          </span>
        )}
      </div>

      {pnlData.length >= 2 && mounted && (
        <div style={{ height: 120, marginBottom: 12 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={pnlData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={positive ? 0.22 : 0.15} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fill: 'var(--text-3)', fontSize: 9, fontFamily: 'inherit' }}
                axisLine={false} tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: 'var(--text-3)', fontSize: 9, fontFamily: 'monospace' }}
                axisLine={false} tickLine={false}
                ticks={yTicks}
                domain={yDomain}
                width={45}
                tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v}${sym}`}
              />
              <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="3 3" strokeOpacity={0.8} />
              <Tooltip content={<PnLTooltip sym={sym} />} />
              <Area
                type="monotone" dataKey="value" stroke={color} strokeWidth={1.5}
                fill="url(#pnlGradient)" dot={false}
                activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ display: 'flex', gap: 20, paddingTop: 10, borderTop: '1px solid var(--border)', marginTop: 'auto' }}>
        <div>
          <p style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 3 }}>Diesen Monat</p>
          <p style={{ fontSize: 13, fontWeight: 700, color: netMonthlyPnl >= 0 ? 'var(--green)' : 'var(--red)', fontFamily: 'var(--font-dm-mono)', fontVariantNumeric: 'tabular-nums' }}>
            {fmt(netMonthlyPnl, currency)}
          </p>
        </div>
        <div>
          <p style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 3 }}>Brutto</p>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', fontFamily: 'var(--font-dm-mono)', fontVariantNumeric: 'tabular-nums' }}>
            {fmt(totalPnl, currency)}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

export default memo(PnLCard)
