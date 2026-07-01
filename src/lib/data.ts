import { cache } from 'react'
import { Trade, TradeStats } from '@/types/trade'
import { Deposit } from '@/types/profile'
import path from 'path'
import fs from 'fs'

const DATA_FILE = path.join(process.cwd(), 'data', 'trades.json')

let _statsCache: { key: string; result: TradeStats } | null = null

function atomicWrite(filePath: string, content: string): void {
  const tmp = filePath + '.tmp'
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(tmp, content, 'utf-8')
  fs.renameSync(tmp, filePath)
}

export const getTrades = cache(function getTrades(): Trade[] {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8')
    return JSON.parse(raw) as Trade[]
  } catch {
    return []
  }
})

export function saveTrades(trades: Trade[]): void {
  atomicWrite(DATA_FILE, JSON.stringify(trades, null, 2))
}

export function computeStats(trades: Trade[], startCapital = 0, deposits: Deposit[] = []): TradeStats {
  const cacheKey = `${trades.length}_${trades[trades.length - 1]?.id ?? ''}`
  if (_statsCache && _statsCache.key === cacheKey) return _statsCache.result

  const closed = trades.filter(t => t.status === 'closed' && t.pnl !== undefined)
  const paper = trades.filter(t => t.pnl === undefined && t.outcome !== undefined)

  // ISO-Strings sind lexikographisch vergleichbar - kein new Date() nötig
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const thisMonthStr = now.toISOString().slice(0, 7)

  // Einmaliger Durchlauf über alle closed trades
  let totalPnl = 0, monthlyPnl = 0, dailyPnl = 0
  let totalCostsSum = 0, totalCommission = 0, totalSwap = 0
  let netMonthlyPnl = 0, netDailyPnl = 0
  let winnerCount = 0, rrSum = 0, rrCount = 0
  let grossProfit = 0, grossLoss = 0, winSum = 0, lossSum = 0, lossCount = 0

  for (const t of closed) {
    const pnl = t.pnl ?? 0
    const cost = Math.abs(t.commission ?? 0) + Math.abs(t.swap ?? 0) + (t.spreadCost ?? 0)
    const dayStr = t.date.slice(0, 10)
    const monthStr = t.date.slice(0, 7)

    totalPnl += pnl
    totalCostsSum += cost
    totalCommission += t.commission ?? 0
    totalSwap += t.swap ?? 0

    if (monthStr === thisMonthStr) { monthlyPnl += pnl; netMonthlyPnl += pnl - cost }
    if (dayStr === todayStr) { dailyPnl += pnl; netDailyPnl += pnl - cost }
    if (pnl > 0) { winnerCount++; grossProfit += pnl; winSum += pnl }
    else if (pnl < 0) { grossLoss += Math.abs(pnl); lossSum += pnl; lossCount++ }
    if (t.rr !== undefined && t.rr > 0) { rrSum += t.rr; rrCount++ }
  }

  const netPnl = totalPnl - totalCostsSum

  const paperWins = paper.filter(t => t.outcome === 'win').length
  const allClosedCount = closed.length + paper.length
  const winRate = allClosedCount > 0 ? ((winnerCount + paperWins) / allClosedCount) * 100 : 0
  const avgRR = rrCount > 0 ? rrSum / rrCount : 0
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0
  const avgWin = winnerCount > 0 ? winSum / winnerCount : 0
  const avgLoss = lossCount > 0 ? lossSum / lossCount : 0

  const sorted = [...closed].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Alle Ereignisse (Trades + Einzahlungen) chronologisch zusammenfuhren
  type BalanceEvent = { date: string; delta: number; isDeposit: boolean }
  const events: BalanceEvent[] = [
    ...sorted.map(t => ({ date: t.date, delta: t.pnl ?? 0, isDeposit: false })),
    ...deposits.map(d => ({ date: d.date, delta: d.amount, isDeposit: true })),
  ].sort((a, b) => {
    const diff = new Date(a.date).getTime() - new Date(b.date).getTime()
    if (diff !== 0) return diff
    return a.isDeposit ? -1 : 1 // Einzahlungen vor Trades am selben Tag
  })

  // Drawdown und Equity-Kurve gemeinsam berechnen (absolute Kontosaldos)
  let peak = startCapital
  let maxDrawdown = 0
  let balance = startCapital
  let depositRunning = 0
  const equityCurve: { date: string; value: number }[] = []
  const depositCurve: { date: string; value: number }[] = []

  for (const ev of events) {
    balance += ev.delta
    if (ev.isDeposit) depositRunning += ev.delta
    if (balance > peak) peak = balance
    // Ohne Startkapital (peak=0) ergibt der %-Drawdown keine sinnvolle Zahl
    const dd = peak > 0 ? ((peak - balance) / peak) * 100 : 0
    if (dd > maxDrawdown) maxDrawdown = dd
    const parts = ev.date.slice(0, 10).split('-')
    const dateLabel = `${parts[2]}.${parts[1]}`
    equityCurve.push({ date: dateLabel, value: Math.round(balance * 100) / 100 })
    depositCurve.push({ date: dateLabel, value: Math.round(depositRunning * 100) / 100 })
  }

  // Streak berechnen
  const streak = calcStreak(sorted)

  const result: TradeStats = {
    totalPnl,
    monthlyPnl,
    dailyPnl,
    netPnl,
    netMonthlyPnl,
    netDailyPnl,
    totalCosts: totalCostsSum,
    totalCommission,
    totalSwap,
    winRate,
    totalTrades: allClosedCount,
    openTrades: trades.filter(t => t.status === 'open').length,
    avgRR,
    maxDrawdown,
    currentStreak: streak,
    equityCurve,
    depositCurve,
    profitFactor,
    avgWin,
    avgLoss,
  }
  _statsCache = { key: cacheKey, result }
  return result
}

export function filterTradesByPeriod(trades: Trade[], period: string, from?: string, to?: string): Trade[] {
  // Free date range via from/to params
  if (from && to) {
    return trades.filter(t => {
      const d = (t.closeTime ?? t.date).slice(0, 10)
      return d >= from && d <= to
    })
  }

  if (!period || period === 'gesamt') return trades
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const monthStr = now.toISOString().slice(0, 7)
  const yearStr = now.getFullYear().toString()

  let fromStr = todayStr
  if (period === 'woche') {
    const d = new Date(now)
    d.setDate(d.getDate() - 6)
    fromStr = d.toISOString().slice(0, 10)
  }

  return trades.filter(t => {
    const d = t.date.slice(0, 10)
    if (period === 'monat') return d.slice(0, 7) === monthStr
    if (period === 'jahr') return d.slice(0, 4) === yearStr
    return d >= fromStr
  })
}

// trades muss chronologisch sortiert sein (ältester zuerst)
function calcStreak(trades: Trade[]): number {
  if (trades.length === 0) return 0
  const last = trades[trades.length - 1]
  const isWin = (last.pnl ?? 0) > 0
  let streak = 0
  for (let i = trades.length - 1; i >= 0; i--) {
    if (((trades[i].pnl ?? 0) > 0) === isWin) {
      streak++
    } else break
  }
  return isWin ? streak : -streak
}
