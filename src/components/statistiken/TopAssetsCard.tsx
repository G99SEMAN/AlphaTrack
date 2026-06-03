'use client'

import { motion } from 'framer-motion'
import { InstrumentStats } from '@/lib/statsExtended'
import { currencySymbol } from '@/lib/currency'
import InfoTooltip from './InfoTooltip'

interface Props {
  data: InstrumentStats[]
  currency: string
}

export default function TopAssetsCard({ data, currency }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}
    >
      <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
            Top 5 Assets nach Trades
          </p>
          <InfoTooltip text="Deine 5 meist-gehandelten Instrumente nach Trade-Anzahl." />
        </div>
      </div>

      {/* Desktop Tabelle */}
      <div className="hidden sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
              <th className="text-left px-5 py-2.5 text-xs font-semibold uppercase tracking-wide w-6" style={{ color: 'var(--text-3)' }}>
                #
              </th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
                Asset
              </th>
              <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
                Trades
              </th>
              <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
                Win Rate
              </th>
              <th className="text-right px-5 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
                P&amp;L
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr
                key={row.instrument}
                style={{ borderBottom: i < data.length - 1 ? '1px solid var(--border)' : 'none' }}
              >
                <td className="px-5 py-3 font-mono text-xs font-bold" style={{ color: 'var(--text-3)' }}>
                  {i + 1}
                </td>
                <td className="px-3 py-3">
                  <span className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>
                    {row.instrument}
                  </span>
                </td>
                <td className="px-3 py-3 text-right font-mono text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
                  {row.trades}
                </td>
                <td className="px-3 py-3 text-right font-mono text-sm" style={{ color: row.winRate >= 50 ? 'var(--green)' : 'var(--red)' }}>
                  {row.winRate.toFixed(1)}%
                </td>
                <td className="px-5 py-3 text-right font-mono text-sm" style={{ color: row.totalPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {row.totalPnl >= 0 ? '+' : ''}{row.totalPnl.toLocaleString('de-DE', { minimumFractionDigits: 2 })} {currencySymbol(currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Karten-Layout */}
      <div className="sm:hidden">
        {data.map((row, i) => (
          <div
            key={row.instrument}
            className="flex items-center gap-3 px-4 py-3"
            style={{ borderBottom: i < data.length - 1 ? '1px solid var(--border)' : 'none' }}
          >
            {/* Rang */}
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}
            >
              {i + 1}
            </span>
            {/* Asset + Win Rate */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold font-mono" style={{ color: 'var(--text-1)' }}>
                {row.instrument}
              </p>
              <p className="text-xs mt-0.5" style={{ color: row.winRate >= 50 ? 'var(--green)' : 'var(--red)' }}>
                {row.winRate.toFixed(1)}% Win · {row.trades} Trades
              </p>
            </div>
            {/* P&L */}
            <div className="text-right shrink-0">
              <p className="text-sm font-mono font-semibold" style={{ color: row.totalPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {row.totalPnl >= 0 ? '+' : ''}{row.totalPnl.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>{currency}</p>
            </div>
          </div>
        ))}
      </div>

      {data.length === 0 && (
        <p className="px-5 py-8 text-sm text-center" style={{ color: 'var(--text-3)' }}>Keine Trades vorhanden</p>
      )}
    </motion.div>
  )
}
