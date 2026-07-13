'use client'

import { useEffect, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { X, Loader2 } from 'lucide-react'
import { ChecklistConfig } from '@/types/checklist'
import { saveChecklistConfigAction } from '@/lib/actions'
import ChecklistItemEditor, { EditableItem } from './ChecklistItemEditor'

interface Props {
  config: ChecklistConfig
  onClose: () => void
}

export default function ChecklistModal({ config, onClose }: Props) {
  const [mounted, setMounted] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [items, setItems] = useState<EditableItem[]>(
    config.items.map(i => ({ id: i.id, label: i.label, type: i.type }))
  )

  useEffect(() => {
    setMounted(true)
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])
  if (!mounted) return null

  function handleSave() {
    const fd = new FormData()
    fd.set('items', JSON.stringify(items.filter(i => i.label.trim())))
    startTransition(async () => {
      await saveChecklistConfigAction(fd)
      onClose()
    })
  }

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.8)', zIndex: 9999 }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.18 }}
        onClick={e => e.stopPropagation()}
        className="relative w-full my-auto"
        style={{ maxWidth: 520 }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 rounded-t-xl"
          style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
        >
          <h2 className="text-base font-bold" style={{ color: 'var(--text-1)' }}>
            Checklist-Punkte bearbeiten
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer"
            style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}
          >
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4 rounded-b-xl" style={{ background: 'var(--surface)' }}>
          <ChecklistItemEditor items={items} onChange={setItems} />

          <div
            className="flex items-center justify-end gap-2 mt-4 pt-3.5"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
              style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
            >
              Abbrechen
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold cursor-pointer"
              style={{
                background: isPending ? 'var(--accent-bg)' : 'var(--accent)',
                color: isPending ? 'var(--accent)' : '#fff',
                border: '1px solid var(--accent)',
              }}
            >
              {isPending && <Loader2 size={14} className="animate-spin" />}
              Speichern
            </button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  )
}
