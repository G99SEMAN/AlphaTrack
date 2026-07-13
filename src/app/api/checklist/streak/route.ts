import { NextResponse } from 'next/server'
import { getActiveProfileId } from '@/lib/profiles'
import { getChecklistLog, calcChecklistStreak } from '@/lib/checklist'

export async function GET() {
  const profileId = getActiveProfileId()
  if (!profileId) return NextResponse.json({ streak: 0 })

  const log = getChecklistLog(profileId)
  return NextResponse.json({ streak: calcChecklistStreak(log) })
}
