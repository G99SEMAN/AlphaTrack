'use client'

import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { FlaskConical, Plus } from 'lucide-react'
import ProfileSetupModal from '@/components/profile/ProfileSetupModal'

export default function DemoBanner() {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <div
        className="flex items-center justify-between gap-4 px-4 py-2 rounded-xl mb-5"
        style={{
          background: 'rgba(6,214,160,0.07)',
          border: '1px solid rgba(6,214,160,0.2)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <FlaskConical size={14} style={{ color: '#06d6a0', flexShrink: 0 }} />
          <span className="text-sm" style={{ color: 'var(--text-2)' }}>
            <span className="font-semibold" style={{ color: '#06d6a0' }}>Demo-Modus</span>
            {' '}&ndash; Du siehst Beispiel-Daten.
          </span>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 cursor-pointer transition-opacity hover:opacity-80"
          style={{ background: '#06d6a0', color: '#000' }}
        >
          <Plus size={12} />
          Eigenes Profil
        </button>
      </div>

      <AnimatePresence>
        {showModal && <ProfileSetupModal onClose={() => setShowModal(false)} />}
      </AnimatePresence>
    </>
  )
}
