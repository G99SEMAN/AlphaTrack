import { useTranslations } from 'next-intl'

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

export const TIMEFRAME_KEYS: Timeframe[] = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN']

export function getTimeframeLabels(t: ReturnType<typeof useTranslations<'strategien.timeframes'>>): Record<Timeframe, string> {
  return {
    M1: t('m1'),
    M5: t('m5'),
    M15: t('m15'),
    M30: t('m30'),
    H1: t('h1'),
    H4: t('h4'),
    D1: t('d1'),
    W1: t('w1'),
    MN: t('mn'),
  }
}
