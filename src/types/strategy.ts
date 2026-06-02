export type Timeframe = 'M1' | 'M5' | 'M15' | 'M30' | 'H1' | 'H4' | 'D1' | 'W1' | 'MN'

export interface Strategy {
  id: string
  name: string
  description: string
  timeframe: Timeframe
  rules: string[]
  notes: string
  riskPerTrade: number
  color: string
  createdAt: string
}

export function normalizeRules(rules: unknown): string[] {
  if (Array.isArray(rules)) return rules as string[]
  if (typeof rules === 'string' && rules.trim()) return [rules]
  return []
}

export const STRATEGY_COLORS = [
  '#3b82f6',
  '#00d97e',
  '#f59e0b',
  '#a855f7',
  '#ef4444',
  '#06b6d4',
  '#f97316',
  '#ec4899',
]

export const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  M1:  '1 Minute',
  M5:  '5 Minuten',
  M15: '15 Minuten',
  M30: '30 Minuten',
  H1:  '1 Stunde',
  H4:  '4 Stunden',
  D1:  'Daily',
  W1:  'Weekly',
  MN:  'Monthly',
}
