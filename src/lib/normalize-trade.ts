import { Trade } from '@/types/trade'
import { MANUAL_MT5_SOURCE_ID } from '@/lib/bot-source'

export function isValidRawTrade(raw: Record<string, unknown>): boolean {
  return (
    typeof raw.date === 'string' &&
    typeof raw.instrument === 'string' &&
    (raw.type === 'long' || raw.type === 'short') &&
    typeof raw.entry === 'number' &&
    typeof raw.size === 'number' &&
    (raw.status === 'open' || raw.status === 'closed' || raw.status === 'cancelled')
  )
}

// Python sends snake_case bot_id; TypeScript stores as botId. Trades without bot attribution (bridge sync) receive botId: null.
export function normalizeTrade(raw: Record<string, unknown>): Omit<Trade, 'id'> {
  const { bot_id, botId, ...rest } = raw as Record<string, unknown> & { bot_id?: string | null; botId?: string | null }
  const resolvedBotId = botId ?? bot_id ?? null
  const sourceId = resolvedBotId !== null ? resolvedBotId : MANUAL_MT5_SOURCE_ID
  return { ...rest, botId: resolvedBotId, sourceId } as unknown as Omit<Trade, 'id'>
}
