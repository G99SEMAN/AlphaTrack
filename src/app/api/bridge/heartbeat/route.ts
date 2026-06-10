import { NextRequest, NextResponse } from 'next/server'
import { saveBotStatus, addBridgeLogEntry, getBotById, getBotStatus, getBots } from '@/lib/bot-data'
import { getProfileTrades, saveProfileTrades } from '@/lib/profiles'
import { revalidatePath } from 'next/cache'
import { BotStatus } from '@/types/bot'
import { isValidApiKey } from '@/lib/auth'

function reconcileOpenTrades(profileId: string, openTicketIds: number[]): void {
  const trades = getProfileTrades(profileId)
  const ticketSet = new Set(openTicketIds.map(t => `pos_${t}`))
  let changed = false
  const updated = trades.map(t => {
    if (t.status === 'open' && t.externalId && !ticketSet.has(t.externalId)) {
      changed = true
      return {
        ...t,
        status: 'closed' as const,
        closeTime: new Date().toISOString(),
        notes: (t.notes ? t.notes + ' | ' : '') + '[Auto-geschlossen via Heartbeat-Reconciliation]',
      }
    }
    return t
  })
  if (changed) {
    saveProfileTrades(profileId, updated)
    revalidatePath('/dashboard')
    revalidatePath('/journal')
  }
}

export async function POST(req: NextRequest) {
  if (!isValidApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { bridgeId: string; status: BotStatus & { openTicketIds?: number[] }; profileId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { bridgeId, status } = body
  if (!bridgeId || !status || typeof status !== 'object') {
    return NextResponse.json({ error: 'Missing bridgeId or status' }, { status: 400 })
  }

  // Direct lookup first; fall back to URL-based lookup for old bridge versions
  // that send the bridge-internal UUID instead of the AlphaTrack ID
  let resolvedId = bridgeId
  if (!getBotById(bridgeId)) {
    const byUrl = getBots().find(b => b.url.includes(`/bot/${bridgeId}`))
    if (byUrl) {
      resolvedId = byUrl.id
    } else {
      return NextResponse.json({ error: 'Unknown bridgeId' }, { status: 404 })
    }
  }

  const prev = getBotStatus(resolvedId)
  saveBotStatus(resolvedId, { ...status, lastHeartbeat: new Date().toISOString() })

  if (body.profileId && Array.isArray(status.openTicketIds)) {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(body.profileId)) {
      addBridgeLogEntry(resolvedId, 'warn', 'Heartbeat: ungueltige profileId ignoriert', body.profileId)
    } else {
      reconcileOpenTrades(body.profileId, status.openTicketIds)
    }
  }

  const mt5WasConnected = prev?.mt5Connected ?? true
  const prevState = prev?.state ?? status.state

  if (!status.mt5Connected && mt5WasConnected && prev !== null) {
    addBridgeLogEntry(resolvedId, 'error', 'MT5-Verbindung unterbrochen!', `State: ${status.state}`)
  } else if (status.mt5Connected && !mt5WasConnected) {
    addBridgeLogEntry(resolvedId, 'info', 'MT5-Verbindung wiederhergestellt', `State: ${status.state}`)
  } else if (status.state !== prevState) {
    addBridgeLogEntry(resolvedId, 'info', `Bridge-Status geändert: ${prevState} → ${status.state}`)
  }

  return NextResponse.json({ ok: true })
}
