import type { WirtschaftsEvent, WirtschaftskalenderData } from '@/types/wirtschaftskalender'

const FOREX_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD']

const IMPORTANCE_MAP: Record<string, WirtschaftsEvent['impact']> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

interface TradaysEvent {
  Id: number
  EventName: string
  Importance: string
  CurrencyCode: string
  ForecastValue: string
  PreviousValue: string
  ActualValue: string
  ReleaseDate: number   // Unix ms
  FullDate: string
  CountryName: string | null
}

function getISOString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
}

function getWeekRange(offsetWeeks: number) {
  const now = new Date()
  const day = now.getUTCDay() === 0 ? 6 : now.getUTCDay() - 1
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() - day + offsetWeeks * 7)
  monday.setUTCHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  sunday.setUTCHours(23, 59, 59, 999)
  return { from: getISOString(monday), to: getISOString(sunday) }
}

async function fetchWeek(offset: 0 | 1): Promise<TradaysEvent[]> {
  const { from, to } = getWeekRange(offset)
  const params = new URLSearchParams({
    date_mode: '1',
    from,
    to,
    importance: '1,2,3',
    currencies: FOREX_CURRENCIES.join(','),
  })
  const res = await fetch(
    `https://www.tradays.com/de/economic-calendar/widget/content?${params}`,
    {
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://www.tradays.com/de/economic-calendar/widget?mode=2&fw=html',
      },
      next: { revalidate: 1800 },
    }
  )
  if (!res.ok) throw new Error(`Tradays ${offset}: ${res.status}`)
  return res.json()
}

export async function fetchWirtschaftskalenderFromBridge(botUrl: string): Promise<WirtschaftskalenderData> {
  const res = await fetch(`${botUrl}/calendar?days_back=2&days_ahead=9`, { signal: AbortSignal.timeout(6000) })
  if (!res.ok) throw new Error(`Bridge /calendar: ${res.status}`)
  const data = await res.json()
  if (!Array.isArray(data.events)) throw new Error('Ungültige Bridge-Antwort')
  return {
    events: (data.events as WirtschaftsEvent[]),
    fetchedAt: data.fetchedAt ?? new Date().toISOString(),
  }
}

export async function fetchWirtschaftskalender(): Promise<WirtschaftskalenderData> {
  const results = await Promise.allSettled([fetchWeek(0), fetchWeek(1)])

  const raw: TradaysEvent[] = results.flatMap(r => r.status === 'fulfilled' ? r.value : [])

  const seen = new Set<string>()
  const events: WirtschaftsEvent[] = raw
    .filter(e => FOREX_CURRENCIES.includes(e.CurrencyCode) && IMPORTANCE_MAP[e.Importance])
    .map((e, i) => {
      const d = new Date(e.ReleaseDate)
      const date = d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' })
      const time = d.toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' })
      const id = encodeURIComponent(`${e.CurrencyCode}-${date}-${e.EventName}-${i}`.toLowerCase())
      return {
        id,
        title: e.EventName,
        country: e.CurrencyCode,
        date,
        time,
        impact: IMPORTANCE_MAP[e.Importance],
        forecast: e.ForecastValue || null,
        previous: e.PreviousValue || null,
        actual: e.ActualValue || null,
      }
    })
    .filter(e => { const k = `${e.country}-${e.date}-${e.title}`; if (seen.has(k)) return false; seen.add(k); return true })
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))

  return { events, fetchedAt: new Date().toISOString() }
}
