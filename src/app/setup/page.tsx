export const dynamic = 'force-dynamic'

import { getProfiles } from '@/lib/profiles'
import { ensureSeedData } from '@/lib/seed'
import { redirect } from 'next/navigation'
import ProfileSetupForm from '@/components/profile/ProfileSetupForm'
import LogoMark from '@/components/layout/LogoMark'

export default function SetupPage() {
  ensureSeedData()
  const profiles = getProfiles()

  if (profiles.length > 0) redirect('/dashboard')

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: 'var(--bg)' }}
    >
      <div className="flex flex-col items-center gap-3 mb-10">
        <LogoMark size={64} />
        <div className="text-center">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>
            Willkommen bei <span style={{ color: '#06d6a0' }}>AlphaTrack</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>
            Erstelle dein erstes Profil um loszulegen
          </p>
        </div>
      </div>

      <ProfileSetupForm isFirstProfile />
    </div>
  )
}
