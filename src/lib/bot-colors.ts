import { BotEntry } from '@/types/bot'

export const BOT_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#22c55e', // green
  '#f59e0b', // amber
  '#a855f7', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#84cc16', // lime
  '#eab308', // yellow
  '#64748b', // slate
]

export function getBotColor(botId: string | null | undefined, bots: BotEntry[]): string {
  if (!botId) return '#6b7280'
  const idx = bots.findIndex(b => b.id === botId)
  return BOT_COLORS[(idx >= 0 ? idx : 0) % BOT_COLORS.length]
}
