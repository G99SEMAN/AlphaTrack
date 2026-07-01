import { Trade, TradeDirection } from '@/types/trade'
import { Strategy } from '@/types/strategy'

export interface TopTradeEntry {
  id: string
  date: string
  instrument: string
  type: TradeDirection
  pnl: number
  rr?: number
  strategyName?: string
}

export interface DirectionStats {
  trades: number
  winRate: number
  totalPnl: number
  avgPnl: number
}

export interface InstrumentStats {
  instrument: string
  trades: number
  winRate: number
  totalPnl: number
  avgPnl: number
}

export interface StrategyStats {
  strategyId: string | null
  name: string
  color?: string
  trades: number
  winRate: number
  profitFactor: number
  avgRR: number
  totalPnl: number
  roi: number
}

export interface WeekdayStats {
  day: string
  trades: number
  winRate: number
  avgPnl: number
  totalPnl: number
}

export interface RMultipleBucket {
  label: string
  count: number
  isPositive: boolean
}

export interface HourlyStats {
  hour: number
  label: string
  trades: number
  winRate: number
  avgPnl: number
  totalPnl: number
}

export interface ExtendedStats {
  profitFactor: number
  expectancy: number
  avgWin: number
  avgLoss: number
  winLossRatio: number
  costRatio: number
  roi: number
  avgTradesPerDay: number
  monthlyPnl: { month: string; pnl: number; trades: number }[]
  long: DirectionStats
  short: DirectionStats
  byInstrument: InstrumentStats[]
  top5ByTradeCount: InstrumentStats[]
  byStrategy: StrategyStats[]
  byWeekday: WeekdayStats[]
  byHour: HourlyStats[]
  rMultiples: RMultipleBucket[]
  hasRMultipleData: boolean
  totalClosed: number
  topTrades: TopTradeEntry[]
  maxDrawdown: number
  recoveryFactor: number
  consistencyScore: number
  profitableWeeks: number
  totalWeeks: number
  avgDurationMinutes: number
  avgDurationLongMinutes: number
  avgDurationShortMinutes: number
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

function dirStats(ts: Trade[], extraWins = 0, extraLosses = 0): DirectionStats {
  const wins = ts.filter(t => (t.pnl ?? 0) > 0)
  const totalTrades = ts.length + extraWins + extraLosses
  const totalWins = wins.length + extraWins
  const sumPnl = ts.reduce((s, t) => s + (t.pnl ?? 0), 0)
  return {
    trades: totalTrades,
    winRate: totalTrades > 0 ? totalWins / totalTrades * 100 : 0,
    totalPnl: round2(sumPnl),
    avgPnl: ts.length > 0 ? round2(sumPnl / ts.length) : 0,
  }
}

export function computeExtendedStats(trades: Trade[], strategies: Strategy[], startCapital = 0): ExtendedStats {
  const closed = trades.filter(t => t.status === 'closed' && t.pnl !== undefined)
  const paper = trades.filter(t => t.pnl === undefined && t.outcome !== undefined)
  const paperWins = paper.filter(t => t.outcome === 'win').length
  const paperLosses = paper.filter(t => t.outcome === 'loss').length
  const paperLong = paper.filter(t => t.type === 'long')
  const paperShort = paper.filter(t => t.type === 'short')

  const empty: ExtendedStats = {
    profitFactor: 0, expectancy: 0, avgWin: 0, avgLoss: 0,
    winLossRatio: 0, costRatio: 0, roi: 0, avgTradesPerDay: 0, monthlyPnl: [],
    long: dirStats([]), short: dirStats([]),
    byInstrument: [], top5ByTradeCount: [], byStrategy: [], byWeekday: [], byHour: [],
    rMultiples: [], hasRMultipleData: false, totalClosed: 0, topTrades: [],
    maxDrawdown: 0, recoveryFactor: 0, consistencyScore: 0,
    profitableWeeks: 0, totalWeeks: 0,
    avgDurationMinutes: 0, avgDurationLongMinutes: 0, avgDurationShortMinutes: 0,
  }
  if (closed.length === 0 && paper.length === 0) return empty
  if (closed.length === 0) return {
    ...empty,
    totalClosed: paper.length,
    long: dirStats([], paperLong.filter(t => t.outcome === 'win').length, paperLong.filter(t => t.outcome === 'loss').length),
    short: dirStats([], paperShort.filter(t => t.outcome === 'win').length, paperShort.filter(t => t.outcome === 'loss').length),
    maxDrawdown: 0, recoveryFactor: 0, consistencyScore: 0,
    profitableWeeks: 0, totalWeeks: 0,
    avgDurationMinutes: 0, avgDurationLongMinutes: 0, avgDurationShortMinutes: 0,
  }

  // KPIs
  const winners = closed.filter(t => (t.pnl ?? 0) > 0)
  const losers = closed.filter(t => (t.pnl ?? 0) < 0)
  const sumWins = winners.reduce((s, t) => s + (t.pnl ?? 0), 0)
  const sumLosses = losers.reduce((s, t) => s + (t.pnl ?? 0), 0)
  const avgWin = winners.length > 0 ? round2(sumWins / winners.length) : 0
  const avgLoss = losers.length > 0 ? round2(sumLosses / losers.length) : 0
  const profitFactor = sumLosses !== 0 ? round2(sumWins / Math.abs(sumLosses)) : sumWins > 0 ? 99 : 0
  const totalClosedCount = closed.length + paper.length
  const winRate = (winners.length + paperWins) / totalClosedCount
  const expectancy = round2(winRate * avgWin + (1 - winRate) * avgLoss)
  const winLossRatio = avgLoss !== 0 ? round2(avgWin / Math.abs(avgLoss)) : 0
  const totalCosts = closed.reduce((s, t) => s + (t.commission ?? 0) + (t.swap ?? 0) + (t.spreadCost ?? 0), 0)
  const totalPnl = closed.reduce((s, t) => s + (t.pnl ?? 0), 0)
  const netPnl = totalPnl - totalCosts
  const costRatio = totalPnl !== 0 ? round2(Math.abs(totalCosts) / Math.abs(totalPnl) * 100) : 0
  const roi = startCapital > 0 ? round2(netPnl / startCapital * 100) : 0

  // Monthly P&L
  const monthMap = new Map<string, { pnl: number; trades: number }>()
  for (const t of closed) {
    const key = t.date.substring(0, 7)
    const prev = monthMap.get(key) ?? { pnl: 0, trades: 0 }
    monthMap.set(key, { pnl: prev.pnl + (t.pnl ?? 0), trades: prev.trades + 1 })
  }
  const monthlyPnl = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => ({
      month: new Date(key + '-02').toLocaleDateString('de-DE', { month: 'short', year: '2-digit' }),
      pnl: round2(v.pnl),
      trades: v.trades,
    }))

