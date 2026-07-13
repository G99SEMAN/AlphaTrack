'use client'

import { useState, useTransition } from 'react'
import { ChecklistConfig, ChecklistLog, ChecklistItemType } from '@/types/checklist'
import { saveChecklistConfigAction, saveChecklistEntryAction } from '@/lib/actions'
import { toLocalDateStr } from '@/lib/checklist-date'
import ChecklistItemEditor, { EditableItem } from './ChecklistItemEditor'
import ChecklistModal from './ChecklistModal'
import FreezeDayModal from './FreezeDayModal'
import { SlidersHorizontal, Snowflake } from 'lucide-react'

interface Props {
  config: ChecklistConfig | null
  log: ChecklistLog
  streak: number
  lifetime: number
  defaultItems: { label: string; type: ChecklistItemType }[]
}

export default function ChecklistClient({ config, log, streak, lifetime, defaultItems }: Props) {
  const [isPending, startTransition] = useTransition()
  const [setupItems, setSetupItems] = useState<EditableItem[]>(() => defaultItems.map(i => ({ ...i })))
  const today = toLocalDateStr()
  const todayEntry = log.entries.find(e => e.date === today)
  const [values, setValues] = useState<Record<string, boolean | number>>(todayEntry?.values ?? {})
  const [showEditor, setShowEditor] = useState(false)
  const [showFreeze, setShowFreeze] = useState(false)

  if (!config) {
    function activate() {
      const fd = new FormData()
      fd.set('items', JSON.stringify(setupItems))
      startTransition(async () => { await saveChecklistConfigAction(fd) })
    }

    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm" style={{ color: 'var(--text-2)' }}>
          Richte deine tägliche Checkliste ein. Passe die vorgeschlagenen Punkte an oder übernimm sie so — du kannst sie jederzeit später ändern.
        </p>
        <ChecklistItemEditor items={setupItems} onChange={setSetupItems} />
        <button
          type="button"
          onClick={activate}
          disabled={isPending}
          className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer self-start"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          Checkliste aktivieren
        </button>
      </div>
    )
  }

  function saveValue(itemId: string, value: boolean | number) {
    const next = { ...values, [itemId]: value }
    setValues(next)
    const fd = new FormData()
    fd.set('date', today)
    fd.set('values', JSON.stringify(next))
    startTransition(async () => { await saveChecklistEntryAction(fd) })
  }

  const sortedItems = [...config.items].sort((a, b) => a.order - b.order)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <span style={{ color: 'var(--text-1)', fontWeight: 700 }}>🔥 {streak} {streak === 1 ? 'Tag' : 'Tage'} Streak</span>
          <span style={{ color: 'var(--text-3)' }}>{lifetime} Tage insgesamt</span>
        </div>
        <button
          type="button"
          onClick={() => setShowEditor(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
          style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
        >
          <SlidersHorizontal size={13} />
          Punkte bearbeiten
        </button>
        <button
          type="button"
          onClick={() => setShowFreeze(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
          style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
        >
          <Snowflake size={13} />
          Freeze einlegen
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {sortedItems.map(item => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-3 p-3 rounded-lg"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <span style={{ color: 'var(--text-1)' }}>{item.label}</span>
            {item.type === 'boolean' ? (
              <div className="flex gap-1 shrink-0">
                {[{ v: true, label: 'Ja' }, { v: false, label: 'Nein' }].map(opt => (
                  <button
                    key={String(opt.v)}
                    type="button"
                    onClick={() => saveValue(item.id, opt.v)}
                    style={{
                      padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      background: values[item.id] === opt.v ? 'var(--accent)' : 'var(--surface-2)',
                      color: values[item.id] === opt.v ? '#fff' : 'var(--text-2)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex gap-1 shrink-0">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => saveValue(item.id, n)}
                    style={{
                      width: 28, height: 28, borderRadius: 6, cursor: 'pointer',
                      background: values[item.id] === n ? 'var(--accent)' : 'var(--surface-2)',
                      color: values[item.id] === n ? '#fff' : 'var(--text-2)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {showEditor && <ChecklistModal config={config} onClose={() => setShowEditor(false)} />}
      {showFreeze && <FreezeDayModal onClose={() => setShowFreeze(false)} />}
    </div>
  )
}
