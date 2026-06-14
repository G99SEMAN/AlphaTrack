export const dynamic = 'force-dynamic'

import { getProfiles, getActiveProfile, setActiveProfileId } from '@/lib/profiles'
import Sidebar from '@/components/layout/Sidebar'
import EinstellungenClient from '@/components/einstellungen/EinstellungenClient'

export default function EinstellungenPage() {
  const profiles = getProfiles()
  let activeProfile = getActiveProfile()
  if (!activeProfile && profiles.length > 0) {
    setActiveProfileId(profiles[0].id)
    activeProfile = profiles[0]
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar profiles={profiles} activeProfile={activeProfile} />
      <main className="flex-1 min-w-0 p-4 md:p-6 max-w-full overflow-hidden">
        <div className="mb-6">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Einstellungen</h1>
        </div>
        <EinstellungenClient profiles={profiles} activeProfile={activeProfile} />
      </main>
    </div>
  )
}
