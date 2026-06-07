/**
 * Bot-Log API — empfaengt und liefert bot-spezifische Log-Eintraege.
 * Strikt getrennt vom Bridge-Log (C2: keine doppelten Eintraege ueber Komponentengrenzen).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getBotById } from '@/lib/bot-data'
import { addBotLogEntry, getBotLog, clearBotLog } from '@/lib/bot-data'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return NextResponse.json({ log: getBotLog(id) })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let body: { botId?: string; level?: string; message?: string; details?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const botId = id
  const level = (body.level ?? 'info') as 'info' | 'warn' | 'error'
  const message = body.message ?? ''
  const details = body.details

  if (!message) {
    return NextResponse.json({ error: 'message required' }, { status: 400 })
  }

  const bot = getBotById(botId)
  addBotLogEntry(botId, level, message, details, bot?.name)
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  clearBotLog(id)
  return NextResponse.json({ ok: true })
}
