import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'

const TRACKED_PATH = path.join(process.cwd(), 'data', 'performance-bots.json')
const BOT_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/

function readTracked(): string[] {
  try {
    return JSON.parse(fs.readFileSync(TRACKED_PATH, 'utf-8')) as string[]
  } catch {
    return []
  }
}

function writeTracked(ids: string[]): void {
  const tmp = TRACKED_PATH + '.tmp'
  fs.mkdirSync(path.dirname(tmp), { recursive: true })
  fs.writeFileSync(tmp, JSON.stringify(ids, null, 2), 'utf-8')
  fs.renameSync(tmp, TRACKED_PATH)
}

export async function GET() {
  return NextResponse.json({ trackedBotIds: readTracked() })
}

export async function POST(req: NextRequest) {
  let body: { botId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { botId } = body
  if (!botId || !BOT_ID_RE.test(botId)) {
    return NextResponse.json({ error: 'Ungültige botId' }, { status: 400 })
  }
  const ids = readTracked()
  if (!ids.includes(botId)) writeTracked([...ids, botId])
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const botId = req.nextUrl.searchParams.get('botId')
  if (!botId || !BOT_ID_RE.test(botId)) {
    return NextResponse.json({ error: 'Ungültige botId' }, { status: 400 })
  }
  writeTracked(readTracked().filter(id => id !== botId))
  return NextResponse.json({ ok: true })
}
