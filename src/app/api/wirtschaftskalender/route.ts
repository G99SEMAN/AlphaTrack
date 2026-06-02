import { NextResponse } from 'next/server'
import { fetchWirtschaftskalender, fetchWirtschaftskalenderFromBridge } from '@/lib/wirtschaftskalender'
import { getBots } from '@/lib/bot-data'

export const dynamic = 'force-dynamic'

export async function GET() {
  // Bridge zuerst probieren - nur wenn Events zurückkommen
  const bots = getBots()
  for (const bot of bots) {
    try {
      const data = await fetchWirtschaftskalenderFromBridge(bot.url)
      if (data.events.length > 0) {
        return NextResponse.json({ ...data, source: 'bridge' }, {
          headers: { 'Cache-Control': 'no-store' },
        })
      }
    } catch {
      // nächsten Bot oder Fallback versuchen
    }
  }

  // Fallback: Tradays
  try {
    const data = await fetchWirtschaftskalender()
    return NextResponse.json({ ...data, source: 'tradays' }, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    })
  } catch {
    return NextResponse.json({ events: [], fetchedAt: new Date().toISOString(), source: 'error' }, { status: 500 })
  }
}
