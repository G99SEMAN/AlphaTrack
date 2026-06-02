import { NextRequest, NextResponse } from 'next/server'
import { getBridgeLog, getBotById } from '@/lib/bot-data'
import { isValidApiKey } from '@/lib/auth'

export async function GET(req: NextRequest) {
  if (!isValidApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const bridgeId = req.nextUrl.searchParams.get('bridgeId')
  if (!bridgeId) return NextResponse.json({ error: 'Missing bridgeId' }, { status: 400 })
  if (!getBotById(bridgeId)) return NextResponse.json({ error: 'Unknown bridgeId' }, { status: 404 })
  const log = getBridgeLog(bridgeId)
  return NextResponse.json({ count: log.length })
}
