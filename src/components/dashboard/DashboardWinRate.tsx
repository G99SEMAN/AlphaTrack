'use client'

import WinRateCard from './WinRateCard'

interface Props {
  winRate: number
  totalTrades: number
  openTrades: number
  currentStreak: number
}

export default function DashboardWinRate({ winRate, totalTrades, openTrades, currentStreak }: Props) {
  return (
    <WinRateCard
      winRate={winRate}
      totalTrades={totalTrades}
      openTrades={openTrades}
      currentStreak={currentStreak}
    />
  )
}
