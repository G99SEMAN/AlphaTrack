import { NextRequest, NextResponse } from 'next/server'
import { getBotCommands, acknowledgeBotCommand, pruneOldCommands, getBotById } from '@/lib/bot-data'
import { isSameOriginRequest } from '@/lib/auth'

function isAuthorized(req: NextRequest): boolean {
  if (isSameOriginRequest(req)) return true
  const key = req.headers.get('x-bot-api-key')
  return !!key && key === process.env.BOT_API_KEY
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const bridgeId = req.nextUrl.searchParams.get('bridgeId')
  if (!bridgeId) {
    return NextResponse.json({ error: 'Missing bridgeId' }, { status: 400 })
  }

  const bridge = getBotById(bridgeId)
  if (!bridge) {
    return NextResponse.json({ error: 'Unknown bridgeId' }, { status: 404 })
  }

  pruneOldCommands(bridgeId)

  const pending = getBotCommands(bridgeId).filter(c => !c.acknowledged)

  for (const cmd of pending) {
    acknowledgeBotCommand(bridgeId, cmd.id)
  }

  const commands = pending.map(c => ({
    id: c.id,
    command: c.command,
    payload: c.payload,
    createdAt: c.timestamp,
  }))

  return NextResponse.json({ commands })
}
