export const dynamic = 'force-dynamic'

import { getProfiles, getActiveProfile } from '@/lib/profiles'
import { getChecklistConfig, getChecklistLog, calcChecklistStreak, calcChecklistLifetime } from '@/lib/checklist'
import { DEFAULT_CHECKLIST_ITEMS } from '@/types/checklist'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import ChecklistClient from '@/components/checklist/ChecklistClient'

export default function ChecklistPage() {
  const profiles = getProfiles()
  if (profiles.length === 0) redirect('/setup')
  const activeProfile = getActiveProfile()
  if (!activeProfile) redirect('/setup')

  const config = getChecklistConfig(activeProfile.id)
  const log = getChecklistLog(activeProfile.id)
  const streak = calcChecklistStreak(log)
  const lifetime = calcChecklistLifetime(log)

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar profiles={profiles} activeProfile={activeProfile} />
      <main className="flex-1 p-4 md:p-6 max-w-full overflow-hidden">
        <div className="mb-5">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>
            Daily Checklist
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>
            {activeProfile.name} - Tägliche Selbstreflexion
          </p>
        </div>

        <ChecklistClient
          config={config}
          log={log}
          streak={streak}
          lifetime={lifetime}
          defaultItems={DEFAULT_CHECKLIST_ITEMS}
        />
      </main>
    </div>
  )
}
