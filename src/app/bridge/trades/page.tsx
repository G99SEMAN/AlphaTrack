import { getProfiles, getActiveProfile, setActiveProfileId } from '@/lib/profiles'
import { getBots } from '@/lib/bot-data'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import BridgeTradesClient from './BridgeTradesClient'

export default async function BridgeTradesPage() {
  const allProfiles = getProfiles()
  if (allProfiles.length === 0) redirect('/setup')

  const profiles = allProfiles.filter(p => !p.isDemo)
  if (profiles.length === 0) redirect('/setup')

  let activeProfile = getActiveProfile()
  if (!activeProfile || activeProfile.isDemo) {
    setActiveProfileId(profiles[0].id)
    activeProfile = profiles[0]
  }

  const bots = getBots()

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar profiles={profiles} activeProfile={activeProfile} />
      <BridgeTradesClient bots={bots} />
    </div>
  )
}
