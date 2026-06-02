import { NextRequest, NextResponse } from 'next/server'
import { getBridgeLog, clearBridgeLog } from '@/lib/bot-data'

export async function GET(req: NextRequest) {
  const bridgeId = req.nextUrl.searchParams.get('bridgeId')
  if (!bridgeId) return NextResponse.json({ error: 'Missing bridgeId' }, { status: 400 })
  return NextResponse.json({ log: getBridgeLog(bridgeId) })
}

export async function DELETE(req: NextRequest) {
  const bridgeId = req.nextUrl.searchParams.get('bridgeId')
  if (!bridgeId) return NextResponse.json({ error: 'Missing bridgeId' }, { status: 400 })
  clearBridgeLog(bridgeId)
  return NextResponse.json({ success: true })
}
