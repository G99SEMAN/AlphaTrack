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
