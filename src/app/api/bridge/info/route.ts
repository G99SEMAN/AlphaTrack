import { NextRequest, NextResponse } from 'next/server'
import { getProfiles } from '@/lib/profiles'

// Public discovery endpoint — allows the bridge to auto-configure itself.
// Returns the API key and available profiles so the bridge needs zero manual config.
// Acceptable for a private home-network deployment.
export async function GET(req: NextRequest) {
  const apiKey = process.env.BOT_API_KEY ?? ''
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000'
  const proto = req.headers.get('x-forwarded-proto') ?? 'http'
  const url = `${proto}://${host}`

  const profiles = getProfiles()
    .filter(p => !p.isDemo)
    .map(p => ({ id: p.id, name: p.name, currency: p.currency, broker: p.broker }))

  return NextResponse.json({ url, apiKey, profiles }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
