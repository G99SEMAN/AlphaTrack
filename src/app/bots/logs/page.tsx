import { getProfiles, getActiveProfile } from '@/lib/profiles'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import { ScrollText } from 'lucide-react'

export default async function BotsLogsPage() {
  const profiles = getProfiles()
  if (profiles.length === 0) redirect('/setup')

  const activeProfile = getActiveProfile()
  if (!activeProfile) redirect('/setup')

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar profiles={profiles} activeProfile={activeProfile} />
      <main className="flex-1 p-4 md:p-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Bot Log</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>
            Bot-spezifische Aktivitätsprotokolle
          </p>
        </div>
        <div className="rounded-2xl p-12 flex flex-col items-center text-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(96,165,250,0.1)' }}>
            <ScrollText size={24} style={{ color: '#60a5fa' }} />
          </div>
          <h3 className="font-semibold text-base mb-2" style={{ color: 'var(--text-1)' }}>
            Bot Log — demnächst verfügbar
          </h3>
          <p className="text-sm max-w-sm" style={{ color: 'var(--text-3)' }}>
            Sobald ein Bot verbunden ist, werden hier bot-spezifische Logs angezeigt.
          </p>
        </div>
      </main>
    </div>
  )
}
