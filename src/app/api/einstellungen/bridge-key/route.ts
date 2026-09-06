import { NextResponse } from 'next/server'
import { getApiKey } from '@/lib/api-keys'

export async function GET() {
  return NextResponse.json({ apiKey: getApiKey('BOT_API_KEY') ?? null })
}
