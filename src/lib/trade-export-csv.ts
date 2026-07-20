import { Trade } from '@/types/trade'
import { Strategy } from '@/types/strategy'
import { BotEntry } from '@/types/bot'
import { resolveBotLabel } from '@/lib/bot-source'

const CSV_HEADERS = [
  'Datum', 'Schlussdatum', 'Instrument', 'Typ', 'Status', 'Entry', 'Exit', 'Size',
  'TP', 'SL', 'P&L', 'Kommission', 'Swap', 'Spread', 'Netto-Ergebnis', 'RR', 'Strategie', 'Quelle', 'Tags', 'Notizen',
]

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function statusLabel(status: Trade['status']): string {
  if (status === 'open') return 'Offen'
  if (status === 'cancelled') return 'Storniert'
  return 'Geschlossen'
}

export function buildTradeCsv(trades: Trade[], bots: BotEntry[], strategies: Strategy[]): string {
  const rows = trades.map(t => {
    const netto = t.pnl !== undefined
      ? t.pnl - (t.commission ?? 0) - (t.swap ?? 0) - (t.spreadCost ?? 0)
      : undefined
    const strategyName = strategies.find(s => s.id === t.strategyId)?.name ?? ''
    const quelle = resolveBotLabel(t.sourceId, bots) ?? ''

    const fields = [
      t.date,
      t.closeTime ?? '',
      t.instrument,
      t.type === 'long' ? 'Long' : 'Short',
      statusLabel(t.status),
      String(t.entry),
      t.exit !== undefined ? String(t.exit) : '',
      String(t.size),
      t.tp !== undefined ? String(t.tp) : '',
      t.sl !== undefined ? String(t.sl) : '',
      t.pnl !== undefined ? t.pnl.toFixed(2) : '',
      t.commission !== undefined ? t.commission.toFixed(2) : '',
      t.swap !== undefined ? t.swap.toFixed(2) : '',
      t.spreadCost !== undefined ? t.spreadCost.toFixed(2) : '',
      netto !== undefined ? netto.toFixed(2) : '',
      t.rr !== undefined ? String(t.rr) : '',
      strategyName,
      quelle,
      (t.tags ?? []).join(';'),
      t.notes ?? '',
    ]
    return fields.map(v => csvEscape(v)).join(',')
  })

  const BOM = '﻿'
  return BOM + [CSV_HEADERS.join(','), ...rows].join('\r\n')
}
