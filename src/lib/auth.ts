import { timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'

export function isValidApiKey(req: NextRequest): boolean {
  const provided = req.headers.get('x-bot-api-key') ?? ''
  const expected = process.env.BOT_API_KEY ?? ''
  if (!provided || provided.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(provided, 'utf-8'), Buffer.from(expected, 'utf-8'))
  } catch {
    return false
  }
}

export function isSameOriginRequest(req: NextRequest): boolean {
  const host = req.headers.get('host')
  if (!host) return false

  const origin = req.headers.get('origin')
  if (origin) {
    try {
      return new URL(origin).host === host
    } catch {
      return false
    }
  }

  // Fallback: browsers omit Origin on same-origin POST in some configurations (e.g. Docker port-mapping).
  // Referer is always present for browser-initiated requests and carries the full origin URL.
  const referer = req.headers.get('referer')
  if (referer) {
    try {
      return new URL(referer).host === host
    } catch {
      return false
    }
  }

  return false
}
