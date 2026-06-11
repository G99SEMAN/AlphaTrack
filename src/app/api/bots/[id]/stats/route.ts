import { NextRequest, NextResponse } from 'next/server'
import { getBotById } from '@/lib/bot-data'
import { getProfileTrades, getProfiles } from '@/lib/profiles'
import { BotStats } from '@/types/bot'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const bot = getBotById(id)
  if (!bot) {
    return NextResponse.json({ error: 'Bot nicht gefunden' }, { status: 404 })
  }

  const trades = getProfileTrades(bot.profileId)
  const botTrades = trades.filter(t => t.sourceId === id)

  const openCount = botTrades.filter(t => t.status === 'open').length
  const tradeCount = botTrades.length

  const closedWithPnl = botTrades.filter(t => t.status === 'closed' && t.pnl !== undefined)
  const realizedPnl: number | null = closedWithPnl.length > 0
    ? closedWithPnl.reduce((sum, t) => sum + (t.pnl ?? 0), 0)
    : null

  const profile = getProfiles().find(p => p.id === bot.profileId)
  const currency = profile?.currency ?? 'EUR'

  const stats: BotStats = { openCount, tradeCount, realizedPnl, currency }
  return NextResponse.json(stats)
}
