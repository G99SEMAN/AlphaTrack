import { NextRequest, NextResponse } from 'next/server'
import { getAnalyseHistory, saveAnalyseEntry } from '@/lib/analyse-data'

export async function GET() {
  return NextResponse.json({ history: getAnalyseHistory() })
}

export async function POST(req: NextRequest) {
  let body: Parameters<typeof saveAnalyseEntry>[0]
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.bias || !body.duration) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const entry = saveAnalyseEntry(body)
  return NextResponse.json({ ok: true, entry })
}
