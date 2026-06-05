import { NextRequest, NextResponse } from 'next/server'
import { getProfiles } from '@/lib/profiles'

// Public discovery endpoint — returns the server URL and available profiles.
// The API key must be configured manually in the bridge; it is never returned here.
export async function GET(req: NextRequest) {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000'
  const proto = req.headers.get('x-forwarded-proto') ?? 'http'
  const url = `${proto}://${host}`

  const profiles = getProfiles()
    .filter(p => !p.isDemo)
    .map(p => ({ id: p.id, name: p.name, currency: p.currency, broker: p.broker }))

  return NextResponse.json({ url, profiles }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