  // Direction
  const long = dirStats(
    closed.filter(t => t.type === 'long'),
    paperLong.filter(t => t.outcome === 'win').length,
    paperLong.filter(t => t.outcome === 'loss').length,
  )
  const short = dirStats(
    closed.filter(t => t.type === 'short'),
    paperShort.filter(t => t.outcome === 'win').length,
    paperShort.filter(t => t.outcome === 'loss').length,
  )

  // Instrument
  const instrMap = new Map<string, Trade[]>()
  for (const t of closed) {
    const arr = instrMap.get(t.instrument) ?? []
    arr.push(t)
    instrMap.set(t.instrument, arr)
  }
  const byInstrument: InstrumentStats[] = Array.from(instrMap.entries())
    .map(([instrument, ts]) => {
      const sumPnl = ts.reduce((s, t) => s + (t.pnl ?? 0), 0)
      return {
        instrument,
        trades: ts.length,
        winRate: round2(ts.filter(t => (t.pnl ?? 0) > 0).length / ts.length * 100),
        totalPnl: round2(sumPnl),
        avgPnl: round2(sumPnl / ts.length),
      }
    })
    .sort((a, b) => b.totalPnl - a.totalPnl)

  const top5ByTradeCount = [...byInstrument].sort((a, b) => b.trades - a.trades).slice(0, 5)

  // Ø Trades pro Kalendertag seit erstem Trade
  const firstTradeDate = closed.map(t => t.date).sort()[0]
  const daysSinceFirst = Math.max(1, Math.ceil((Date.now() - new Date(firstTradeDate).getTime()) / 86400000))
  const avgTradesPerDay = round2(closed.length / daysSinceFirst)

