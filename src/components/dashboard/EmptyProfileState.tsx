'use client'

import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Plus, BarChart2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import ProfileSetupModal from '@/components/profile/ProfileSetupModal'

export default function EmptyProfileState() {
  const [showModal, setShowModal] = useState(false)
  const t = useTranslations('dashboard.emptyProfile')

  return (
    <>
      <div className="flex items-center justify-center min-h-[60vh]">
        <div
          className="rounded-2xl p-8 flex flex-col items-center text-center max-w-sm w-full"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
            style={{ background: 'var(--accent-bg)' }}
          >
            <BarChart2 size={26} style={{ color: 'var(--accent)' }} />
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-1)' }}>
            {t('title')}
          </h3>
          <p className="text-sm mb-6" style={{ color: 'var(--text-2)' }}>
            {t('description')}
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-opacity hover:opacity-90"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <Plus size={15} />
            {t('createButton')}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showModal && <ProfileSetupModal onClose={() => setShowModal(false)} />}
      </AnimatePresence>
    </>
  )
}
