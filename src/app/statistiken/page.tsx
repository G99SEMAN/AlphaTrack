export const dynamic = 'force-dynamic'

import { getProfiles, getActiveProfile, getProfileTrades } from '@/lib/profiles'
import { getProfileStrategies } from '@/lib/strategies'
import { computeExtendedStats } from '@/lib/statsExtended'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import StatsClient from '@/components/statistiken/StatsClient'

export default function StatistikenPage() {
  const profiles = getProfiles()
  if (profiles.length === 0) redirect('/setup')
  const activeProfile = getActiveProfile()
  if (!activeProfile) redirect('/setup')

  const trades = getProfileTrades(activeProfile.id)
  const strategies = getProfileStrategies(activeProfile.id)
  const totalCapital = activeProfile.startCapital + (activeProfile.deposits ?? []).reduce((s, d) => s + d.amount, 0)
  const stats = computeExtendedStats(trades, strategies, totalCapital)

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar profiles={profiles} activeProfile={activeProfile} />
      <main className="flex-1 min-w-0 p-4 md:p-6 max-w-full overflow-hidden">
        <div className="mb-5">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Statistiken</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>
            {activeProfile.name} · {stats.totalClosed} abgeschlossene Trades
          </p>
        </div>
        <StatsClient stats={stats} currency={activeProfile.currency} />
      </main>
    </div>
  )
}