  // Strategy
  const stratMap = new Map<string, Trade[]>()
  for (const t of closed) {
    const key = t.strategyId ?? '__none__'
    const arr = stratMap.get(key) ?? []
    arr.push(t)
    stratMap.set(key, arr)
  }
  const byStrategy: StrategyStats[] = Array.from(stratMap.entries())
    .map(([key, ts]) => {
      const strat = strategies.find(s => s.id === key)
      const w = ts.filter(t => (t.pnl ?? 0) > 0)
      const l = ts.filter(t => (t.pnl ?? 0) < 0)
      const sw = w.reduce((s, t) => s + (t.pnl ?? 0), 0)
      const sl = l.reduce((s, t) => s + (t.pnl ?? 0), 0)
      const pf = sl !== 0 ? round2(sw / Math.abs(sl)) : sw > 0 ? 99 : 0
      const rrTs = ts.filter(t => t.rr !== undefined && t.rr > 0)
      const avgRR = rrTs.length > 0 ? round2(rrTs.reduce((s, t) => s + (t.rr ?? 0), 0) / rrTs.length) : 0
      const stratTotalPnl = round2(ts.reduce((s, t) => s + (t.pnl ?? 0), 0))
      return {
        strategyId: key === '__none__' ? null : key,
        name: strat?.name ?? 'Ohne Strategie',
        color: strat?.color,
        trades: ts.length,
        winRate: round2(w.length / ts.length * 100),
        profitFactor: pf,
        avgRR,
        totalPnl: stratTotalPnl,
        roi: startCapital > 0 ? round2(stratTotalPnl / startCapital * 100) : 0,
      }
    })
    .sort((a, b) => b.trades - a.trades)

  // Weekday (1=Mo...5=Fr)
  const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr']
  const dayMap = new Map<number, Trade[]>()
  for (let i = 1; i <= 5; i++) dayMap.set(i, [])
  for (const t of closed) {
    const d = new Date(t.date).getDay()
    if (d >= 1 && d <= 5) dayMap.get(d)!.push(t)
  }
  const byWeekday: WeekdayStats[] = [1, 2, 3, 4, 5].map(d => {
    const ts = dayMap.get(d) ?? []
    const wins = ts.filter(t => (t.pnl ?? 0) > 0)
    const sum = ts.reduce((s, t) => s + (t.pnl ?? 0), 0)
    return {
      day: DAYS[d - 1],
      trades: ts.length,
      winRate: ts.length > 0 ? round2(wins.length / ts.length * 100) : 0,
      avgPnl: ts.length > 0 ? round2(sum / ts.length) : 0,
      totalPnl: round2(sum),
    }
  })

  // R-Multiple
  const rTrades = closed.filter(t => t.sl !== undefined && t.entry !== undefined && t.size > 0)
  const hasRMultipleData = rTrades.length > 0
  const BUCKETS: { label: string; min: number; max: number; isPositive: boolean }[] = [
    { label: '<-2R', min: -Infinity, max: -2, isPositive: false },
    { label: '-2R', min: -2, max: -1, isPositive: false },
    { label: '-1R', min: -1, max: -0.25, isPositive: false },
    { label: '~0', min: -0.25, max: 0.25, isPositive: false },
    { label: '+1R', min: 0.25, max: 1.5, isPositive: true },
    { label: '+2R', min: 1.5, max: 2.5, isPositive: true },
    { label: '>+2R', min: 2.5, max: Infinity, isPositive: true },
  ]
  const bucketCounts = new Map<string, number>(BUCKETS.map(b => [b.label, 0]))
  for (const t of rTrades) {
    const risk = Math.abs(t.entry! - t.sl!) * t.size
    if (risk === 0) continue
    const r = (t.pnl ?? 0) / risk
    const bucket = BUCKETS.find(b => r >= b.min && r < b.max)
    if (bucket) bucketCounts.set(bucket.label, (bucketCounts.get(bucket.label) ?? 0) + 1)
  }
  const rMultiples: RMultipleBucket[] = BUCKETS.map(b => ({
    label: b.label,
    isPositive: b.isPositive,
    count: bucketCounts.get(b.label) ?? 0,
  }))

