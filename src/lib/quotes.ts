export type TwelveDataInterval = '1min' | '5min' | '15min' | '1h'

export interface ChartWindow {
  start: Date
  end: Date
  interval: TwelveDataInterval
}

const MIN_BUFFER_MS = 15 * 60 * 1000

/**
 * Normalisiert ein Instrument-Kürzel auf ein Twelve-Data-Forex-Symbol
 * ("EUR/USD"). Gibt null zurück, wenn es sich nicht um ein erkennbares
 * 6-Buchstaben-Forex-Paar handelt (Indizes, Futures, Krypto, ...).
 */
export function mapToForexSymbol(instrument: string): string | null {
  const base = instrument.split(/[._]/)[0].replace(/[a-z]+$/, '')
  const clean = base.replace(/[^A-Za-z]/g, '').toUpperCase()
  if (!/^[A-Z]{6}$/.test(clean)) return null
  return `${clean.slice(0, 3)}/${clean.slice(3)}`
}

/**
 * Berechnet Zeitfenster (mit Puffer) und passende Candle-Auflösung
 * aus Entry- und Exit-Zeitpunkt eines Trades.
 */
export function computeChartWindow(openIso: string, closeIso: string): ChartWindow {
  const open = new Date(openIso)
  const close = new Date(closeIso)
  const durationMs = Math.max(close.getTime() - open.getTime(), 60 * 1000)
  const buffer = Math.max(durationMs * 0.25, MIN_BUFFER_MS)

  const start = new Date(open.getTime() - buffer)
  const end = new Date(close.getTime() + buffer)

  const durationMin = durationMs / 60000
  let interval: TwelveDataInterval
  if (durationMin <= 30) interval = '1min'
  else if (durationMin <= 240) interval = '5min'
  else if (durationMin <= 1440) interval = '15min'
  else interval = '1h'

  return { start, end, interval }
}

/**
 * Formatiert einen ISO-Zeitstempel in das von Twelve Data erwartete
 * "YYYY-MM-DD HH:MM:SS"-Format (UTC).
 */
export function toTwelveDataDateTime(iso: string): string {
  return new Date(iso).toISOString().slice(0, 19).replace('T', ' ')
}
