import { getProfiles, getActiveProfile, getProfileTrades } from '@/lib/profiles'
import { getProfileStrategies } from '@/lib/strategies'
import { getBots } from '@/lib/bot-data'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import DemoBanner from '@/components/layout/DemoBanner'
import JournalClient from '@/components/journal/JournalClient'
import LivePositionsWidget from '@/components/journal/LivePositionsWidget'

export default function JournalPage() {
  const profiles = getProfiles()
  if (profiles.length === 0) redirect('/setup')
  const activeProfile = getActiveProfile()
  if (!activeProfile) redirect('/setup')

  const trades = getProfileTrades(activeProfile.id)
  const strategies = getProfileStrategies(activeProfile.id)
  const bots = getBots()

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar profiles={profiles} activeProfile={activeProfile} />
      <main className="flex-1 p-4 md:p-6 max-w-full overflow-hidden">
        {activeProfile.isDemo && <DemoBanner />}
        <div className="mb-5">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>
            Trades
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>
            {activeProfile.name} - alle Trade-Eintrage im Uberblick
          </p>
        </div>

        <LivePositionsWidget />
        <JournalClient
          trades={trades}
          strategies={strategies}
          currency={activeProfile.currency}
          startCapital={activeProfile.startCapital}
          broker={activeProfile.broker}
          profiles={profiles}
          bots={bots}
        />
      </main>
    </div>
  )
}
