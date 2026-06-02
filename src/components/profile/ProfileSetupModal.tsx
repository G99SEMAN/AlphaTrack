'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import ProfileSetupForm from './ProfileSetupForm'

interface Props { onClose: () => void }

export default function ProfileSetupModal({ onClose }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])
  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', zIndex: 9999 }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.2 }}
        onClick={e => e.stopPropagation()}
        className="relative w-full"
        style={{ maxWidth: 480 }}
      >
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 flex items-center gap-1.5 text-xs cursor-pointer"
          style={{ color: 'rgba(255,255,255,0.6)' }}
        >
          <X size={14} /> Schliessen
        </button>
        <ProfileSetupForm onClose={onClose} />
      </motion.div>
    </div>,
    document.body
  )
}
