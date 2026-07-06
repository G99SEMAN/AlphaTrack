import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { getProfiles, getActiveProfile, setActiveProfileId, getProfileTrades } from '@/lib/profiles'
import { computeStats, filterTradesByPeriod } from '@/lib/data'
import Sidebar from '@/components/layout/Sidebar'
import EmptyProfileState from '@/components/dashboard/EmptyProfileState'
import DateRangePicker from '@/components/dashboard/DateRangePicker'
import { StaggerWrapper } from '@/components/dashboard/StaggerWrapper'
import { Banknote, Gamepad2 } from 'lucide-react'

const KpiStrip = dynamic(() => import('@/components/dashboard/KpiStrip'), {
  loading: () => <div style={{ height: 100 }} />,
})
const TradingCalendar = dynamic(() => import('@/components/dashboard/TradingCalendar'), {
  loading: () => <div style={{ minHeight: 400 }} />,
})
const AlphaScoreChart = dynamic(() => import('@/components/dashboard/AlphaScoreChart'), {
  loading: () => <div style={{ minHeight: 300 }} />,
})
const EquityChart = dynamic(() => import('@/components/dashboard/EquityChart'), {
  loading: () => <div style={{ minHeight: 200 }} />,
})
const RecentTradesCard = dynamic(() => import('@/components/dashboard/RecentTradesCard'), {
  loading: () => <div style={{ minHeight: 200 }} />,
})
const AccountBalanceCard = dynamic(() => import('@/components/dashboard/AccountBalanceCard'), {
  loading: () => <div style={{ minHeight: 180 }} />,
})

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>
}) {
  const params = await searchParams
  const period = params?.period ?? 'gesamt'
  const from = params?.from
  const to = params?.to

  const profiles = getProfiles()

  let activeProfile = getActiveProfile()
  if (!activeProfile && profiles.length > 0) {
    setActiveProfileId(profiles[0].id)
    activeProfile = profiles[0]
  }

  if (profiles.length === 0 || !activeProfile) {
    return (
      <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
        <Sidebar profiles={[]} activeProfile={null} />
        <main className="flex-1 min-w-0 p-4 md:p-6">
          <EmptyProfileState />
        </main>
      </div>
    )
  }

  const allTrades = getProfileTrades(activeProfile.id)
  const trades = filterTradesByPeriod(allTrades, period, from, to)
  const stats = computeStats(trades, activeProfile.startCapital, activeProfile.deposits ?? [])
  const allStats = computeStats(allTrades, activeProfile.startCapital, activeProfile.deposits ?? [])

  const TypeIcon = activeProfile.type === 'live' ? Banknote : Gamepad2
  const totalCapital = activeProfile.startCapital + (activeProfile.deposits ?? []).reduce((s, d) => s + d.amount, 0)
  const capitalReturn = totalCapital > 0 ? stats.netPnl / totalCapital * 100 : 0

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar profiles={profiles} activeProfile={activeProfile} />

      <main className="flex-1 min-w-0 p-4 md:p-6">
        {/* Header */}
        <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-start md:justify-between md:gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>
                Dashboard
              </h1>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 shrink-0"
                style={{
                  background: activeProfile.type === 'live' ? 'var(--green-bg)' : 'var(--accent-bg)',
                  color: activeProfile.type === 'live' ? 'var(--green)' : 'var(--accent)',
                }}
              >
                <TypeIcon size={10} />
                {activeProfile.type === 'live' ? 'Echtgeld' : 'Spielgeld'}
              </span>
            </div>
            <p className="text-sm md:truncate" style={{ color: 'var(--text-3)' }}>
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

          <Suspense fallback={null}>
            <DateRangePicker />
          </Suspense>
        </div>

        <StaggerWrapper>
          <div className="flex flex-col gap-4">

            {/* KPI Strip — 4 Karten oben */}
            <KpiStrip
              netPnl={stats.netPnl}
              totalTrades={stats.totalTrades}
              profitFactor={stats.profitFactor}
              winRate={stats.winRate}
              openTrades={stats.openTrades}
              avgWin={stats.avgWin}
              avgLoss={stats.avgLoss}
              currency={activeProfile.currency}
            />

            {/* Haupt-Bereich: linkes Panel | Kalender (Mitte) | rechtes Panel — unter xl gestapelt */}
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start">

              {/* Linkes Panel: Recent Trades + Account Balance */}
              <div className="flex w-full flex-col gap-3 xl:w-[270px] xl:shrink-0">
                <RecentTradesCard
                  trades={allTrades}
                  currency={activeProfile.currency}
                />
                <AccountBalanceCard
                  equityCurve={allStats.equityCurve}
                  depositCurve={allStats.depositCurve}
                  startCapital={activeProfile.startCapital}
                  currency={activeProfile.currency}
                />
              </div>

              {/* Kalender — Mitte */}
              <div className="w-full min-w-0 xl:flex-1">
                <TradingCalendar
                  trades={allTrades}
                  currency={activeProfile.currency}
                />
              </div>

              {/* Rechtes Panel: Alpha Score + Equity Chart */}
              <div className="flex w-full flex-col gap-3 xl:w-[280px] xl:shrink-0">
                <AlphaScoreChart
                  winRate={allStats.winRate}
                  profitFactor={allStats.profitFactor}
                  avgWin={allStats.avgWin}
                  avgLoss={allStats.avgLoss}
                  maxDrawdown={allStats.maxDrawdown}
                  maxDrawdownAbs={allStats.maxDrawdownAbs}
                  netPnl={allStats.netPnl}
                  trades={allTrades}
                />

                <EquityChart
                  data={allStats.equityCurve}
                  startCapital={activeProfile.startCapital}
                  currency={activeProfile.currency}
                />
              </div>
            </div>

          </div>
        </StaggerWrapper>

        {/* Leer-Zustand */}
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
