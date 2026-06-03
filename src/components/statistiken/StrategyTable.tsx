'use client'

import { motion } from 'framer-motion'
import { StrategyStats } from '@/lib/statsExtended'
import InfoTooltip from './InfoTooltip'

interface Props {
  data: StrategyStats[]
}

function PfBadge({ pf }: { pf: number }) {
  const label = pf >= 99 ? '∞' : pf.toFixed(2)
  const color = pf >= 1.5 ? 'var(--green)' : pf >= 1 ? '#f59e0b' : 'var(--red)'
  const bg = pf >= 1.5 ? 'var(--green-bg)' : pf >= 1 ? 'rgba(245,158,11,0.1)' : 'var(--red-bg)'
  return (
    <span
      className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md"
      style={{ background: bg, color }}
    >
      {label}
    </span>
  )
}

export default function StrategyTable({ data }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}
    >
      <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
            Performance nach Strategie
          </p>
          <InfoTooltip text="Performance-Vergleich deiner definierten Handelsstrategien." />
        </div>
      </div>

      {/* Desktop Tabelle */}
      <div className="hidden sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
              <th className="text-left px-5 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
                Strategie
              </th>
              <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
                Trades
              </th>
              <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
                Win Rate
              </th>
              <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
                Profit Factor
              </th>
              <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
                Ø RR
              </th>
              <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
                P&amp;L
              </th>
              <th className="text-right px-5 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
                ROI
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr
                key={row.strategyId ?? '__none__'}
                style={{ borderBottom: i < data.length - 1 ? '1px solid var(--border)' : 'none' }}
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    {row.color && (
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: row.color }} />
                    )}
                    <span className="font-semibold text-sm" style={{ color: row.strategyId ? 'var(--text-1)' : 'var(--text-3)' }}>
                      {row.name}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3 text-right font-mono text-sm" style={{ color: 'var(--text-2)' }}>
                  {row.trades}
                </td>
                <td className="px-3 py-3 text-right font-mono text-sm" style={{ color: row.winRate >= 50 ? 'var(--green)' : 'var(--red)' }}>
                  {row.winRate.toFixed(1)}%
                </td>
                <td className="px-3 py-3 text-right">
                  <PfBadge pf={row.profitFactor} />
                </td>
                <td className="px-3 py-3 text-right font-mono text-sm" style={{ color: row.avgRR > 0 ? 'var(--text-2)' : 'var(--text-3)' }}>
                  {row.avgRR > 0 ? `1:${row.avgRR.toFixed(2)}` : '-'}
                </td>
                <td className="px-3 py-3 text-right font-mono text-sm" style={{ color: row.totalPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {row.totalPnl >= 0 ? '+' : ''}{row.totalPnl.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-5 py-3 text-right font-mono text-sm font-semibold" style={{ color: row.roi >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {row.roi !== 0 ? `${row.roi >= 0 ? '+' : ''}${row.roi.toFixed(2)}%` : '-'}
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
            key={row.strategyId ?? '__none__'}
            className="px-4 py-3.5"
            style={{ borderBottom: i < data.length - 1 ? '1px solid var(--border)' : 'none' }}
          >
            {/* Strategie-Name */}
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                {row.color && (
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: row.color }} />
                )}
                <span className="font-semibold text-sm" style={{ color: row.strategyId ? 'var(--text-1)' : 'var(--text-3)' }}>
                  {row.name}
                </span>
              </div>
              <PfBadge pf={row.profitFactor} />
            </div>
            {/* Stats Grid 2x3 */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg px-2.5 py-2" style={{ background: 'var(--surface-2)' }}>
                <p className="text-xs mb-0.5" style={{ color: 'var(--text-3)' }}>Trades</p>
                <p className="text-sm font-mono font-semibold" style={{ color: 'var(--text-1)' }}>{row.trades}</p>
              </div>
              <div className="rounded-lg px-2.5 py-2" style={{ background: 'var(--surface-2)' }}>
                <p className="text-xs mb-0.5" style={{ color: 'var(--text-3)' }}>Win Rate</p>
                <p className="text-sm font-mono font-semibold" style={{ color: row.winRate >= 50 ? 'var(--green)' : 'var(--red)' }}>
                  {row.winRate.toFixed(1)}%
                </p>
              </div>
              <div className="rounded-lg px-2.5 py-2" style={{ background: 'var(--surface-2)' }}>
                <p className="text-xs mb-0.5" style={{ color: 'var(--text-3)' }}>Ø RR</p>
                <p className="text-sm font-mono font-semibold" style={{ color: row.avgRR > 0 ? 'var(--text-2)' : 'var(--text-3)' }}>
                  {row.avgRR > 0 ? `1:${row.avgRR.toFixed(1)}` : '-'}
                </p>
              </div>
              <div className="rounded-lg px-2.5 py-2 col-span-2" style={{ background: 'var(--surface-2)' }}>
                <p className="text-xs mb-0.5" style={{ color: 'var(--text-3)' }}>P&amp;L</p>
                <p className="text-sm font-mono font-semibold" style={{ color: row.totalPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {row.totalPnl >= 0 ? '+' : ''}{row.totalPnl.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="rounded-lg px-2.5 py-2" style={{ background: 'var(--surface-2)' }}>
                <p className="text-xs mb-0.5" style={{ color: 'var(--text-3)' }}>ROI</p>
                <p className="text-sm font-mono font-semibold" style={{ color: row.roi >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {row.roi !== 0 ? `${row.roi >= 0 ? '+' : ''}${row.roi.toFixed(1)}%` : '-'}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {data.length === 0 && (
        <p className="px-5 py-8 text-sm text-center" style={{ color: 'var(--text-3)' }}>Keine Trades mit Strategie</p>
      )}
    </motion.div>
  )
}
