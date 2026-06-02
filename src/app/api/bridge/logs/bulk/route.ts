import { NextRequest, NextResponse } from 'next/server'
import { getBotById, bulkAddBridgeLogEntries } from '@/lib/bot-data'
import { BridgeLogEntry } from '@/types/bot'
import { isValidApiKey } from '@/lib/auth'

export async function POST(req: NextRequest) {
  if (!isValidApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { bridgeId: string; entries: BridgeLogEntry[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { bridgeId, entries } = body
  if (!bridgeId || !Array.isArray(entries)) {
    return NextResponse.json({ error: 'Missing bridgeId or entries' }, { status: 400 })
  }
  if (!getBotById(bridgeId)) {
    return NextResponse.json({ error: 'Unknown bridgeId' }, { status: 404 })
  }

  bulkAddBridgeLogEntries(bridgeId, entries)
  return NextResponse.json({ ok: true, added: entries.length })
}
