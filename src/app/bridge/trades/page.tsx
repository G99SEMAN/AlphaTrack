import { getProfiles, getActiveProfile, setActiveProfileId } from '@/lib/profiles'
import { getAllBotsWithStatus } from '@/lib/bot-data'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import BridgeTradesClient from './BridgeTradesClient'

export default async function BridgeTradesPage() {
  const profiles = getProfiles()
  if (profiles.length === 0) redirect('/setup')

  let activeProfile = getActiveProfile()
  if (!activeProfile) {
    setActiveProfileId(profiles[0].id)
    activeProfile = profiles[0]
  }

  const bots = getAllBotsWithStatus()
    .filter(({ status }) => status?.connectionState === 'connected' || status?.connectionState === 'warning')
    .map(({ bot }) => bot)

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar profiles={profiles} activeProfile={activeProfile} />
      <BridgeTradesClient bots={bots} />
    </div>
  )
}
