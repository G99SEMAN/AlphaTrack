import { BotEntry } from '@/types/bot'

export const BOT_COLORS = ['#3b82f6', '#a855f7', '#f59e0b', '#06b6d4', '#ec4899', '#84cc16']

export function getBotColor(botId: string | null | undefined, bots: BotEntry[]): string {
  if (!botId) return '#6b7280'
  const idx = bots.findIndex(b => b.id === botId)
  return BOT_COLORS[(idx >= 0 ? idx : 0) % BOT_COLORS.length]
}
