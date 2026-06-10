import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { addBridgeLogEntry } from '@/lib/bot-data'
import { getProfileTrades, saveProfileTrades } from '@/lib/profiles'
import { isValidApiKey } from '@/lib/auth'

export async function POST(req: NextRequest) {
  if (!isValidApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    bridgeId: string
    profileId: string
    ticket: number
    exitPrice: number
    closeTime: string
    pnl?: number
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { bridgeId, profileId, ticket, exitPrice, closeTime, pnl } = body
  if (!bridgeId || !profileId || ticket == null || exitPrice == null || !closeTime) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(profileId)) {
    return NextResponse.json({ error: 'Invalid profileId' }, { status: 400 })
  }

  const externalId = `pos_${ticket}`
  const trades = getProfileTrades(profileId)
  const idx = trades.findIndex(t => t.externalId === externalId && t.status === 'open')

  if (idx === -1) {
    return NextResponse.json({ ok: true, updated: false })
  }

  const updated = [...trades]
  updated[idx] = {
    ...updated[idx],
    status: 'closed',
    exit: exitPrice,
    closeTime,
    ...(pnl !== undefined && { pnl }),
  }

  saveProfileTrades(profileId, updated)
  addBridgeLogEntry(bridgeId, 'info', `Trade geschlossen: pos_${ticket}`, `exitPrice: ${exitPrice}`)
  revalidatePath('/dashboard')
  revalidatePath('/journal')
  revalidatePath('/statistiken')

  return NextResponse.json({ ok: true, updated: true })
}
