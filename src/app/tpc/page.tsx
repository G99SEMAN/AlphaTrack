import { redirect } from 'next/navigation'
import { Metadata } from 'next'
import Sidebar from '@/components/layout/Sidebar'
import DemoBanner from '@/components/layout/DemoBanner'
import { getProfiles, getActiveProfile } from '@/lib/profiles'
import TpcClient from './TpcClient'

export const metadata: Metadata = { title: 'Trading Performance Kalender - AlphaTrack' }

export default async function TpcPage() {
  const profiles = getProfiles()
  if (profiles.length === 0) redirect('/setup')

  const activeProfile = getActiveProfile()
  if (!activeProfile) redirect('/setup')

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar profiles={profiles} activeProfile={activeProfile} />
      <main className="flex-1 min-w-0 p-4 md:p-6">
        {activeProfile.isDemo && <DemoBanner />}
        <TpcClient profileId={activeProfile.id} />
      </main>
    </div>
  )
}
