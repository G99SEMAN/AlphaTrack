import { NextRequest, NextResponse } from 'next/server'
import { getBotById } from '@/lib/bot-data'

async function getBridge(req: NextRequest) {
  const bridgeId = req.nextUrl.searchParams.get('bridgeId')
  if (!bridgeId) return { error: 'Missing bridgeId', status: 400 }
  const bridge = getBotById(bridgeId)
  if (!bridge) return { error: 'Unknown bridgeId', status: 404 }
  return { bridge }
}

function isSameOriginRequest(req: NextRequest): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return false
  const host = req.headers.get('host')
  if (!host) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  const res = await getBridge(req)
  if ('error' in res) return NextResponse.json({ error: res.error }, { status: res.status })
  try {
    const r = await fetch(`${res.bridge.url}/config`, { signal: AbortSignal.timeout(8000) })
    const data = await r.json()
    return NextResponse.json(data, { status: r.status })
  } catch {
    return NextResponse.json({ error: 'Bridge nicht erreichbar' }, { status: 503 })
  }
}

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const res = await getBridge(req)
  if ('error' in res) return NextResponse.json({ error: res.error }, { status: res.status })
  try {
    const body = await req.json()
    const r = await fetch(`${res.bridge.url}/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bot-Api-Key': process.env.BOT_API_KEY ?? '',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    })
    const data = await r.json()
    return NextResponse.json(data, { status: r.status })
  } catch {
    return NextResponse.json({ error: 'Bridge nicht erreichbar' }, { status: 503 })
  }
}
