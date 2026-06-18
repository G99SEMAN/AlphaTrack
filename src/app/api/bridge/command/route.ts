import { NextRequest, NextResponse } from 'next/server'
import { addBotCommand, pruneOldCommands, addBridgeLogEntry, getBotById, acknowledgeBotCommand } from '@/lib/bot-data'
import { BotCommandType, TradeOrderPayload, ClosePositionPayload, SetParametersPayload } from '@/types/bot'
import { isSameOriginRequest } from '@/lib/auth'

const VALID_COMMANDS: BotCommandType[] = ['start', 'stop', 'pause', 'resume', 'execute_trade', 'close_position', 'restart', 'set_parameters']

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { bridgeId: string; command: BotCommandType; payload?: TradeOrderPayload | ClosePositionPayload | SetParametersPayload }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { bridgeId, command, payload } = body
  if (!bridgeId || !VALID_COMMANDS.includes(command)) {
    return NextResponse.json({ error: 'Missing bridgeId or invalid command' }, { status: 400 })
  }

  if (command === 'execute_trade') {
    const p = payload as TradeOrderPayload | undefined
    if (!p?.symbol || !p?.direction || !p?.lots) {
      return NextResponse.json({ error: 'execute_trade requires symbol, direction, lots' }, { status: 400 })
    }
    if (p.lots < 0.01 || p.lots > 100) {
      return NextResponse.json({ error: 'Lots must be between 0.01 and 100' }, { status: 400 })
    }
  }

  if (command === 'close_position') {
    const p = payload as ClosePositionPayload | undefined
    if (!p?.ticket) {
      return NextResponse.json({ error: 'close_position requires ticket' }, { status: 400 })
    }
  }

  if (command === 'set_parameters') {
    const p = payload as SetParametersPayload | undefined
    if (!p?.parameters || typeof p.parameters !== 'object' || Array.isArray(p.parameters)) {
      return NextResponse.json({ error: 'set_parameters requires parameters object' }, { status: 400 })
    }
  }

  const bridge = getBotById(bridgeId)
  if (!bridge) {
    return NextResponse.json({ error: 'Unknown bridgeId' }, { status: 404 })
  }

  pruneOldCommands(bridgeId)
  const entry = addBotCommand(bridgeId, command, payload)
  let logDetails = `ID: ${entry.id}`
  if (command === 'execute_trade' && payload) {
    const p = payload as TradeOrderPayload
    logDetails = `${p.direction.toUpperCase()} ${p.lots} ${p.symbol}${p.sl ? ` SL:${p.sl}` : ''}${p.tp ? ` TP:${p.tp}` : ''}`
  } else if (command === 'close_position' && payload) {
    logDetails = `Ticket #${(payload as ClosePositionPayload).ticket}`
  }
  addBridgeLogEntry(bridgeId, 'info', `Command gesendet: ${command}`, logDetails)

  const botApiKey = process.env.BOT_API_KEY ?? ''
  if (!botApiKey) {
    console.warn('[Bridge] BOT_API_KEY nicht gesetzt — Command wird ohne Auth-Key an Bot gesendet')
  }

  try {
    const flaskBody: Record<string, unknown> = { command, id: entry.id }
    if (payload) flaskBody.payload = payload

    const flaskRes = await fetch(`${bridge.url}/command`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bot-Api-Key': botApiKey,
      },
      body: JSON.stringify(flaskBody),
      signal: AbortSignal.timeout(12000),
    })

    if (command === 'execute_trade' || command === 'close_position') {
      if (flaskRes.ok) {
        acknowledgeBotCommand(bridgeId, entry.id)
        const result = await flaskRes.json()
        return NextResponse.json({ ok: true, delivered: true, commandId: entry.id, result })
      }
      acknowledgeBotCommand(bridgeId, entry.id)
      const errBody = await flaskRes.json().catch(() => ({})) as { error?: string }
      addBridgeLogEntry(bridgeId, 'error', `Command fehlgeschlagen: ${command}`, errBody.error ?? `HTTP ${flaskRes.status}`)
      return NextResponse.json({ ok: false, error: errBody.error ?? 'Bridge returned error' }, { status: 502 })
    }

    if (!flaskRes.ok) {
      acknowledgeBotCommand(bridgeId, entry.id)
      const errBody = await flaskRes.json().catch(() => ({})) as { error?: string }
      addBridgeLogEntry(bridgeId, 'error', `Command fehlgeschlagen: ${command}`, errBody.error ?? `HTTP ${flaskRes.status}`)
      return NextResponse.json({ ok: false, delivered: true, error: errBody.error ?? `Bridge returned ${flaskRes.status}` }, { status: 502 })
    }
  } catch {
    addBridgeLogEntry(bridgeId, 'warn', `Bridge nicht direkt erreichbar - Command in Queue`, bridge.url)
    return NextResponse.json({ ok: true, delivered: false, queued: true, commandId: entry.id })
  }

  acknowledgeBotCommand(bridgeId, entry.id)
  return NextResponse.json({ ok: true, delivered: true, commandId: entry.id })
}
