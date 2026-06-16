import { Trade } from '@/types/trade'

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

export function normalizeTrade(raw: Record<string, unknown>): Omit<Trade, 'id'> {
  const { bot_id, botId, ...rest } = raw as Record<string, unknown> & { bot_id?: string | null; botId?: string | null }
  const resolvedBotId = botId ?? bot_id ?? null
  const sourceId = resolvedBotId !== null ? resolvedBotId : 'bridge/tradeexecuter'
  return { ...rest, botId: resolvedBotId, sourceId } as unknown as Omit<Trade, 'id'>
}
