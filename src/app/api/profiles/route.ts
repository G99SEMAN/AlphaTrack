import { NextResponse } from 'next/server'
import { getProfiles } from '@/lib/profiles'

export async function GET() {
  const profiles = getProfiles()
    .filter(p => !p.isDemo)
    .map(p => ({ id: p.id, name: p.name, broker: p.broker, type: p.type, currency: p.currency }))
  return NextResponse.json({ profiles })
}
