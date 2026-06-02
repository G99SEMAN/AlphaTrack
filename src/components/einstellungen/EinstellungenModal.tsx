'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { X, Settings } from 'lucide-react'
import EinstellungenClient from './EinstellungenClient'
import { Profile } from '@/types/profile'

interface Props {
  profiles: Profile[]
  onClose: () => void
}

export default function EinstellungenModal({ profiles, onClose }: Props) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 flex items-start justify-center p-4 pt-12 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.75)', zIndex: 9999 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.2 }}
        onClick={e => e.stopPropagation()}
        className="relative w-full mb-12"
        style={{ maxWidth: 600 }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 rounded-t-xl"
          style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2.5">
            <Settings size={15} style={{ color: 'var(--text-3)' }} />
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>Einstellungen</p>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                Erscheinungsbild anpassen und Daten sichern oder wiederherstellen.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-colors"
            style={{ background: 'var(--surface-2)', color: 'var(--text-3)', border: '1px solid var(--border)' }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div
          className="px-5 py-5 rounded-b-xl"
          style={{ background: 'var(--surface)' }}
        >
          <EinstellungenClient profiles={profiles} />
        </div>
      </motion.div>
    </div>,
    document.body
  )
}
