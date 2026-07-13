'use client'

import { Plus, Trash2 } from 'lucide-react'
import { ChecklistItemType } from '@/types/checklist'

export interface EditableItem {
  id?: string
  label: string
  type: ChecklistItemType
}

interface Props {
  items: EditableItem[]
  onChange: (items: EditableItem[]) => void
}

export default function ChecklistItemEditor({ items, onChange }: Props) {
  function updateLabel(index: number, label: string) {
    onChange(items.map((it, i) => (i === index ? { ...it, label } : it)))
  }

  function toggleType(index: number) {
    onChange(items.map((it, i) =>
      i === index ? { ...it, type: it.type === 'boolean' ? 'scale' : 'boolean' } : it
    ))
  }

  function addItem() {
    onChange([...items, { label: '', type: 'boolean' }])
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index))
  }

  const inputStyle = {
    background: 'var(--surface-3)',
    border: '1px solid var(--border)',
    color: 'var(--text-1)',
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, index) => (
        <div key={item.id ?? index} className="flex items-center gap-2">
          <input
            type="text"
            value={item.label}
            onChange={e => updateLabel(index, e.target.value)}
            placeholder={`Punkt ${index + 1}`}
            className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
            style={inputStyle}
          />
          <button
            type="button"
            onClick={() => toggleType(index)}
            className="px-2 py-1.5 rounded-md text-xs font-medium cursor-pointer shrink-0"
            style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
          >
            {item.type === 'scale' ? 'Skala 1-5' : 'Checkbox'}
          </button>
          <button
            type="button"
            onClick={() => removeItem(index)}
            className="w-7 h-7 flex items-center justify-center rounded-md cursor-pointer shrink-0"
            style={{ color: 'var(--text-3)', background: 'var(--surface-2)' }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium cursor-pointer self-start"
        style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent)' }}
      >
        <Plus size={11} />
        Punkt hinzufügen
      </button>
    </div>
  )
}
