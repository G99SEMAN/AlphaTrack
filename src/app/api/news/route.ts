import { NextResponse } from 'next/server'
import { fetchNews } from '@/lib/news'

export const revalidate = 900

export async function GET() {
  try {
    const data = await fetchNews()
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800',
      },
    })
  } catch {
    return NextResponse.json({ items: [], fetchedAt: new Date().toISOString() }, { status: 500 })
  }
}
