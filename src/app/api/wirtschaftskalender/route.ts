import { NextResponse } from 'next/server'
import { getWirtschaftskalenderData } from '@/lib/wirtschaftskalender'

export const dynamic = 'force-dynamic'

export async function GET() {
  const data = await getWirtschaftskalenderData()

  if (data.source === 'bridge') {
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
  }
  if (data.source === 'tradays') {
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    })
  }
  return NextResponse.json(data, { status: 500 })
}
