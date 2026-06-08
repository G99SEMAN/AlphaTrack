import { NextRequest, NextResponse } from 'next/server'
import { getProfileTrades } from '@/lib/profiles'
import { Trade } from '@/types/trade'

interface DayStats {
  date: string
  totalPnl: number
  tradeCount: number
  wins: number
  losses: number
  trades: Trade[]
}

export async function GET(req: NextRequest) {
  const profileId = req.nextUrl.searchParams.get('profileId')
  const month = req.nextUrl.searchParams.get('month')

  if (!profileId || !/^[a-zA-Z0-9_-]{1,64}$/.test(profileId)) {
    return NextResponse.json({ error: 'Ungültige profileId' }, { status: 400 })
  }
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'Ungültiges month-Format (YYYY-MM)' }, { status: 400 })
  }

  const allTrades = getProfileTrades(profileId)
  const closedTrades = allTrades.filter(t => t.status === 'closed')

  const dayMap = new Map<string, DayStats>()

  for (const t of closedTrades) {
    const raw = t.closeTime || t.date
    if (!raw) continue
    const date = raw.slice(0, 10)
    if (!date.startsWith(month)) continue

    if (!dayMap.has(date)) {
      dayMap.set(date, { date, totalPnl: 0, tradeCount: 0, wins: 0, losses: 0, trades: [] })
    }
    const day = dayMap.get(date)!
    const pnl = t.pnl ?? 0
    day.totalPnl += pnl
    day.tradeCount++
    if (pnl > 0 || t.outcome === 'win') day.wins++
    else if (pnl < 0 || t.outcome === 'loss') day.losses++
    day.trades.push(t)
  }

  const days = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date))
  return NextResponse.json({ days, month })
}
