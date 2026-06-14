import { redirect } from 'next/navigation'
import { Metadata } from 'next'
import Sidebar from '@/components/layout/Sidebar'
import { getProfiles, getActiveProfile } from '@/lib/profiles'
import { getAllBotsWithStatus } from '@/lib/bot-data'
import BotPerformanceClient from './BotPerformanceClient'

export const metadata: Metadata = { title: 'Bot Performance - AlphaTrack' }

export default async function BotPerformancePage() {
  const profiles = getProfiles()
  if (profiles.length === 0) redirect('/setup')

  const activeProfile = getActiveProfile()
  if (!activeProfile) redirect('/setup')

  const botsWithStatus = getAllBotsWithStatus()

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar profiles={profiles} activeProfile={activeProfile} />
      <main className="flex-1 min-w-0 p-4 md:p-6">
        <BotPerformanceClient botsWithStatus={botsWithStatus} profileId={activeProfile.id} />
      </main>
    </div>
  )
}
