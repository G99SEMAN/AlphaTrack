import { NextResponse } from 'next/server'
import { getActiveProfile, getProfileTrades } from '@/lib/profiles'
import { getProfileStrategies } from '@/lib/strategies'
import { getBots } from '@/lib/bot-data'
import { buildTradeCsv } from '@/lib/trade-export-csv'

export async function POST(req: Request) {
  try {
    const body = await req.json() as { format?: string; tradeIds?: string[]; year?: number | 'all' }
    const { format, tradeIds } = body

    if (format !== 'csv' && format !== 'pdf') {
      return NextResponse.json({ error: 'Ungültiges Format' }, { status: 400 })
    }
    if (!Array.isArray(tradeIds) || tradeIds.length === 0) {
      return NextResponse.json({ error: 'Keine Trades ausgewählt' }, { status: 400 })
    }

    const profile = getActiveProfile()
    if (!profile) {
      return NextResponse.json({ error: 'Kein aktives Profil' }, { status: 400 })
    }

    const idSet = new Set(tradeIds)
    const trades = getProfileTrades(profile.id).filter(t => idSet.has(t.id))
    if (trades.length === 0) {
      return NextResponse.json({ error: 'Keine passenden Trades gefunden' }, { status: 404 })
    }

    const date = new Date().toISOString().slice(0, 10)

    if (format === 'csv') {
      const strategies = getProfileStrategies(profile.id)
      const bots = getBots().filter(bot => bot.type === 'bot')
      const csv = buildTradeCsv(trades, bots, strategies)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="alphatrack-trades-${date}.csv"`,
        },
      })
    }

    // PDF-Pfad folgt in Task 2
    return NextResponse.json({ error: 'PDF-Export noch nicht verfügbar' }, { status: 501 })
  } catch (err) {
    console.error('Export-Fehler:', err)
    return NextResponse.json({ error: 'Export fehlgeschlagen' }, { status: 500 })
  }
}
