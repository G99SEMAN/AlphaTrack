export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PauseCircle } from 'lucide-react'
import Sidebar from '@/components/layout/Sidebar'
import { getProfiles, getActiveProfile, setActiveProfileId } from '@/lib/profiles'
import { getTranslations } from 'next-intl/server'

// Trade Analyzer ist vorübergehend pausiert (nicht benötigt) — Seite bleibt bestehen,
// AnalyseClient wird bewusst nicht mehr gerendert, bis die Arbeit daran fortgesetzt wird.
export default async function BridgeAnalysePage() {
  const profiles = getProfiles()
  if (profiles.length === 0) redirect('/setup')

  let activeProfile = getActiveProfile()
  if (!activeProfile) {
    setActiveProfileId(profiles[0].id)
    activeProfile = profiles[0]
  }

  const t = await getTranslations('analyse.paused')

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar profiles={profiles} activeProfile={activeProfile} />
      <main className="flex-1 min-w-0 p-4 md:p-6 flex items-center justify-center">
        <div
          className="flex flex-col items-center text-center gap-3 rounded-2xl p-8 max-w-sm"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <PauseCircle size={32} style={{ color: 'var(--text-3)' }} />
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-1)' }}>{t('title')}</h1>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>{t('message')}</p>
          <Link
            href="/dashboard"
            className="mt-2 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {t('backButton')}
          </Link>
        </div>
      </main>
    </div>
  )
}
