import { NextRequest, NextResponse } from 'next/server'
import { getProfiles, createProfile } from '@/lib/profiles'
import { isValidApiKey } from '@/lib/auth'
import { nanoid } from 'nanoid'
import type { Profile } from '@/types/profile'
import { PROFILE_COLORS } from '@/types/profile'

export async function GET() {
  const profiles = getProfiles()
    .map(p => ({ id: p.id, name: p.name, broker: p.broker, type: p.type, currency: p.currency }))
  return NextResponse.json({ profiles })
}

export async function POST(req: NextRequest) {
  if (!isValidApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
  }

  const name = (String(body.name ?? '')).trim()
  if (!name) {
    return NextResponse.json({ error: 'name fehlt' }, { status: 400 })
  }

  const profile: Profile = {
    id: nanoid(),
    name,
    type: body.type === 'live' ? 'live' : 'demo',
    broker: String(body.broker ?? ''),
    startCapital: Number(body.startCapital) || 0,
    currency: (['EUR', 'USD', 'GBP', 'CHF', 'USDT'].includes(String(body.currency))
      ? String(body.currency) : 'USD') as Profile['currency'],
    color: PROFILE_COLORS[0],
    createdAt: new Date().toISOString(),
  }

  createProfile(profile)
  return NextResponse.json({ id: profile.id, name: profile.name }, { status: 201 })
}
