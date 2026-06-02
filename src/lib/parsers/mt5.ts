import { Trade } from '@/types/trade'

type ParsedTrade = Omit<Trade, 'id'>

function normalizeSymbol(raw: string): string {
  return raw.replace(/[a-z]+$/, '').trim()
}

function parseDate(raw: string): string {
  // MT5 format: "2026.04.27 13:14:59" → ISO "2026-04-27T13:14:59"
  return raw.trim().replace(/\./g, '-').replace(' ', 'T')
}

function num(raw: string): number | undefined {
  const v = parseFloat(raw.trim())
  return isNaN(v) ? undefined : v
}

function text(td: Element): string {
  return (td.textContent ?? '').trim()
}

export function extractInitialBalance(html: string): number | null {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const rows = Array.from(doc.querySelectorAll('tr'))
  let inDeals = false

  for (const row of rows) {
    const thEl = row.querySelector('th[colspan]')
    if (thEl) {
      const h = (thEl.textContent ?? '').toLowerCase()
      inDeals = h.includes('transaktionen') || h.includes('trades') || h.includes('deals')
      continue
    }
    if (!inDeals) continue

    const bgColor = row.getAttribute('bgcolor') ?? ''
    if (bgColor !== '#FFFFFF' && bgColor !== '#F7F7F7') continue

    const tds = Array.from(row.querySelectorAll('td'))
    const cells = tds.map(td => (td.textContent ?? '').trim())

    const hasBalance = cells.some(c => c.toLowerCase() === 'balance')
    const hasInitial = cells.some(c => c.toLowerCase().includes('initial_balance'))
    if (!hasBalance || !hasInitial) continue

    // Last numeric value > 0 before the comment cell
    for (let i = cells.length - 2; i >= 0; i--) {
      const v = parseFloat(cells[i])
      if (!isNaN(v) && v > 0) return v
    }
  }
  return null
}

export function parseMT5Html(html: string): ParsedTrade[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  const rows = Array.from(doc.querySelectorAll('tr'))
  const trades: ParsedTrade[] = []

  type Section = 'none' | 'positionen' | 'offen'
  let section: Section = 'none'

  for (const row of rows) {
    const bgColor = row.getAttribute('bgcolor') ?? ''
    const thEl = row.querySelector('th[colspan]')

    // Detect section headers
    if (thEl) {
      const heading = thEl.textContent ?? ''
      if (heading.includes('Offene Positionen')) {
        section = 'offen'
      } else if (heading.includes('Positionen')) {
        section = 'positionen'
      } else if (
        heading.includes('Orders') ||
        heading.includes('Trades') ||
        heading.includes('Ergebnisse')
      ) {
        section = 'none'
      }
      continue
    }

    // Skip non-data rows
    if (section === 'none') continue
    if (bgColor !== '#FFFFFF' && bgColor !== '#F7F7F7') continue

    const tds = Array.from(row.querySelectorAll('td'))

    if (section === 'positionen') {
      // Positionen: Zeit, PositionID, Symbol, Typ, hidden(colspan=8), Volumen,
      //             Preis, S/L, T/P, Schließzeit, Schlusskurs, Kommission, Swap, Gewinn
      if (tds.length < 14) continue
      const symbol = text(tds[2])
      if (!symbol) continue // Zusammenfassungszeile

      const direction = text(tds[3])
      if (direction !== 'buy' && direction !== 'sell') continue

      const closeTimeRaw = text(tds[9])
      const trade: ParsedTrade = {
        date: parseDate(text(tds[0])),
        closeTime: closeTimeRaw ? parseDate(closeTimeRaw) : undefined,
        externalId: text(tds[1]),
        instrument: normalizeSymbol(symbol),
        type: direction === 'buy' ? 'long' : 'short',
        size: num(text(tds[5])) ?? 0,
        entry: num(text(tds[6])) ?? 0,
        sl: num(text(tds[7])),
        tp: num(text(tds[8])),
        exit: num(text(tds[10])),
        commission: num(text(tds[11])),
        swap: num(text(tds[12])),
        pnl: num(text(tds[13])),
        status: 'closed',
      }
      trades.push(trade)
    }

    if (section === 'offen') {
      // Offene Positionen: Zeit, PositionID, Symbol, Typ, Volumen, Preis, S/L, T/P,
      //                    Marktpreis, Swap, Gewinn, Kommentar
      if (tds.length < 10) continue
      const symbol = text(tds[2])
      if (!symbol) continue

      const direction = text(tds[3])
      if (direction !== 'buy' && direction !== 'sell') continue

      const trade: ParsedTrade = {
        date: parseDate(text(tds[0])),
        externalId: text(tds[1]),
        instrument: normalizeSymbol(symbol),
        type: direction === 'buy' ? 'long' : 'short',
        size: num(text(tds[4])) ?? 0,
        entry: num(text(tds[5])) ?? 0,
        sl: num(text(tds[6])),
        tp: num(text(tds[7])),
        swap: num(text(tds[9])),
        status: 'open',
      }
      trades.push(trade)
    }
  }

  return trades
}
