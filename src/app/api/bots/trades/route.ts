import { NextRequest, NextResponse } from 'next/server'
import { getProfileTrades } from '@/lib/profiles'

export async function GET(req: NextRequest) {
  const profileId = req.nextUrl.searchParams.get('profileId')
  if (!profileId) return NextResponse.json({ error: 'Missing profileId' }, { status: 400 })
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(profileId)) {
    return NextResponse.json({ error: 'Invalid profileId' }, { status: 400 })
  }
  return NextResponse.json({ trades: getProfileTrades(profileId).filter(t => t.sourceId) })
}
