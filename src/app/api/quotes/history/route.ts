import { NextRequest, NextResponse } from 'next/server'
import { toTwelveDataDateTime } from '@/lib/quotes'

interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
}

interface TwelveDataValue {
  datetime: string
  open: string
  high: string
  low: string
  close: string
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get('symbol')
  const interval = searchParams.get('interval')
  const start = searchParams.get('start')
  const end = searchParams.get('end')

  if (!symbol || !interval || !start || !end) {
    return NextResponse.json({ error: 'Missing required query params: symbol, interval, start, end' }, { status: 400 })
  }

  const apiKey = process.env.TWELVE_DATA_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'TWELVE_DATA_API_KEY not configured' }, { status: 500 })
  }

  let startDate: string
  let endDate: string
  try {
    startDate = toTwelveDataDateTime(start)
    endDate = toTwelveDataDateTime(end)
  } catch {
    return NextResponse.json({ error: 'Invalid start or end date' }, { status: 400 })
  }

  const url = new URL('https://api.twelvedata.com/time_series')
  url.searchParams.set('symbol', symbol)
  url.searchParams.set('interval', interval)
  url.searchParams.set('start_date', startDate)
  url.searchParams.set('end_date', endDate)
  url.searchParams.set('order', 'ASC')
  url.searchParams.set('timezone', 'UTC')
  url.searchParams.set('apikey', apiKey)

  let json: { status?: string; message?: string; values?: TwelveDataValue[] }
  try {
    const res = await fetch(url.toString())
    json = await res.json()
  } catch {
    return NextResponse.json({ error: 'Twelve Data request failed' }, { status: 502 })
  }

  if (json.status === 'error') {
    return NextResponse.json({ error: json.message ?? 'Twelve Data error' }, { status: 502 })
  }

  const values = json.values ?? []
  let candles: Candle[]
  try {
    candles = values.map(v => ({
      time: Math.floor(new Date(v.datetime.replace(' ', 'T') + 'Z').getTime() / 1000),
      open: parseFloat(v.open),
      high: parseFloat(v.high),
      low: parseFloat(v.low),
      close: parseFloat(v.close),
    }))
  } catch {
    return NextResponse.json({ error: 'Invalid Twelve Data response' }, { status: 502 })
  }

  return NextResponse.json({ candles })
}
