export type TradeDirection = 'long' | 'short'
export type TradeStatus = 'open' | 'closed' | 'cancelled'

export interface Trade {
  id: string
  date: string
  closeTime?: string
  instrument: string
  type: TradeDirection
  entry: number
  exit?: number
  size: number
  tp?: number
  sl?: number
  pnl?: number
  commission?: number
  swap?: number
  spreadCost?: number
  rr?: number
  status: TradeStatus
  notes?: string
  tags?: string[]
  screenshot?: string
  strategyId?: string
  externalId?: string
  outcome?: 'win' | 'loss'
  botId?: string | null
  sourceId?: string
}

export interface TradeStats {
  totalPnl: number
  monthlyPnl: number
  dailyPnl: number
  netPnl: number
  netMonthlyPnl: number
  netDailyPnl: number
  totalCosts: number
  totalCommission: number
  totalSwap: number
  winRate: number
  totalTrades: number
  openTrades: number
  avgRR: number
  maxDrawdown: number
  currentStreak: number
  equityCurve: { date: string; value: number }[]
  profitFactor: number
  avgWin: number
  avgLoss: number
}
