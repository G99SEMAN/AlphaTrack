export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getApiKey } from '@/lib/api-keys'

interface EventExplanation {
  name: string
  zusammenfassung: string
  warum_wichtig: string
  einfluss: string
  kategorie: string
  timing?: string
}

const filePath = path.join(process.cwd(), 'data', 'event-explanations.json')

function loadCache(): Record<string, EventExplanation> {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return {}
  }
}

function saveCache(data: Record<string, EventExplanation>): void {
  try {
    const tmp = filePath + '.tmp'
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8')
    fs.renameSync(tmp, filePath)
  } catch (e) {
    console.error('[Kalender] Cache-Schreiben fehlgeschlagen:', e)
  }
}

async function fetchFromClaude(title: string, country: string): Promise<EventExplanation> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic()

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    messages: [{
      role: 'user',
      content: `Erkläre den Wirtschaftsindikator "${title}" (Währung: ${country}) für einen Forex-Trader auf Deutsch. Antworte NUR mit einem JSON-Objekt (kein Markdown):
{
  "name": "Vollständiger Name",
  "zusammenfassung": "Was wird gemessen (1-2 Sätze)",
  "warum_wichtig": "Warum wichtig für Forex-Trader (1-2 Sätze)",
  "einfluss": "Besser als erwartet: X. Schlechter als erwartet: Y.",
  "kategorie": "Arbeitsmarkt/Inflation/Geldpolitik/Wirtschaftswachstum/Handel/Stimmung/Immobilien/Rohstoffe"
}`
    }]
  })

  if (message.content[0].type !== 'text') throw new Error('Unerwarteter Antworttyp')
  const raw = message.content[0].text
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Kein JSON in Antwort')
  return JSON.parse(match[0])
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const title = searchParams.get('title')?.trim().toLowerCase() ?? ''
  const country = searchParams.get('country') ?? ''

  if (!title) {
    return NextResponse.json({ explanation: null, error: 'Kein Titel' }, { status: 400 })
  }

  const cache = loadCache()

  if (cache[title]) {
    return NextResponse.json({ explanation: cache[title], source: 'cache' })
  }

  if (!getApiKey('ANTHROPIC_API_KEY')) {
    console.warn('[Kalender] ANTHROPIC_API_KEY fehlt')
    return NextResponse.json({ explanation: null, error: 'API-Key nicht konfiguriert' })
  }

  try {
    const explanation = await fetchFromClaude(title, country)
    cache[title] = explanation
    saveCache(cache)
    return NextResponse.json({ explanation, source: 'ai' })
  } catch (e) {
    console.error('[Kalender] Claude API Fehler:', e)
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ explanation: null, error: `API-Fehler: ${msg}` })
  }
}
