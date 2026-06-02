import { NextResponse } from 'next/server'
import { getActiveProfile, getProfileTrades } from '@/lib/profiles'

export async function GET() {
  const profile = getActiveProfile()
  if (!profile) return NextResponse.json({ trades: [] })
  const trades = getProfileTrades(profile.id)
  return NextResponse.json({ trades })
}
