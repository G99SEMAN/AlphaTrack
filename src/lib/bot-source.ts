// Sentinel-Werte für sourceId/botId ohne echte Bot-Zuordnung.
// 'bridge/tradeexecuter': manuell über den Trade Executor in AlphaTrack ausgeführt.
// 'manual/mt5': keinerlei Zuordnung möglich (z.B. Trade direkt in MT5 eröffnet).
export const TRADE_EXECUTOR_SOURCE_ID = 'bridge/tradeexecuter'
export const MANUAL_MT5_SOURCE_ID = 'manual/mt5'

export function resolveBotLabel(
  sourceId: string | null | undefined,
  bots: { id: string; name: string }[]
): string | undefined {
  // undefined: Feld fehlt ganz (z.B. Alt-Trades vor Einfuehrung der Zuordnung) -> kein Tag.
  // null: Feld ist bewusst leer (z.B. offene Position ohne Ticket-Registry-Eintrag) -> "Manuell/MT5".
  if (sourceId === undefined) return undefined
  if (sourceId === null || sourceId === MANUAL_MT5_SOURCE_ID) return 'Manuell/MT5'
  if (sourceId === TRADE_EXECUTOR_SOURCE_ID) return 'Trade Executor'
  return bots.find(b => b.id === sourceId)?.name ?? 'Bot'
}
