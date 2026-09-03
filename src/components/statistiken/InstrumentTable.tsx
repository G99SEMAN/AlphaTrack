'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { InstrumentStats } from '@/lib/statsExtended'
import InfoTooltip from './InfoTooltip'
import { useTranslations } from 'next-intl'

type SortKey = 'totalPnl' | 'winRate' | 'trades' | 'avgPnl'

interface Props {
  data: InstrumentStats[]
  currency: string
}

export default function InstrumentTable({ data, currency }: Props) {
  const t = useTranslations('statistiken.instrumentTable')
  const [sortKey, setSortKey] = useState<SortKey>('totalPnl')
  const [sortAsc, setSortAsc] = useState(false)

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(v => !v)
    else { setSortKey(key); setSortAsc(false) }
  }

  const sorted = useMemo(() => [...data].sort((a, b) => {
    const diff = a[sortKey] - b[sortKey]
    return sortAsc ? diff : -diff
  }), [data, sortKey, sortAsc])

  const thStyle = (key: SortKey) => ({
    color: sortKey === key ? 'var(--accent)' : 'var(--text-3)',
    cursor: 'pointer',
  })

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
            {t('title')}
          </p>
          <InfoTooltip text={t('tooltip')} />
        </div>
      </div>

      {/* Scrollbarer Tabellen-Container - auf Mobile horizontal scrollbar */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 380 }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
              <th
                className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide"
                style={{ color: 'var(--text-3)', position: 'sticky', left: 0, background: 'var(--surface-2)', zIndex: 1 }}
              >
                {t('colInstrument')}
              </th>
              <th
                className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wide"
                style={thStyle('trades')}
                onClick={() => toggleSort('trades')}
              >
                {t('colTrades')} {sortKey === 'trades' ? (sortAsc ? '↑' : '↓') : ''}
              </th>
              <th
                className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wide"
                style={thStyle('winRate')}
                onClick={() => toggleSort('winRate')}
              >
                {t('colWinPct')} {sortKey === 'winRate' ? (sortAsc ? '↑' : '↓') : ''}
              </th>
              <th
                className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wide"
                style={thStyle('totalPnl')}
                onClick={() => toggleSort('totalPnl')}
              >
                {t('colTotal')} {sortKey === 'totalPnl' ? (sortAsc ? '↑' : '↓') : ''}
              </th>
              <th
                className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide"
                style={thStyle('avgPnl')}
                onClick={() => toggleSort('avgPnl')}
              >
                {t('colAvgTrade')} {sortKey === 'avgPnl' ? (sortAsc ? '↑' : '↓') : ''}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr
                key={row.instrument}
                style={{ borderBottom: i < sorted.length - 1 ? '1px solid var(--border)' : 'none' }}
              >
                <td
                  className="px-4 py-3 font-mono font-semibold text-sm"
                  style={{ color: 'var(--text-1)', position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 1 }}
                >
                  {row.instrument}
                </td>
                <td className="px-3 py-3 text-right font-mono text-sm" style={{ color: 'var(--text-2)' }}>
                  {row.trades}
                </td>
                <td className="px-3 py-3 text-right font-mono text-sm" style={{ color: row.winRate >= 50 ? 'var(--green)' : 'var(--red)' }}>
                  {row.winRate.toFixed(1)}%
                </td>
                <td className="px-3 py-3 text-right font-mono text-sm font-semibold" style={{ color: row.totalPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {row.totalPnl >= 0 ? '+' : ''}{row.totalPnl.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm" style={{ color: row.avgPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {row.avgPnl >= 0 ? '+' : ''}{row.avgPnl.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sorted.length === 0 && (
        <p className="px-5 py-8 text-sm text-center" style={{ color: 'var(--text-3)' }}>{t('noData')}</p>
      )}

      <div className="px-5 py-2 text-xs" style={{ color: 'var(--text-3)', borderTop: '1px solid var(--border)' }}>
        {t('allValuesIn', { currency })}
      </div>
    </motion.div>
  )
}
