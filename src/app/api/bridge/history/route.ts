import { NextRequest, NextResponse } from 'next/server'
import { getBotById } from '@/lib/bot-data'

export async function GET(req: NextRequest) {
  const bridgeId = req.nextUrl.searchParams.get('bridgeId')
  if (!bridgeId) return NextResponse.json({ error: 'Missing bridgeId' }, { status: 400 })

  const bridge = getBotById(bridgeId)
  if (!bridge) return NextResponse.json({ error: 'Unknown bridgeId' }, { status: 404 })

  try {
    const [historyRes, accountRes] = await Promise.all([
      fetch(`${bridge.url}/history`, { signal: AbortSignal.timeout(30_000) }),
      fetch(`${bridge.url}/account`, { signal: AbortSignal.timeout(10_000) }),
    ])

    const history = historyRes.ok ? await historyRes.json() : { deals: [], count: 0 }
    const account = accountRes.ok ? await accountRes.json() : null

    return NextResponse.json({ deals: history.deals ?? [], count: history.count ?? 0, account })
  } catch {
    return NextResponse.json({ error: 'Bridge nicht erreichbar' }, { status: 503 })
  }
}
