import { getProfiles, getActiveProfile, setActiveProfileId } from '@/lib/profiles'
import { getAllBotsWithStatus, getBotTrades } from '@/lib/bot-data'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import BridgeClient from './BridgeClient'

export default async function BridgePage() {
  const allProfiles = getProfiles()
  if (allProfiles.length === 0) redirect('/setup')

  const profiles = allProfiles.filter(p => !p.isDemo)
  if (profiles.length === 0) redirect('/setup')

  let activeProfile = getActiveProfile()
  if (!activeProfile || activeProfile.isDemo) {
    setActiveProfileId(profiles[0].id)
    activeProfile = profiles[0]
  }

  const botsWithStatus = getAllBotsWithStatus()

  const tradesByProfile: Record<string, number> = {}
  for (const profile of profiles) {
    tradesByProfile[profile.id] = getBotTrades(profile.id).length
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar profiles={profiles} activeProfile={activeProfile} />
      <BridgeClient
        botsWithStatus={botsWithStatus}
        profiles={profiles}
        tradesByProfile={tradesByProfile}
      />
    </div>
  )
}
