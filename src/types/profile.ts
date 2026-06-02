import {
  TrendingUp, TrendingDown, CandlestickChart, BarChart2,
  Activity, DollarSign, Wallet, Target, Zap,
} from 'lucide-react'

export type ProfileType = 'live' | 'demo'
export type Currency = 'EUR' | 'USD' | 'GBP' | 'CHF' | 'USDT'

export interface Deposit {
  id: string
  date: string
  amount: number
  note?: string
}

export interface Profile {
  id: string
  name: string
  type: ProfileType
  broker: string
  startCapital: number
  currency: Currency
  color: string
  icon?: string
  createdAt: string
  notes?: string
  deposits?: Deposit[]
  isDemo?: boolean
}

export interface ActiveProfile {
  profileId: string
}

export const PROFILE_COLORS = [
  '#3b82f6', // blau
  '#00d97e', // grün
  '#f59e0b', // amber
  '#a855f7', // lila
  '#ef4444', // rot
  '#06b6d4', // cyan
]

export const PROFILE_ICON_MAP = {
  TrendingUp,
  TrendingDown,
  CandlestickChart,
  BarChart2,
  Activity,
  DollarSign,
  Wallet,
  Target,
  Zap,
} as const

export const PROFILE_ICONS = Object.keys(PROFILE_ICON_MAP) as (keyof typeof PROFILE_ICON_MAP)[]
