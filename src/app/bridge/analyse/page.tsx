import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import AnalyseClient from '@/components/analyse/AnalyseClient'
import { getProfiles, getActiveProfile, setActiveProfileId } from '@/lib/profiles'
import { getBots } from '@/lib/bot-data'

export default async function BridgeAnalysePage() {
  const profiles = getProfiles()
  if (profiles.length === 0) redirect('/setup')

  let activeProfile = getActiveProfile()
  if (!activeProfile) {
    setActiveProfileId(profiles[0].id)
    activeProfile = profiles[0]
  }

  const bots = getBots()

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar profiles={profiles} activeProfile={activeProfile} />
      <main className="flex-1 min-w-0 p-4 md:p-6">
        <div className="mb-5">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Trade Analyzer</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>
            EUR/USD - KI-Analyse mit direkter Bot-Ausführung
          </p>
        </div>
        <AnalyseClient bots={bots} />
      </main>
    </div>
  )
}
