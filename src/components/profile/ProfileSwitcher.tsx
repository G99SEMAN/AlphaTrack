'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Profile, PROFILE_ICON_MAP } from '@/types/profile'
import { switchProfileAction, deleteProfileAction } from '@/lib/actions'
import { ChevronsUpDown, Plus, Check, Banknote, Gamepad2, Trash2, AlertTriangle } from 'lucide-react'
import ProfileSetupModal from './ProfileSetupModal'

interface Props {
  profiles: Profile[]
  activeProfile: Profile | null
}

export default function ProfileSwitcher({ profiles, activeProfile }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<Profile | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [mounted, setMounted] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (deleteConfirm) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [deleteConfirm])

  async function handleDelete() {
    if (!deleteConfirm) return
    const id = deleteConfirm.id
    setDeleteConfirm(null)
    setOpen(false)
    setDeleting(true)
    try {
      await deleteProfileAction(id)
      router.refresh()
    } finally {
      setDeleting(false)
    }
  }

  if (!activeProfile) return null

  const TypeIcon = activeProfile.type === 'live' ? Banknote : Gamepad2

  return (
    <>
      <div ref={ref} className="relative">

        {/* Aktives Profil - Trigger */}
        <button
          onClick={() => setOpen(v => !v)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all"
          style={{
            background: 'var(--surface-2)',
            border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`,
          }}
        >
          {/* Farb-Avatar */}
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
            style={{ background: activeProfile.color }}
          >
            {activeProfile.icon && PROFILE_ICON_MAP[activeProfile.icon as keyof typeof PROFILE_ICON_MAP]
              ? (() => { const I = PROFILE_ICON_MAP[activeProfile.icon as keyof typeof PROFILE_ICON_MAP]; return <I size={16} color="#fff" /> })()
              : activeProfile.name.charAt(0).toUpperCase()
            }
          </div>

          {/* Name + Typ */}
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold leading-tight truncate" style={{ color: 'var(--text-1)' }}>
                {activeProfile.name}
              </p>
              {activeProfile.isDemo && (
                <span
                  className="text-xs font-semibold px-1.5 py-0.5 rounded shrink-0"
                  style={{ background: 'rgba(6,214,160,0.12)', color: '#06d6a0', border: '1px solid rgba(6,214,160,0.25)', fontSize: 10 }}
                >
                  Demo
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <TypeIcon
                size={11}
                style={{ color: activeProfile.type === 'live' ? 'var(--green)' : 'var(--accent)', flexShrink: 0 }}
              />
              <span className="text-xs truncate" style={{ color: 'var(--text-2)' }}>
                {activeProfile.type === 'live' ? 'Echtgeld' : 'Spielgeld'} · {activeProfile.broker}
              </span>
            </div>
          </div>

          <ChevronsUpDown size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
        </button>

        {/* Dropdown */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={{ duration: 0.12 }}
              className="absolute top-full left-0 right-0 mt-1.5 rounded-xl z-50 overflow-hidden"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
              }}
            >
              {/* Profile Liste */}
              <div className="p-1.5 flex flex-col gap-0.5">
                {profiles.map(profile => {
                  const isActive = profile.id === activeProfile.id
                  const PIcon = profile.type === 'live' ? Banknote : Gamepad2
                  return (
                    <div key={profile.id} className="group flex items-center gap-1">
                      <form action={switchProfileAction.bind(null, profile.id)} className="flex-1 min-w-0">
                        <button
                          type="submit"
                          className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg cursor-pointer transition-all text-left"
                          style={{
                            background: isActive ? 'var(--accent-bg)' : 'transparent',
                          }}
                          onMouseEnter={e => {
                            if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)'
                          }}
                          onMouseLeave={e => {
                            if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                          }}
                          onClick={() => setOpen(false)}
                        >
                          <div
                            className="w-7 h-7 rounded-md flex items-center justify-center text-white text-xs font-bold shrink-0"
                            style={{ background: profile.color }}
                          >
                            {profile.icon && PROFILE_ICON_MAP[profile.icon as keyof typeof PROFILE_ICON_MAP]
                              ? (() => { const I = PROFILE_ICON_MAP[profile.icon as keyof typeof PROFILE_ICON_MAP]; return <I size={13} color="#fff" /> })()
                              : profile.name.charAt(0).toUpperCase()
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-sm font-medium leading-tight truncate"
                              style={{ color: isActive ? 'var(--accent)' : 'var(--text-1)' }}
                            >
                              {profile.name}
                            </p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <PIcon
                                size={10}
                                style={{ color: profile.type === 'live' ? 'var(--green)' : 'var(--accent)', flexShrink: 0 }}
                              />
                              <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>
                                {profile.broker} · {profile.startCapital.toLocaleString('de-DE')} {profile.currency}
                              </p>
                            </div>
                          </div>
                          {isActive && <Check size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                        </button>
                      </form>
                      <button
                        onClick={e => { e.stopPropagation(); setDeleteConfirm(profile) }}
                        className="shrink-0 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                        style={{ color: 'var(--text-3)' }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'
                          ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.1)'
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-3)'
                          ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                        }}
                        title="Profil löschen"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )
                })}
              </div>

              {/* Trennlinie + Neues Profil */}
              <div style={{ borderTop: '1px solid var(--border)' }}>
                <button
                  onClick={() => { setOpen(false); setShowModal(true) }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 cursor-pointer transition-all"
                  style={{ color: 'var(--text-2)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                >
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                    style={{ background: 'var(--surface-3)', border: '1px dashed var(--border)' }}
                  >
                    <Plus size={13} style={{ color: 'var(--text-2)' }} />
                  </div>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
                    Neues Profil erstellen
                  </span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showModal && <ProfileSetupModal onClose={() => setShowModal(false)} />}
      </AnimatePresence>

      {/* Bestätigungs-Dialog - AnimatePresence INNERHALB des Portals */}
      {mounted && createPortal(
        <AnimatePresence>
          {deleteConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 8 }}
                transition={{ duration: 0.15 }}
                className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
                }}
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(239,68,68,0.15)' }}>
                    <AlertTriangle size={20} style={{ color: '#ef4444' }} />
                  </div>
                  <div>
                    <p className="text-base font-semibold" style={{ color: 'var(--text-1)' }}>
                      Profil löschen?
                    </p>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>
                      Das Profil <span className="font-semibold" style={{ color: 'var(--text-1)' }}>"{deleteConfirm.name}"</span> und alle zugehörigen Trades werden unwiderruflich gelöscht.
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    disabled={deleting}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                    style={{ background: 'var(--surface-2)', color: 'var(--text-1)', border: '1px solid var(--border)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-3)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)' }}
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2"
                    style={{ background: '#ef4444', color: '#fff', opacity: deleting ? 0.6 : 1 }}
                    onMouseEnter={e => { if (!deleting) (e.currentTarget as HTMLButtonElement).style.background = '#dc2626' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#ef4444' }}
                  >
                    <Trash2 size={14} />
                    {deleting ? 'Wird gelöscht...' : 'Löschen'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
