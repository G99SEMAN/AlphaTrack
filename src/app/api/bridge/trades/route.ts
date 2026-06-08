import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getBotTrades, saveBotTrades, addBridgeLogEntry, getBotById, getBots } from '@/lib/bot-data'
import { getProfileTrades, saveProfileTrades, getProfiles } from '@/lib/profiles'
import { Trade } from '@/types/trade'
import { nanoid } from 'nanoid'
import { isValidApiKey } from '@/lib/auth'

function syncBridgeTradesToProfile(profileId: string, bridgeTrades: Trade[]): boolean {
  const profileTrades = getProfileTrades(profileId)
  const profileMap = new Map(
    profileTrades.filter(t => t.externalId).map(t => [t.externalId!, t])
  )

  let changed = false
  const updated = [...profileTrades]

  for (const bt of bridgeTrades) {
    if (!bt.externalId) continue
    const existing = profileMap.get(bt.externalId)
    if (!existing) {
      updated.push(bt)
      changed = true
    } else if (existing.status === 'open' && bt.status === 'closed') {
      const idx = updated.findIndex(t => t.externalId === bt.externalId)
      if (idx !== -1) { updated[idx] = { ...existing, ...bt, id: existing.id }; changed = true }
    }
  }

  if (changed) saveProfileTrades(profileId, updated)
  return changed
}

export async function GET(req: NextRequest) {
  const profileId = req.nextUrl.searchParams.get('profileId')
  if (!profileId) return NextResponse.json({ error: 'Missing profileId' }, { status: 400 })
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(profileId)) {
    return NextResponse.json({ error: 'Invalid profileId' }, { status: 400 })
  }
  return NextResponse.json({ trades: getBotTrades(profileId) })
}

// Normalize a raw trade payload to a typed Trade, resolving bot_id attribution.
// Python sends snake_case bot_id; TypeScript stores as botId.
// Trades with no bot attribution (bridge sync) receive botId: null (C4).
function normalizeTrade(raw: Record<string, unknown>): Omit<Trade, 'id'> {
  const { bot_id, botId, ...rest } = raw as Record<string, unknown> & { bot_id?: string | null; botId?: string | null }
  const resolvedBotId = botId ?? bot_id ?? null
  return { ...rest, botId: resolvedBotId } as unknown as Omit<Trade, 'id'>
}

export async function POST(req: NextRequest) {
  if (!isValidApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { bridgeId: string; profileId: string; trades: Record<string, unknown>[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { bridgeId, profileId, trades: rawTrades } = body
  if (!bridgeId || !profileId || !Array.isArray(rawTrades)) {
    return NextResponse.json({ error: 'Missing bridgeId, profileId or trades' }, { status: 400 })
  }

  if (rawTrades.length > 1000) {
    return NextResponse.json({ error: 'Zu viele Trades (max. 1000 pro Request)' }, { status: 400 })
  }

  let resolvedBridgeId = bridgeId
  if (!getBotById(bridgeId)) {
    const byUrl = getBots().find(b => b.url.includes(`/bot/${bridgeId}`))
    if (byUrl) {
      resolvedBridgeId = byUrl.id
    } else {
      return NextResponse.json({ error: 'Unknown bridgeId' }, { status: 404 })
    }
  }

  const profiles = getProfiles()
  if (!profiles.find(p => p.id === profileId)) {
    addBridgeLogEntry(resolvedBridgeId, 'warn', `Profil-ID nicht gefunden: ${profileId}`, 'Bitte Bridge-Profil in den Einstellungen korrigieren')
    return NextResponse.json({ error: `Unbekannte profileId: ${profileId}. Profil in Bridge-Einstellungen korrigieren.` }, { status: 422 })
  }

  // Normalize incoming trades: resolve bot attribution (C4)
  const trades = rawTrades.map(normalizeTrade)

  const existing = getBotTrades(profileId)
  const existingMap = new Map(
    existing.filter(t => t.externalId).map(t => [t.externalId!, t])
  )
  // Secondary dedup for trades without externalId: instrument+date+size key
  const syntheticKeys = new Set(
    existing.filter(t => !t.externalId).map(t => `${t.instrument}_${t.date}_${t.size}`)
  )

  const newTrades: Trade[] = []
  let updatedCount = 0
  const merged = [...existing]

  for (const t of trades) {
    const externalId = t.externalId
    if (!externalId) {
      const key = `${t.instrument}_${t.date}_${t.size}`
      if (!syntheticKeys.has(key)) {
        newTrades.push({ ...t, id: nanoid(10) } as Trade)
        syntheticKeys.add(key)
      }
      continue
    }

    const prev = existingMap.get(externalId)
    if (!prev) {
      newTrades.push({ ...t, id: nanoid(10) } as Trade)
      continue
    }

    if (prev.status === 'open' && t.status === 'closed') {
      const idx = merged.findIndex(x => x.externalId === externalId)
      if (idx !== -1) {
        merged[idx] = { ...prev, ...t, id: prev.id }
        updatedCount++
      }
    }
  }

  const total = newTrades.length + updatedCount
  const bridgeTradesFinal = [...merged, ...newTrades]

  if (total > 0) {
    saveBotTrades(profileId, bridgeTradesFinal)
    addBridgeLogEntry(resolvedBridgeId, 'info', `${newTrades.length} neue, ${updatedCount} aktualisierte Trade(s)`, `Profil: ${profileId}`)
  }

  // Immer reconcile: Falls bot-trades bereits 'closed' aber profile-trades noch 'open',
  // würde total=0 und der Abgleich nie stattfinden → dauerhaft falsche Anzeige.
  const profileChanged = syncBridgeTradesToProfile(profileId, bridgeTradesFinal)
  if (profileChanged) {
    revalidatePath('/dashboard')
    revalidatePath('/journal')
    revalidatePath('/statistiken')
  }

  return NextResponse.json({ ok: true, synced: total })
}
