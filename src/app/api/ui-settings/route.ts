import { NextRequest, NextResponse } from 'next/server'
import { getUiSettings, saveUiSettings, UiSettings } from '@/lib/ui-settings'

export async function GET() {
  return NextResponse.json(getUiSettings())
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Partial<UiSettings>
    const current = getUiSettings()
    if (Array.isArray(body.visibleExchanges)) {
      current.visibleExchanges = body.visibleExchanges
    }
    saveUiSettings(current)
    return NextResponse.json(current)
  } catch {
    return NextResponse.json({ error: 'Fehler beim Speichern' }, { status: 500 })
  }
}
