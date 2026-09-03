import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { getAllBotsWithStatus, getBotStatus, getConnectionState } from '@/lib/bot-data'
import { getApiKey } from '@/lib/api-keys'

export interface AnalyseResult {
  bias: 'Long' | 'Short' | 'Neutral'
  entry_zone: string
  stop_loss: string
  take_profit: string
  risk_reward: string
  confidence: 'Hoch' | 'Mittel' | 'Niedrig'
  reasoning: string
  timeframe: string
}

interface Candle {
  datetime: string
  open: string
  high: string
  low: string
  close: string
}

function buildSystemPrompt(lang: 'de' | 'en'): string {
  if (lang === 'en') {
    return `You are an experienced forex trader and market analyst.
You receive real, current price data (OHLC candles) for a currency pair and analyze the market based on it.

Always respond ONLY with a valid JSON object - no markdown, no code blocks, no text before or after:
{
  "bias": "Long" | "Short" | "Neutral",
  "entry_zone": "Price range based on real price data, e.g. '1.0820 - 1.0835'",
  "stop_loss": "Stop loss price as a string, e.g. '1.0795'",
  "take_profit": "Take profit price as a string, e.g. '1.0870'",
  "risk_reward": "Ratio as a string, e.g. '1:2.0'",
  "confidence": "Hoch" | "Mittel" | "Niedrig" (always use these exact German values, regardless of response language),
  "reasoning": "Reasoning in 2-3 sentences in English, reference concrete price levels from the data",
  "timeframe": "Timeframe as a string, e.g. 'M5 (Scalping)'"
}

Analyze the real price data based on:
- Current market structure (Higher Highs/Lower Lows) from the candle data
- Important support and resistance zones from the candle highs/lows
- Liquidity zones and Fair Value Gaps (Smart Money Concepts)
- Current market session (London/New York/Asia) based on the time
- Entry, SL and TP must have realistic distances to the current price

Entry zone: close to the current price or at a clear retracement zone.
Stop loss: behind the next structural low/high.
Take profit: at the next relevant resistance/support.`
  }
  return `Du bist ein erfahrener Forex-Trader und Marktanalyst.
Du erhältst echte aktuelle Kursdaten (OHLC-Kerzen) für ein Währungspaar und analysierst darauf basierend den Markt.

Antworte IMMER ausschließlich mit einem validen JSON-Objekt - kein Markdown, keine Codeblöcke, kein Text davor oder danach:
{
  "bias": "Long" | "Short" | "Neutral",
  "entry_zone": "Preisbereich basierend auf echten Kursdaten, z.B. '1.0820 - 1.0835'",
  "stop_loss": "Stop Loss Preis als String, z.B. '1.0795'",
  "take_profit": "Take Profit Preis als String, z.B. '1.0870'",
  "risk_reward": "Verhältnis als String, z.B. '1:2.0'",
  "confidence": "Hoch" | "Mittel" | "Niedrig",
  "reasoning": "Begründung in 2-3 Sätzen auf Deutsch, referenziere konkrete Preisniveaus aus den Daten",
  "timeframe": "Zeitrahmen als String, z.B. 'M5 (Scalping)'"
}

Analysiere die echten Kursdaten anhand von:
- Aktuelle Marktstruktur (Higher Highs/Lower Lows) aus den Kerzendaten
- Wichtige Unterstützungs- und Widerstandszonen aus den Hochs/Tiefs der Kerzen
- Liquiditätszonen und Fair Value Gaps (Smart Money Concepts)
- Aktuelle Marktsitzung (London/New York/Asien) basierend auf der Uhrzeit
- Entry, SL und TP müssen realistische Abstände zum aktuellen Kurs haben

Entry-Zone: nah am aktuellen Kurs oder an einer klaren Rückkehrzone.
Stop Loss: hinter dem nächsten strukturellen Tief/Hoch.
Take Profit: am nächsten relevanten Widerstand/Unterstützung.`
}

const VALID_SYMBOLS = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'NZD/USD', 'USD/CAD', 'EUR/GBP']
const BOT_INTERVAL_MAP: Record<string, string> = { '5min': 'M5', '1h': 'H1' }

function toMT5Symbol(apiSymbol: string): string {
  return apiSymbol.replace('/', '') + 'p'
}

async function fetchCandlesFromBot(apiSymbol: string, interval: string): Promise<Candle[]> {
  const allBots = getAllBotsWithStatus()
  const bridgeEntry = allBots.find(
    ({ bot, status }) =>
      (bot.type ?? 'bridge') === 'bridge' &&
      getConnectionState(status) !== 'offline'
  )
  if (!bridgeEntry) throw new Error('Keine Bridge verfügbar')

  const bot = bridgeEntry.bot
  const status = getBotStatus(bot.id)
  const connState = getConnectionState(status)

  if (connState === 'offline') throw new Error('Bot offline - bitte MT5 starten und Bot neu verbinden.')
  if (!status?.mt5Connected) throw new Error('MT5 nicht verbunden - bitte MT5 öffnen.')

  const mt5Symbol = toMT5Symbol(apiSymbol)
  const mt5Interval = BOT_INTERVAL_MAP[interval] ?? 'M5'

  const res = await fetch(
    `${bot.url}/candles?symbol=${mt5Symbol}&interval=${mt5Interval}&count=50`,
    { signal: AbortSignal.timeout(8000), cache: 'no-store' }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(err.error ?? 'Bot-Fehler beim Abrufen der Kerzen')
  }

  const data = await res.json() as { candles: Candle[] }
  return data.candles
}

