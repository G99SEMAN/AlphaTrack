import { NextRequest, NextResponse } from 'next/server'
import { addBot } from '@/lib/bot-data'

function validateBridgeUrl(raw: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(raw.trim())
  } catch {
    return null
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return null
  // Block link-local range used by cloud metadata endpoints (e.g. 169.254.169.254)
  if (/^169\.254\./.test(parsed.hostname)) return null
  if (parsed.hostname === '0.0.0.0') return null
  return parsed.origin
}

export async function POST(req: NextRequest) {
  let body: { url: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { url } = body
  if (!url?.trim()) return NextResponse.json({ error: 'Missing url' }, { status: 400 })

  const base = validateBridgeUrl(url)
  if (!base) return NextResponse.json({ error: 'Ungültige Bridge-URL (nur http/https, keine Metadaten-Adressen)' }, { status: 400 })

  // 1) Health-Check
  try {
    const health = await fetch(`${base}/health`, { signal: AbortSignal.timeout(6000) })
    if (!health.ok) return NextResponse.json({ error: 'Bridge antwortet nicht korrekt' }, { status: 502 })
  } catch {
    return NextResponse.json({ error: `Bridge unter ${base} nicht erreichbar` }, { status: 503 })
  }

  // 2) Config lesen
  let bridgeConfig: Record<string, unknown>
  try {
    const cfg = await fetch(`${base}/config`, { signal: AbortSignal.timeout(6000) })
    if (!cfg.ok) return NextResponse.json({ error: 'Konnte Bridge-Konfiguration nicht lesen' }, { status: 502 })
    bridgeConfig = await cfg.json()
  } catch {
    return NextResponse.json({ error: 'Fehler beim Lesen der Bridge-Konfiguration' }, { status: 502 })
  }

  const bridgeName = (bridgeConfig.bridge_name as string) || (bridgeConfig.bot_name as string) || 'Bridge'
  const profileId = (bridgeConfig.profile_id as string) || ''
  const bridgeApiKey = (bridgeConfig.api_key as string) || ''

  if (!profileId) return NextResponse.json({ error: 'Bridge hat keine profile_id konfiguriert' }, { status: 400 })

  // 3) In AlphaTrack registrieren
  const bridge = addBot({ name: bridgeName, profileId, url: base, type: 'bridge' })

  // 4) Neue bridge_id an Bridge zurücksenden
  try {
    await fetch(`${base}/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bot-Api-Key': bridgeApiKey,
      },
      body: JSON.stringify({ bridge_id: bridge.id }),
      signal: AbortSignal.timeout(6000),
    })
  } catch { /* non-fatal */ }

  return NextResponse.json({ bot: bridge }, { status: 201 })
}
