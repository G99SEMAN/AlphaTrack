import { NextRequest, NextResponse } from 'next/server'
import { saveBotStatus, addBridgeLogEntry, getBotById, getBotStatus } from '@/lib/bot-data'
import { BotStatus } from '@/types/bot'
import { isValidApiKey } from '@/lib/auth'

export async function POST(req: NextRequest) {
  if (!isValidApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { bridgeId: string; status: BotStatus }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { bridgeId, status } = body
  if (!bridgeId || !status || typeof status !== 'object') {
    return NextResponse.json({ error: 'Missing bridgeId or status' }, { status: 400 })
  }

  if (!getBotById(bridgeId)) {
    return NextResponse.json({ error: 'Unknown bridgeId' }, { status: 404 })
  }

  const prev = getBotStatus(bridgeId)
  saveBotStatus(bridgeId, { ...status, lastHeartbeat: new Date().toISOString() })

  const mt5WasConnected = prev?.mt5Connected ?? true
  const prevState = prev?.state ?? status.state

  if (!status.mt5Connected && mt5WasConnected) {
    addBridgeLogEntry(bridgeId, 'error', 'MT5-Verbindung unterbrochen!', `State: ${status.state}`)
  } else if (status.mt5Connected && !mt5WasConnected) {
    addBridgeLogEntry(bridgeId, 'info', 'MT5-Verbindung wiederhergestellt', `State: ${status.state}`)
  } else if (status.state !== prevState) {
    addBridgeLogEntry(bridgeId, 'info', `Bridge-Status geändert: ${prevState} → ${status.state}`)
  }

  return NextResponse.json({ ok: true })
}
