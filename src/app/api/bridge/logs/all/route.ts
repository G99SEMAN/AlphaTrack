import { NextResponse } from 'next/server'
import { getBots, getBridgeLog } from '@/lib/bot-data'

const MAX_ENTRIES = 300

export async function GET() {
  const bots = getBots()
  const allLogs = bots.flatMap(bot => getBridgeLog(bot.id))
  allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  return NextResponse.json({ logs: allLogs.slice(0, MAX_ENTRIES) })
}
