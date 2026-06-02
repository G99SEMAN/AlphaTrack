import { NextRequest, NextResponse } from 'next/server'
import { getBotById, getBots, saveBots, removeBot } from '@/lib/bot-data'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!getBotById(id)) {
    return NextResponse.json({ error: 'Bot nicht gefunden' }, { status: 404 })
  }

  let body: { name?: string; url?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const updated = getBots().map(b => {
    if (b.id !== id) return b
    return {
      ...b,
      ...(body.name?.trim() ? { name: body.name.trim() } : {}),
      ...(body.url?.trim()  ? { url: body.url.trim() }   : {}),
    }
  })
  saveBots(updated)
  return NextResponse.json({ bot: updated.find(b => b.id === id) })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!getBotById(id)) {
    return NextResponse.json({ error: 'Bot nicht gefunden' }, { status: 404 })
  }
  removeBot(id)
  return NextResponse.json({ ok: true })
}