  // Stunden-Analyse
  const hourMap = new Map<number, Trade[]>()
  for (let h = 0; h < 24; h++) hourMap.set(h, [])
  for (const t of closed) {
    const timeStr = t.closeTime ?? t.date
    const h = new Date(timeStr).getHours()
    if (h >= 0 && h < 24) hourMap.get(h)!.push(t)
  }
  const byHour: HourlyStats[] = Array.from(hourMap.entries())
    .filter(([, ts]) => ts.length > 0)
    .map(([h, ts]) => {
      const wins = ts.filter(t => (t.pnl ?? 0) > 0)
      const sum = ts.reduce((s, t) => s + (t.pnl ?? 0), 0)
      return {
        hour: h,
        label: `${String(h).padStart(2, '0')}:00`,
        trades: ts.length,
        winRate: round2(wins.length / ts.length * 100),
        avgPnl: round2(sum / ts.length),
        totalPnl: round2(sum),
      }
    })
    .sort((a, b) => a.hour - b.hour)

  // Top Trades nach PnL
  const topTrades: TopTradeEntry[] = closed
    .filter(t => (t.pnl ?? 0) > 0)
    .sort((a, b) => (b.pnl ?? 0) - (a.pnl ?? 0))
    .slice(0, 7)
    .map(t => ({
      id: t.id,
      date: t.date,
      instrument: t.instrument,
      type: t.type,
      pnl: round2(t.pnl ?? 0),
      rr: t.rr,
      strategyName: strategies.find(s => s.id === t.strategyId)?.name,
    }))

  // Max Drawdown (peak-to-trough auf Equity-Kurve; startCapital als Basis)
  let peak = startCapital
  let balance = startCapital
  let maxDD = 0
  let maxDDAbs = 0
  for (const t of [...closed].sort((a, b) => a.date.localeCompare(b.date))) {
    balance += (t.pnl ?? 0)
    if (balance > peak) peak = balance
    const ddAbs = Math.max(0, peak - balance)
    const dd = peak > 0 ? (ddAbs / peak) * 100 : 0
    if (dd > maxDD) { maxDD = dd; maxDDAbs = ddAbs }
  }
  const maxDrawdown = round2(maxDD)
  const recoveryFactor = maxDDAbs > 0 ? round2(netPnl / maxDDAbs) : 0

  // Konsistenz-Score — % der Wochen mit positivem P&L
  const weekMap = new Map<string, number>()
  for (const t of closed) {
    const d = new Date(t.date)
    const dayOfWeek = d.getDay() === 0 ? 6 : d.getDay() - 1
    const monday = new Date(d)
    monday.setDate(d.getDate() - dayOfWeek)
    const key = monday.toISOString().substring(0, 10)
    weekMap.set(key, (weekMap.get(key) ?? 0) + (t.pnl ?? 0))
  }
  const totalWeeks = weekMap.size
  const profitableWeeks = Array.from(weekMap.values()).filter(v => v > 0).length
  const consistencyScore = totalWeeks > 0 ? round2(profitableWeeks / totalWeeks * 100) : 0

  // Ø Trade-Dauer
  function avgMinutes(ts: Trade[]): number {
    const withTime = ts.filter(t => t.closeTime && t.date)
    if (withTime.length === 0) return 0
    const totalMs = withTime.reduce((s, t) => {
      const close = new Date(t.closeTime!).getTime()
      const open = new Date(t.date).getTime()
      return s + Math.max(0, close - open)
    }, 0)
    return round2(totalMs / withTime.length / 60000)
  }
  const avgDurationMinutes = avgMinutes(closed)
  const avgDurationLongMinutes = avgMinutes(closed.filter(t => t.type === 'long'))
  const avgDurationShortMinutes = avgMinutes(closed.filter(t => t.type === 'short'))

  return {
    profitFactor, expectancy, avgWin, avgLoss, winLossRatio, costRatio, roi, avgTradesPerDay,
    monthlyPnl, long, short, byInstrument, top5ByTradeCount, byStrategy, byWeekday, byHour,
    rMultiples, hasRMultipleData, totalClosed: totalClosedCount, topTrades,
    maxDrawdown, recoveryFactor, consistencyScore, profitableWeeks, totalWeeks,
    avgDurationMinutes, avgDurationLongMinutes, avgDurationShortMinutes,
  }
}
