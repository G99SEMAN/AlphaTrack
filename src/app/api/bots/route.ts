import { NextRequest, NextResponse } from 'next/server'
import { getBots, addBot } from '@/lib/bot-data'

export async function GET() {
  return NextResponse.json({ bots: getBots() }, {
    headers: { 'Cache-Control': 'private, max-age=10' },
  })
}

export async function POST(req: NextRequest) {
  let body: { name: string; profileId: string; url: string; type?: 'bridge' | 'bot' }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { name, profileId, url, type } = body
  if (!name?.trim() || !profileId?.trim() || !url?.trim()) {
    return NextResponse.json({ error: 'name, profileId und url sind Pflichtfelder' }, { status: 400 })
  }

  const bot = addBot({ name: name.trim(), profileId: profileId.trim(), url: url.trim(), type: type ?? 'bot' })
  return NextResponse.json({ bot }, { status: 201 })
}