function formatCandles(candles: Candle[]): string {
  return candles
    .slice(0, 30)
    .map(c => `${c.datetime} O:${c.open} H:${c.high} L:${c.low} C:${c.close}`)
    .join('\n')
}

function parsePrice(str: string): number {
  const parts = str.split('-').map(s => parseFloat(s.trim())).filter(n => !isNaN(n))
  if (parts.length === 2) return (parts[0] + parts[1]) / 2
  if (parts.length === 1) return parts[0]
  return NaN
}

function calcRR(result: AnalyseResult): string {
  const entry = parsePrice(result.entry_zone)
  const sl = parseFloat(result.stop_loss)
  const tp = parseFloat(result.take_profit)
  if (isNaN(entry) || isNaN(sl) || isNaN(tp)) return result.risk_reward
  const risk = Math.abs(entry - sl)
  const reward = Math.abs(entry - tp)
  if (risk === 0) return result.risk_reward
  const ratio = reward / risk
  return `1:${ratio.toFixed(1)}`
}

export async function POST(req: Request) {
  try {
    const apiKey = getApiKey('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY nicht konfiguriert' }, { status: 503 })
    }
    const client = new Anthropic({ apiKey })

    const { duration, symbol: rawSymbol, lang: rawLang } = await req.json()
    const lang: 'de' | 'en' = rawLang === 'en' ? 'en' : 'de'

    if (!duration || !['scalping', 'intraday'].includes(duration)) {
      return NextResponse.json({ error: 'Ungültige Handelsdauer' }, { status: 400 })
    }

    const symbol = VALID_SYMBOLS.includes(rawSymbol) ? rawSymbol : 'EUR/USD'
    const interval = duration === 'scalping' ? '5min' : '1h'
    const durationLabel = lang === 'en'
      ? (duration === 'scalping' ? 'Scalping (under 30 minutes, M5 chart)' : 'Intraday (1-8 hours, H1 chart)')
      : (duration === 'scalping' ? 'Scalping (unter 30 Minuten, M5-Chart)' : 'Intraday (1-8 Stunden, H1-Chart)')
    const timeframeLabel = duration === 'scalping' ? 'M5 (Scalping)' : 'H1 (Intraday)'

    const candles = await fetchCandlesFromBot(symbol, interval)
    if (!candles || candles.length === 0) {
      return NextResponse.json({ error: 'Keine Kursdaten vom Bot verfügbar. Symbol in MT5 aktiviert?' }, { status: 503 })
    }
    const currentPrice = candles[0].close
    const candleText = formatCandles(candles)

    const now = new Date()
    const timeStr = now.toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'full', timeStyle: 'short' })

    const userMessage = lang === 'en'
      ? `Analyze ${symbol} for a ${durationLabel} trade.

Current date and time (Berlin): ${timeStr}
Current price ${symbol}: ${currentPrice}
Candle timeframe: ${timeframeLabel}

Last 30 candles (newest first):
${candleText}

Give me a precise trading recommendation based on this real price data.`
      : `Analysiere ${symbol} für einen ${durationLabel}-Trade.

Aktuelles Datum und Uhrzeit (Berlin): ${timeStr}
Aktueller Kurs ${symbol}: ${currentPrice}
Zeitrahmen der Kerzen: ${timeframeLabel}

Letzte 30 Kerzen (neueste zuerst):
${candleText}

Gib mir eine präzise Handelsempfehlung basierend auf diesen echten Kursdaten.`

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system: [
        {
          type: 'text',
          text: buildSystemPrompt(lang),
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()

    let result: AnalyseResult
    try {
      result = JSON.parse(text) as AnalyseResult
    } catch {
      throw new Error('Modell hat kein gültiges JSON geliefert — bitte nochmals versuchen')
    }
    const missingFields = (['bias', 'entry_zone', 'stop_loss', 'take_profit', 'confidence', 'reasoning'] as const)
      .filter(f => !result[f])
    if (missingFields.length > 0) {
      throw new Error(`Analyse-Antwort unvollständig: Felder fehlen (${missingFields.join(', ')})`)
    }
    if (!['Hoch', 'Mittel', 'Niedrig'].includes(result.confidence)) result.confidence = 'Mittel'

    result.risk_reward = calcRR(result)

    return NextResponse.json({ ...result, currentPrice })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Analyse fehlgeschlagen'
    console.error('Analyse-Fehler:', err)
    if (msg === 'Keine Bridge verfügbar') {
      return NextResponse.json({ error: msg }, { status: 503 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
