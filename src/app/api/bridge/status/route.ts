import { NextRequest, NextResponse } from 'next/server'
import { getBotStatusWithConnection, getAllBotsWithStatus } from '@/lib/bot-data'

export async function GET(req: NextRequest) {
  const bridgeId = req.nextUrl.searchParams.get('bridgeId')

  if (bridgeId) {
    const status = getBotStatusWithConnection(bridgeId)
    return NextResponse.json(
      { connectionState: status?.connectionState ?? 'offline', status: status ?? null },
      { headers: { 'Cache-Control': 'private, max-age=5' } },
    )
  }

  const bots = getAllBotsWithStatus()
  return NextResponse.json({ bots }, {
    headers: { 'Cache-Control': 'private, max-age=5' },
  })
}
