export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { Metadata } from 'next'
import Sidebar from '@/components/layout/Sidebar'
import KalenderClient from '@/components/wirtschaftskalender/KalenderClient'
import { getProfiles, getActiveProfile } from '@/lib/profiles'
import { fetchWirtschaftskalender } from '@/lib/wirtschaftskalender'
import { WirtschaftsEvent } from '@/types/wirtschaftskalender'

export const metadata: Metadata = { title: 'Wirtschaftskalender - AlphaTrack' }

export const revalidate = 1800

export default async function KalenderPage() {
  const profiles = getProfiles()
  if (profiles.length === 0) redirect('/setup')

  const activeProfile = getActiveProfile()
  if (!activeProfile) redirect('/setup')

  let initialEvents: WirtschaftsEvent[] = []
  let initialFetchedAt = new Date().toISOString()

  try {
    const data = await fetchWirtschaftskalender()
    initialEvents = data.events
    initialFetchedAt = data.fetchedAt
  } catch {
    // Client zeigt Fehler-State und kann selbst neu laden
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar profiles={profiles} activeProfile={activeProfile} />
      <main className="flex-1 min-w-0 p-4 md:p-6">
        <div className="mb-5">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>
            Wirtschaftskalender
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>
            Wichtige Termine und Wirtschaftsdaten - Diese &amp; Nächste Woche
          </p>
        </div>

        <KalenderClient
          initialEvents={initialEvents}
          initialFetchedAt={initialFetchedAt}
        />
      </main>
    </div>
  )
}
