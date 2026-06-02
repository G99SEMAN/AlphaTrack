'use client'

import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Plus } from 'lucide-react'
import ProfileSetupModal from '@/components/profile/ProfileSetupModal'

export default function DemoProfileCard() {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <div
        className="rounded-2xl p-6 flex items-center justify-between gap-6 mb-6"
        style={{
          background: 'linear-gradient(135deg, rgba(6,214,160,0.08) 0%, rgba(0,229,255,0.05) 100%)',
          border: '1px solid rgba(6,214,160,0.25)',
        }}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'rgba(6,214,160,0.7)' }}>
            Demo-Modus aktiv
          </p>
          <h3 className="text-base font-bold mb-1" style={{ color: 'var(--text-1)' }}>
            Starte mit deinem eigenen Profil
          </h3>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>
            Du siehst gerade Beispiel-Daten. Erstelle ein eigenes Profil um deine Trades zu verfolgen.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold shrink-0 cursor-pointer transition-opacity hover:opacity-90"
          style={{ background: '#06d6a0', color: '#000' }}
        >
          <Plus size={15} />
          Profil erstellen
        </button>
      </div>

      <AnimatePresence>
        {showModal && <ProfileSetupModal onClose={() => setShowModal(false)} />}
      </AnimatePresence>
    </>
  )
}
