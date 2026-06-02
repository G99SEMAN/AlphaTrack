import { NewsItem, NewsCategory } from '@/types/news'

const FEEDS = [
  { url: 'https://feeds.reuters.com/reuters/businessNews', name: 'Reuters' },
  { url: 'https://feeds.marketwatch.com/marketwatch/topstories/', name: 'MarketWatch' },
  { url: 'https://finance.yahoo.com/news/rssindex', name: 'Yahoo Finance' },
  { url: 'https://search.cnbc.com/rs/search/combinedcsearch.xml?partnerId=wrss01&id=10000664', name: 'CNBC' },
]

const KEYWORDS: Record<Exclude<NewsCategory, 'general'>, string[]> = {
  'monetary-policy': [
    'federal reserve', 'fed ', 'fomc', 'ecb ', 'european central bank', 'central bank',
    'interest rate', 'rate hike', 'rate cut', 'powell', 'lagarde', 'yield curve',
    'monetary policy', 'boj ', 'bank of england', 'inflation target', 'tapering',
  ],
  'earnings': [
    'earnings', 'quarterly results', 'quarterly revenue', ' eps ', 'profit report',
    'q1 ', 'q2 ', 'q3 ', 'q4 ', 'fiscal year', 'beats estimates', 'misses estimates',
    'annual results', 'net income', 'revenue growth',
  ],
  'geopolitical': [
    ' war', 'sanction', 'tariff', 'trade war', 'ukraine', 'russia', 'taiwan',
    'middle east', 'conflict', 'military', 'nato', 'iran', 'israel', 'gaza',
    'trade dispute', 'embargo', 'geopolit',
  ],
  'commodities': [
    'crude oil', 'brent oil', 'wti oil', ' opec', 'gold price', 'silver price',
    'copper price', 'commodity', 'natural gas', 'wheat price', 'barrel',
    'energy prices', 'raw material', 'oil price', 'metal price',
  ],
  'crypto': [
    'bitcoin', 'ethereum', 'cryptocurrency', 'crypto ', 'blockchain', ' btc ',
    ' eth ', 'digital asset', 'altcoin', 'defi', 'web3', 'nft ',
  ],
}

function simpleHash(str: string): string {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0
  }
  return Math.abs(h).toString(36)
}

function extractTag(xml: string, tag: string): string {
  const cdataRe = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`, 'i')
  const cdataMatch = xml.match(cdataRe)
  if (cdataMatch) return cdataMatch[1].trim()

  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const match = xml.match(re)
  return match ? match[1].trim() : ''
}

function extractLink(itemXml: string): string {
  // Standard RSS <link>url</link>
  const direct = itemXml.match(/<link>\s*([^<\s]+)\s*<\/link>/i)
  if (direct) return direct[1].trim()

  // Atom <link href="url" .../>
  const attr = itemXml.match(/<link[^>]+href="([^"]+)"/)
  if (attr) return attr[1].trim()

  // Fall back to guid
  return extractTag(itemXml, 'guid')
}

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, ' ')
}

function stripHtml(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
}


function categorize(text: string): NewsCategory {
  const t = text.toLowerCase()
  for (const [cat, keywords] of Object.entries(KEYWORDS) as [Exclude<NewsCategory, 'general'>, string[]][]) {
    if (keywords.some(k => t.includes(k))) return cat
  }
  return 'general'
}

function parseRSS(xml: string, sourceName: string): NewsItem[] {
  const tenDaysAgo = Date.now() - 10 * 24 * 60 * 60 * 1000
  const items: NewsItem[] = []
  const itemRegex = /<item[\s>][\s\S]*?<\/item>/gi
  const matches = xml.match(itemRegex) ?? []

  for (const itemXml of matches) {
    const title = stripHtml(extractTag(itemXml, 'title'))
    const link = extractLink(itemXml)
    const description = stripHtml(extractTag(itemXml, 'description'))
    const pubDateRaw = extractTag(itemXml, 'pubDate') || extractTag(itemXml, 'dc:date') || extractTag(itemXml, 'published')

    if (!title || !link) continue

    let publishedAt: string
    try {
      const d = new Date(pubDateRaw)
      publishedAt = isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
    } catch {
      publishedAt = new Date().toISOString()
    }

    if (new Date(publishedAt).getTime() < tenDaysAgo) continue

    const summary = description.slice(0, 320).trim()
    const category = categorize(title + ' ' + description)
    const id = simpleHash(title.slice(0, 80) + sourceName)

    items.push({ id, title, summary, url: link, source: sourceName, publishedAt, category })
  }

  return items
}

async function fetchFeed(url: string, sourceName: string): Promise<NewsItem[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 7000)
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AlphaTrack/1.1)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: controller.signal,
      next: { revalidate: 900 },
    })
    if (!res.ok) return []
    const xml = await res.text()
    return parseRSS(xml, sourceName)
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchNews(): Promise<{ items: NewsItem[]; fetchedAt: string }> {
  const results = await Promise.allSettled(FEEDS.map(f => fetchFeed(f.url, f.name)))

  const seenTitles = new Set<string>()
  const all: NewsItem[] = []

  for (const result of results) {
    if (result.status !== 'fulfilled') continue
    for (const item of result.value) {
      const key = item.title.slice(0, 60).toLowerCase()
      if (seenTitles.has(key)) continue
      seenTitles.add(key)
      all.push(item)
    }
  }

  all.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())

  return { items: all, fetchedAt: new Date().toISOString() }
}
