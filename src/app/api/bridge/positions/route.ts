import { NextRequest, NextResponse } from 'next/server'
import { getBotById, getBotPositions } from '@/lib/bot-data'

export async function GET(req: NextRequest) {
  const bridgeId = req.nextUrl.searchParams.get('bridgeId')
  if (!bridgeId) return NextResponse.json({ error: 'Missing bridgeId' }, { status: 400 })

  const bridge = getBotById(bridgeId)
  if (!bridge) return NextResponse.json({ error: 'Unknown bridgeId' }, { status: 404 })

  // Primary: positions pushed via heartbeat and cached server-side
  const cached = getBotPositions(bridgeId)
  if (cached.length > 0) {
    return NextResponse.json({ positions: cached })
  }

  // Fallback: direct fetch from bridge HTTP (may fail in some network setups)
  try {
    const res = await fetch(`${bridge.url}/positions`, {
      signal: AbortSignal.timeout(4000),
      cache: 'no-store',
    })
    if (!res.ok) return NextResponse.json({ positions: [] })
    const data = await res.json()
    return NextResponse.json({ positions: data.positions ?? [] })
  } catch {
    return NextResponse.json({ positions: [] })
  }
}
