import { NextRequest, NextResponse } from 'next/server'
import { saveBotStatus, addBridgeLogEntry, getBotById, getBotStatus, getBots, saveBotPositions } from '@/lib/bot-data'
import { getProfileTrades, saveProfileTrades, getProfiles, updateProfile } from '@/lib/profiles'
import { revalidatePath } from 'next/cache'
import { BotStatus, LivePosition } from '@/types/bot'
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
        // P&L, Commission, Swap, Exit und CloseTime werden NICHT gesetzt —
        // der Trade-Sync liefert die korrekten MT5-Werte nach und korrigiert
        // über den closed→closed Update-Pfad.
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

  let body: { bridgeId: string; status: BotStatus & { openTicketIds?: number[]; positions?: LivePosition[] }; profileId?: string }
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

  if (Array.isArray(status.positions)) {
    saveBotPositions(resolvedId, status.positions)
  }

  if (body.profileId && Array.isArray(status.openTicketIds)) {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(body.profileId)) {
      addBridgeLogEntry(resolvedId, 'warn', 'Heartbeat: ungueltige profileId ignoriert', body.profileId)
    } else {
      reconcileOpenTrades(body.profileId, status.openTicketIds)
    }
  }

  // Auto-Startkapital: bei erster Verbindung Kontostand aus Bridge holen
  if (body.profileId && /^[a-zA-Z0-9_-]{1,64}$/.test(body.profileId)) {
    const profiles = getProfiles()
    const profile = profiles.find(p => p.id === body.profileId)
    if (profile && profile.startCapital === 0) {
      const bridge = getBotById(resolvedId)
      if (bridge) {
        try {
          const accountRes = await fetch(`${bridge.url}/account`, {
            signal: AbortSignal.timeout(5000),
          })
          if (accountRes.ok) {
            const account = await accountRes.json() as Record<string, unknown>
            const balance = account?.balance
            if (typeof balance === 'number' && balance > 0) {
              updateProfile({ ...profile, startCapital: balance })
              addBridgeLogEntry(
                resolvedId,
                'info',
                `Startkapital automatisch gesetzt: ${balance} ${profile.currency}`,
              )
            }
          }
        } catch {
          // Nächster Heartbeat versucht es erneut
        }
      }
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
