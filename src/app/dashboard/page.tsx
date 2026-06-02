import { Suspense } from 'react'
import { getProfiles, getActiveProfile, setActiveProfileId, getProfileTrades } from '@/lib/profiles'
import { computeStats, filterTradesByPeriod } from '@/lib/data'
import { ensureSeedData } from '@/lib/seed'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import PnLCard from '@/components/dashboard/PnLCard'
import RiskCard from '@/components/dashboard/RiskCard'
import EquityChart from '@/components/dashboard/EquityChart'
import RecentTradesCard from '@/components/dashboard/RecentTradesCard'
import DashboardWinRate from '@/components/dashboard/DashboardWinRate'
import DashboardTimeFilter from '@/components/dashboard/DashboardTimeFilter'
import DemoBanner from '@/components/layout/DemoBanner'
import CriticalOpenTradesCard from '@/components/dashboard/CriticalOpenTradesCard'
import { StaggerWrapper } from '@/components/dashboard/StaggerWrapper'
import { Banknote, Gamepad2 } from 'lucide-react'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  ensureSeedData()

  const params = await searchParams
  const period = params?.period ?? 'gesamt'

  const profiles = getProfiles()

  if (profiles.length === 0) redirect('/setup')

  const onlyDemo = profiles.every(p => p.isDemo)

  let activeProfile = getActiveProfile()
  if (!activeProfile && profiles.length > 0) {
    setActiveProfileId(profiles[0].id)
    activeProfile = profiles[0]
  }
  if (!activeProfile) redirect('/setup')

  const allTrades = getProfileTrades(activeProfile.id)
  const trades = filterTradesByPeriod(allTrades, period)

  const stats = computeStats(trades, activeProfile.startCapital, activeProfile.deposits ?? [])

  const TypeIcon = activeProfile.type === 'live' ? Banknote : Gamepad2
  const totalCapital = activeProfile.startCapital + (activeProfile.deposits ?? []).reduce((s, d) => s + d.amount, 0)
  const capitalReturn = totalCapital > 0 ? stats.netPnl / totalCapital * 100 : 0

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar profiles={profiles} activeProfile={activeProfile} />

      <main className="flex-1 min-w-0 p-4 md:p-6">
        {onlyDemo && <DemoBanner />}

        {/* Header */}
        <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>
                Dashboard
              </h1>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1"
                style={{
                  background: activeProfile.type === 'live' ? 'var(--green-bg)' : 'var(--accent-bg)',
                  color: activeProfile.type === 'live' ? 'var(--green)' : 'var(--accent)',
                }}
              >
                <TypeIcon size={10} />
                {activeProfile.type === 'live' ? 'Echtgeld' : 'Spielgeld'}
              </span>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>
              {activeProfile.broker} · Startkapital:{' '}
              <span className="font-mono font-semibold" style={{ color: 'var(--text-2)' }}>
                {activeProfile.startCapital.toLocaleString('de-DE')} {activeProfile.currency}
              </span>
              {stats.totalTrades > 0 && (
                <span
                  className="ml-2 font-mono text-xs"
                  style={{ color: capitalReturn >= 0 ? 'var(--green)' : 'var(--red)' }}
                >
                  ({capitalReturn >= 0 ? '+' : ''}{capitalReturn.toFixed(1)}% auf Kapital)
                </span>
              )}
            </p>
          </div>

          {/* Zeitachse-Filter */}
          <Suspense fallback={null}>
            <DashboardTimeFilter />
          </Suspense>
        </div>

        {/* Bento Grid */}
        <StaggerWrapper>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 auto-rows-auto">

            <div className="lg:col-span-4" style={{ minHeight: 180 }}>
              <PnLCard
                totalPnl={stats.totalPnl}
                monthlyPnl={stats.monthlyPnl}
                dailyPnl={stats.dailyPnl}
                netPnl={stats.netPnl}
                netMonthlyPnl={stats.netMonthlyPnl}
                netDailyPnl={stats.netDailyPnl}
                totalCosts={stats.totalCosts}
                currency={activeProfile.currency}
              />
            </div>

            <div className="lg:col-span-4" style={{ minHeight: 180 }}>
              <DashboardWinRate
                winRate={stats.winRate}
                totalTrades={stats.totalTrades}
                openTrades={stats.openTrades}
                currentStreak={stats.currentStreak}
              />
            </div>

            <div className="lg:col-span-4" style={{ minHeight: 180 }}>
              <RiskCard avgRR={stats.avgRR} maxDrawdown={stats.maxDrawdown} />
            </div>

            <div className="lg:col-span-8" style={{ minHeight: 280 }}>
              <EquityChart
                data={stats.equityCurve}
                startCapital={activeProfile.startCapital}
                currency={activeProfile.currency}
              />
            </div>

            <div className="lg:col-span-4" style={{ minHeight: 280 }}>
              <RecentTradesCard trades={allTrades} />
            </div>

            <div className="lg:col-span-12">
              <CriticalOpenTradesCard trades={allTrades} currency={activeProfile.currency} />
            </div>

          </div>
        </StaggerWrapper>

        {/* Leerer Zustand */}
        {trades.length === 0 && allTrades.length === 0 && (
          <div
            className="mt-8 rounded-2xl p-8 flex flex-col items-center text-center"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'var(--accent-bg)' }}
            >
              <TypeIcon size={22} style={{ color: 'var(--accent)' }} />
            </div>
            <h3 className="font-semibold mb-2" style={{ color: 'var(--text-1)' }}>
              Deine Journey beginnt hier
            </h3>
            <p className="text-sm max-w-xs" style={{ color: 'var(--text-2)' }}>
              Du hast noch keine Trades eingetragen. Geh zu Trades und trage deinen ersten Trade ein.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
