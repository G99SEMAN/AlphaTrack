import { getProfiles, getActiveProfile } from '@/lib/profiles'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import NetzwerkClient from './NetzwerkClient'

export default async function NetzwerkPage() {
  const profiles = getProfiles()
  if (profiles.length === 0) redirect('/setup')

  const activeProfile = getActiveProfile()
  if (!activeProfile) redirect('/setup')

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar profiles={profiles} activeProfile={activeProfile} />
      <NetzwerkClient />
    </div>
  )
}
