import { getProfiles, getActiveProfile } from '@/lib/profiles'
import { getAllBotsWithStatus } from '@/lib/bot-data'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import BotsSettingsClient from './BotsSettingsClient'

export default async function BotsSettingsPage() {
  const profiles = getProfiles()
  if (profiles.length === 0) redirect('/setup')

  const activeProfile = getActiveProfile()
  if (!activeProfile) redirect('/setup')

  const botsWithStatus = getAllBotsWithStatus()

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar profiles={profiles} activeProfile={activeProfile} />
      <BotsSettingsClient initialBots={botsWithStatus} profiles={profiles} />
    </div>
  )
}
