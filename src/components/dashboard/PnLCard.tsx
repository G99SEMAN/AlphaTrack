'use client'

import { memo } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Receipt } from 'lucide-react'
import { currencySymbol } from '@/lib/currency'

interface Props {
  totalPnl: number
  monthlyPnl: number
  dailyPnl: number
  netPnl: number
  netMonthlyPnl: number
  netDailyPnl: number
  totalCosts: number
  currency: string
}

function fmt(val: number, currency: string) {
  const sign = val >= 0 ? '+' : ''
  return `${sign}${val.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${currencySymbol(currency)}`
}

function SmallStat({ label, gross, net }: { label: string; gross: number; net: number }) {
  const hasCosts = gross !== net
  return (
    <div>
      <p className="text-xs mb-0.5" style={{ color: 'var(--text-3)' }}>{label}</p>
      <p className="text-sm font-semibold font-mono" style={{ color: net >= 0 ? 'var(--green)' : 'var(--red)' }}>
        {net >= 0 ? '+' : ''}{net.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
      </p>
      {hasCosts && (
        <p className="text-xs font-mono" style={{ color: 'var(--text-3)' }}>
          Brutto: {gross >= 0 ? '+' : ''}{gross.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </p>
      )}
    </div>
  )
}

function PnLCard({ totalPnl, monthlyPnl, dailyPnl, netPnl, netMonthlyPnl, netDailyPnl, totalCosts, currency }: Props) {
  const positive = netPnl >= 0
  const hasCosts = totalCosts > 0
  const Icon = positive ? TrendingUp : TrendingDown

  return (
    <motion.div
      className="rounded-2xl p-5 flex flex-col gap-4 h-full"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}
      whileHover={{ boxShadow: 'var(--card-shadow-hover)', y: -1 }}
      transition={{ duration: 0.15 }}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
          {hasCosts ? 'Netto P&L' : 'Gesamt P&L'}
        </p>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: positive ? 'var(--green-bg)' : 'var(--red-bg)' }}>
          <Icon size={15} style={{ color: positive ? 'var(--green)' : 'var(--red)' }} />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <motion.p
          className="text-3xl font-bold font-mono leading-none"
          style={{ color: positive ? 'var(--green)' : 'var(--red)' }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          {fmt(netPnl, currency)}
        </motion.p>
        {hasCosts && (
          <p className="text-xs font-mono" style={{ color: 'var(--text-3)' }}>
            Brutto: {fmt(totalPnl, currency)}
          </p>
        )}
      </div>

      {hasCosts && (
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
          style={{ background: 'rgba(255,69,96,0.08)', border: '1px solid rgba(255,69,96,0.2)' }}
        >
          <Receipt size={11} style={{ color: 'var(--red)', flexShrink: 0 }} />
          <p className="text-xs font-mono" style={{ color: 'var(--red)' }}>
            Kosten gesamt: -{totalCosts.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
          </p>
        </div>
      )}

      <div className="flex gap-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
        <SmallStat label="Diesen Monat" gross={monthlyPnl} net={netMonthlyPnl} />
        <SmallStat label="Heute" gross={dailyPnl} net={netDailyPnl} />
      </div>
    </motion.div>
  )
}

export default memo(PnLCard)
