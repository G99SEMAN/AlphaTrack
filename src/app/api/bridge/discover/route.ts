import { NextRequest, NextResponse } from 'next/server'
import { addBot } from '@/lib/bot-data'

const BRIDGE_PORT = 8765
const SCAN_CONCURRENCY = 30
const SCAN_TIMEOUT_MS = 2000

function validateBridgeUrl(raw: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(raw.trim())
  } catch {
    return null
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return null
  // SSRF-Schutz: Loopback und Metadaten-Adressen blockieren
  if (parsed.hostname === 'localhost') return null
  if (/^127\./.test(parsed.hostname)) return null
  if (parsed.hostname === '::1') return null
  if (/^169\.254\./.test(parsed.hostname)) return null
  if (parsed.hostname === '0.0.0.0') return null
  return parsed.origin
}

async function probeInfo(
  ip: string,
): Promise<{ url: string; name: string; profileId: string } | null> {
  const url = `http://${ip}:${BRIDGE_PORT}`
  try {
    const r = await fetch(`${url}/info`, {
      signal: AbortSignal.timeout(SCAN_TIMEOUT_MS),
    })
    if (!r.ok) return null
    const data = await r.json()
    const name = (data.name as string) || 'Bridge'
    const profileId = (data.profile_id as string) || ''
    if (!profileId) return null
    return { url, name, profileId }
  } catch {
    return null
  }
}

async function autoScan(): Promise<{ url: string; name: string; profileId: string } | null> {
  for (let i = 0; i < 254; i += SCAN_CONCURRENCY) {
    const batch: string[] = []
    for (let j = i + 1; j <= Math.min(i + SCAN_CONCURRENCY, 254); j++) {
      batch.push(`192.168.178.${j}`)
    }
    const results = await Promise.all(batch.map(ip => probeInfo(ip)))
    const found = results.find(r => r !== null)
    if (found) return found
  }
  return null
}

export async function POST(req: NextRequest) {
  let body: { url?: string } = {}
  try { body = await req.json() } catch { /* kein Body → Auto-Scan */ }

  if (!body.url?.trim()) {
    const found = await autoScan()
    if (!found) {
      return NextResponse.json(
        { error: 'Keine Bridge im Subnetz 192.168.178.X gefunden' },
        { status: 404 },
      )
    }
    const bridge = addBot({
      name: found.name,
      profileId: found.profileId,
      url: found.url,
      type: 'bridge',
    })
    return NextResponse.json({ bot: bridge }, { status: 201 })
  }

  const base = validateBridgeUrl(body.url)
  if (!base) {
    return NextResponse.json(
      { error: 'Ungültige Bridge-URL (nur http/https, keine Loopback-Adressen)' },
      { status: 400 },
    )
  }

  let infoData: Record<string, unknown> = {}
  try {
    const r = await fetch(`${base}/info`, { signal: AbortSignal.timeout(6000) })
    if (r.ok) {
      infoData = await r.json()
    } else {
      // Fallback: /health für ältere Bridges
      const h = await fetch(`${base}/health`, { signal: AbortSignal.timeout(6000) })
      if (!h.ok) {
        return NextResponse.json({ error: 'Bridge antwortet nicht korrekt' }, { status: 502 })
      }
    }
  } catch {
    return NextResponse.json({ error: `Bridge unter ${base} nicht erreichbar` }, { status: 503 })
  }

  const bridgeName = (infoData.name as string) || 'Bridge'
  const profileId = (infoData.profile_id as string) || ''
  if (!profileId) {
    return NextResponse.json(
      { error: 'Bridge hat keine profile_id konfiguriert' },
      { status: 400 },
    )
  }

  const bridge = addBot({ name: bridgeName, profileId, url: base, type: 'bridge' })

  const bridgeApiKey = process.env.BOT_API_KEY ?? ''
  if (bridgeApiKey) {
    try {
      await fetch(`${base}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Bot-Api-Key': bridgeApiKey },
        body: JSON.stringify({ bridge_id: bridge.id }),
        signal: AbortSignal.timeout(6000),
      })
    } catch { /* non-fatal */ }
  }

  return NextResponse.json({ bot: bridge }, { status: 201 })
}
