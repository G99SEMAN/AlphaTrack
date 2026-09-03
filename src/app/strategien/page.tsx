export const dynamic = 'force-dynamic'

import { getProfiles, getActiveProfile, getProfileTrades } from '@/lib/profiles'
import { getProfileStrategies } from '@/lib/strategies'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import StrategiesClient from '@/components/strategien/StrategiesClient'
import { getTranslations } from 'next-intl/server'

export default async function StrategienPage() {
  const profiles = getProfiles()
  if (profiles.length === 0) redirect('/setup')
  const activeProfile = getActiveProfile()
  if (!activeProfile) redirect('/setup')

  const strategies = getProfileStrategies(activeProfile.id)
  const trades = getProfileTrades(activeProfile.id)
  const t = await getTranslations('strategien.page')

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar profiles={profiles} activeProfile={activeProfile} />
      <main className="flex-1 p-4 md:p-6 max-w-full overflow-hidden">
        <div className="mb-5">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>
            {t('title')}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>
            {t('subtitle', { name: activeProfile.name })}
          </p>
        </div>

        <StrategiesClient
          strategies={strategies}
          trades={trades}
          currency={activeProfile.currency}
        />
      </main>
    </div>
  )
}
