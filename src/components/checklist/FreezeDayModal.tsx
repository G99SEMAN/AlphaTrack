'use client'

import { useEffect, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { X, Loader2 } from 'lucide-react'
import { setChecklistFreezeAction } from '@/lib/actions'
import { toLocalDateStr } from '@/lib/checklist-date'

interface Props {
  onClose: () => void
}

export default function FreezeDayModal({ onClose }: Props) {
  const [mounted, setMounted] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [date, setDate] = useState(toLocalDateStr())

  useEffect(() => {
    setMounted(true)
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])
  if (!mounted) return null

  function confirmFreeze() {
    const fd = new FormData()
    fd.set('date', date)
    startTransition(async () => {
      await setChecklistFreezeAction(fd)
      onClose()
    })
  }

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', zIndex: 9999 }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.18 }}
        onClick={e => e.stopPropagation()}
        className="relative w-full rounded-xl"
        style={{ maxWidth: 360, background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-base font-bold" style={{ color: 'var(--text-1)' }}>Freeze einlegen</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer"
            style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}
          >
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>
            Markiere einen Tag als Pause — er zählt für den Streak als gehalten, ohne dass echte Werte eingetragen werden. Funktioniert für Vergangenheit, heute und Zukunft.
          </p>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
          />
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5" style={{ borderTop: '1px solid var(--border)' }}>
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
            onClick={confirmFreeze}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold cursor-pointer"
            style={{
              background: isPending ? 'var(--accent-bg)' : 'var(--accent)',
              color: isPending ? 'var(--accent)' : '#fff',
              border: '1px solid var(--accent)',
            }}
          >
            {isPending && <Loader2 size={14} className="animate-spin" />}
            Freeze setzen
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  )
}
