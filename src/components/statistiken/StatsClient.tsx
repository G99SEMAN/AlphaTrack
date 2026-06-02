'use client'

import { motion } from 'framer-motion'
import { BarChart2 } from 'lucide-react'
import { ExtendedStats } from '@/lib/statsExtended'
import { useStatsSettings } from '@/hooks/useStatsSettings'
import KpiRow from './KpiRow'
import MonthlyPnlChart from './MonthlyPnlChart'
import DirectionCards from './DirectionCards'
import InstrumentTable from './InstrumentTable'
import TopAssetsCard from './TopAssetsCard'
import StrategyTable from './StrategyTable'
import WeekdayChart from './WeekdayChart'
import RMultipleChart from './RMultipleChart'
import TopTradesCard from './TopTradesCard'

interface Props {
  stats: ExtendedStats
  currency: string
}

export default function StatsClient({ stats, currency }: Props) {
  const { settings } = useStatsSettings()
  const activeStats = stats

  if (activeStats.totalClosed === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-10 flex flex-col items-center text-center mt-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--surface-2)' }}>
          <BarChart2 size={22} style={{ color: 'var(--text-3)' }} />
        </div>
        <h3 className="font-semibold mb-2" style={{ color: 'var(--text-1)' }}>Noch keine Auswertung</h3>
        <p className="text-sm max-w-xs" style={{ color: 'var(--text-2)' }}>
          Trage mindestens einen abgeschlossenen Trade ein um die Statistiken zu sehen.
        </p>
      </motion.div>
    )
  }

  const rMultipleTrades = activeStats.rMultiples.reduce((s, b) => s + b.count, 0)

  return (
    <div className="flex flex-col gap-5 mt-2">
      {/* KPI-Leiste */}
      {settings.showKpiRow && (
        <KpiRow
          profitFactor={activeStats.profitFactor}
          expectancy={activeStats.expectancy}
          avgWin={activeStats.avgWin}
          avgLoss={activeStats.avgLoss}
          winLossRatio={activeStats.winLossRatio}
          costRatio={activeStats.costRatio}
          roi={activeStats.roi}
          avgTradesPerDay={activeStats.avgTradesPerDay}
          currency={currency}
        />
      )}

      {/* Monatlicher P&L + Long/Short */}
      {activeStats.monthlyPnl.length > 0 && (settings.showMonthlyPnl || settings.showDirectionCards) && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {settings.showMonthlyPnl && (
            <div className={settings.showDirectionCards ? 'lg:col-span-8' : 'lg:col-span-12'} style={{ minHeight: 'clamp(220px, 50vw, 280px)' }}>
              <MonthlyPnlChart data={activeStats.monthlyPnl} currency={currency} />
            </div>
          )}
          {settings.showDirectionCards && (
            <div className={settings.showMonthlyPnl ? 'lg:col-span-4' : 'lg:col-span-12'} style={{ minHeight: 'clamp(200px, 45vw, 280px)' }}>
              <DirectionCards long={activeStats.long} short={activeStats.short} currency={currency} />
            </div>
          )}
        </div>
      )}

      {/* Top 5 Assets + Strategie */}
      {(settings.showTopAssets || settings.showStrategyTable) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {settings.showTopAssets && <TopAssetsCard data={activeStats.top5ByTradeCount} currency={currency} />}
          {settings.showStrategyTable && <StrategyTable data={activeStats.byStrategy} />}
        </div>
      )}

      {/* Alle Instrumente nach P&L */}
      {settings.showInstrumentTable && (
        <InstrumentTable data={activeStats.byInstrument} currency={currency} />
      )}

      {/* Wochentag + R-Multiple */}
      {(settings.showWeekdayChart || (settings.showRMultipleChart && activeStats.hasRMultipleData)) && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {settings.showWeekdayChart && (
            <div className={settings.showRMultipleChart && activeStats.hasRMultipleData ? 'lg:col-span-7' : 'lg:col-span-12'} style={{ minHeight: 'clamp(200px, 45vw, 260px)' }}>
              <WeekdayChart data={activeStats.byWeekday} currency={currency} />
            </div>
          )}
          {settings.showRMultipleChart && activeStats.hasRMultipleData && (
            <div className={settings.showWeekdayChart ? 'lg:col-span-5' : 'lg:col-span-12'} style={{ minHeight: 'clamp(200px, 45vw, 260px)' }}>
              <RMultipleChart data={activeStats.rMultiples} totalTrades={rMultipleTrades} />
            </div>
          )}
        </div>
      )}

      {/* Beste Trades */}
      {settings.showTopTrades && activeStats.topTrades.length > 0 && (
        <TopTradesCard trades={activeStats.topTrades} currency={currency} />
      )}
    </div>
  )
}
