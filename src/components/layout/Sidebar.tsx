'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, BookOpen, BarChart2, Settings, Menu, X, Target,
  Pencil, CalendarDays, Bot, Activity, ScrollText, SlidersHorizontal,
  Sparkles, ShieldCheck, ShieldOff, Network,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import LogoMark from './LogoMark'
import MarketSessions from './MarketSessions'
import BottomNav from './BottomNav'
import ProfileSwitcher from '@/components/profile/ProfileSwitcher'
import ProfileEditModal from '@/components/profile/ProfileEditModal'
import EinstellungenModal from '@/components/einstellungen/EinstellungenModal'
import SidebarBridgeStatus from '@/components/bridge/SidebarBridgeStatus'
import { Profile } from '@/types/profile'
import { useTradingLock } from '@/context/TradingLockContext'

const NAV = [
  { href: '/dashboard',             label: 'Dashboard',      icon: LayoutDashboard },
  { href: '/journal',               label: 'Trades',         icon: BookOpen },
  { href: '/strategien',            label: 'Strategien',     icon: Target },
  { href: '/statistiken',           label: 'Statistiken',    icon: BarChart2 },
  { href: '/kalender',              label: 'Kalender',       icon: CalendarDays },
  { href: '/bots',                  label: 'Bots',           icon: Bot },
  { href: '/netzwerk',              label: 'Netzwerk',       icon: Network },
]

const BOT_NAV = [
  { href: '/bridge',             label: 'Bridge',          icon: Bot },
  { href: '/bridge/trades',      label: 'Live Trades',     icon: Activity },
  { href: '/bridge/analyse',     label: 'Trade Analyzer',  icon: Sparkles },
  { href: '/bridge/performance', label: 'Performance',     icon: BarChart2 },
  { href: '/bridge/log',         label: 'Bridge Log',      icon: ScrollText },
  { href: '/bridge/settings',    label: 'Bridge Settings', icon: SlidersHorizontal },
]

interface Props {
  profiles: Profile[]
  activeProfile: Profile | null
}

function SidebarInner({ profiles, activeProfile, onNav, compact = false }: Props & { onNav?: () => void; compact?: boolean }) {
  const pathname = usePathname()
  const [showEdit, setShowEdit] = useState(false)
  const [showEinstellungen, setShowEinstellungen] = useState(false)
const { isUnlocked, toggle } = useTradingLock()

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Logo + Schutzschalter */}
      <div
        className="flex items-center gap-3 px-4 py-4"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <LogoMark size={44} className="shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold leading-tight tracking-tight" style={{ color: 'var(--text-1)' }}>
            AlphaTrack
          </p>
          <p className="text-[10px] leading-[1.1] tracking-widest uppercase" style={{ color: 'var(--text-3)' }}>
            Trading Journal
          </p>
        </div>
        <button
          type="button"
          title={isUnlocked ? 'Trading sperren' : 'Trading entsperren'}
          onClick={toggle}
          className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all"
          style={isUnlocked ? {
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.35)',
            color: '#ef4444',
          } : {
            background: 'rgba(0,217,126,0.15)',
            border: '1px solid rgba(0,217,126,0.4)',
            color: '#00d97e',
            boxShadow: '0 0 8px rgba(0,217,126,0.2)',
          }}
        >
          {isUnlocked
            ? <ShieldOff size={15} strokeWidth={2} />
            : <ShieldCheck size={15} strokeWidth={2.5} />
          }
        </button>
      </div>

      {/* Hinweis wenn Trading aktiv */}
      {isUnlocked && (
        <div
          className="mx-3 mt-2 rounded-lg px-3 py-2"
          style={{
            background: 'rgba(239,68,68,0.06)',
            border: '1px solid rgba(239,68,68,0.2)',
          }}
        >
          <p className="text-xs" style={{ color: '#ef4444' }}>
            Trading aktiv!
          </p>
        </div>
      )}

      {/* Profil-Bereich */}
      <div className="px-3 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-1 mb-2">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
            Aktives Profil
          </p>
          {activeProfile && (
            <button
              onClick={() => setShowEdit(true)}
              className="w-5 h-5 flex items-center justify-center rounded cursor-pointer transition-colors"
              style={{ color: 'var(--text-3)' }}
              title="Profil bearbeiten"
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-1)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
            >
              <Pencil size={11} />
            </button>
          )}
        </div>
        <ProfileSwitcher profiles={profiles} activeProfile={activeProfile} />
      </div>

      {showEdit && activeProfile && (
        <ProfileEditModal profile={activeProfile} onClose={() => setShowEdit(false)} />
      )}

      {/* Hauptnavigation */}
      <nav className="flex-1 px-3 py-3 flex flex-col gap-0.5 overflow-y-auto min-h-0">
        <p className="text-xs font-semibold uppercase tracking-wider px-2 mb-1" style={{ color: 'var(--text-3)' }}>
          Navigation
        </p>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && href !== '/bots' && pathname.startsWith(href + '/')) || (href === '/bots' && (pathname === '/bots' || pathname.startsWith('/bots/')))
          return (
            <Link
              key={href}
              href={href}
              onClick={onNav}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: active ? 'var(--accent-bg)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-1)',
              }}
            >
              <Icon size={16} strokeWidth={active ? 2.5 : 2} style={{ opacity: active ? 1 : 0.6 }} />
              {label}
            </Link>
          )
        })}

        {/* Bridge Sektion */}
        <p className="text-xs font-semibold uppercase tracking-wider px-2 mt-3 mb-1" style={{ color: 'var(--text-3)' }}>
          Bridge
        </p>
        {BOT_NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/bridge' && !pathname.startsWith('/bots') && pathname.startsWith(href + '/'))
          return (
            <Link
              key={href}
              href={href}
              onClick={onNav}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: active ? 'var(--accent-bg)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-1)',
              }}
            >
              <Icon size={16} strokeWidth={active ? 2.5 : 2} style={{ opacity: active ? 1 : 0.6 }} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Börsen Sessions */}
      <MarketSessions compact={compact} />

      {/* Einstellungen */}
      <div className="px-3 pb-2">
        <button
          onClick={() => { setShowEinstellungen(true); onNav?.() }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
          style={{
            background: 'rgba(249,115,22,0.07)',
            color: '#fb923c',
            border: '1px solid rgba(249,115,22,0.2)',
          }}
        >
          <Settings size={13} style={{ opacity: 0.85 }} />
          Einstellungen
        </button>
      </div>

      {showEinstellungen && (
        <EinstellungenModal profiles={profiles} onClose={() => setShowEinstellungen(false)} />
      )}

      {/* Footer: Bridge-Status */}
      <div className="px-3 pb-3 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
        <SidebarBridgeStatus />
      </div>

    </div>
  )
}

export default function Sidebar({ profiles, activeProfile }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className="hidden md:flex flex-col w-56 shrink-0 h-screen sticky top-0"
        style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
      >
        <SidebarInner profiles={profiles} activeProfile={activeProfile} />
      </aside>

      {/* Mobile Header */}
      <header
        className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4"
        style={{
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))',
          paddingBottom: '0.75rem',
        }}
      >
        <div className="flex items-center gap-2.5">
          <LogoMark size={34} className="shrink-0" />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
            AlphaTrack
          </span>
        </div>
        <button
          onClick={() => setMobileOpen(v => !v)}
          className="w-9 h-9 flex items-center justify-center rounded-lg cursor-pointer"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
        >
          {mobileOpen ? <X size={16} /> : <Menu size={16} />}
        </button>
      </header>

      {/* Mobile Bottom Navigation */}
      <BottomNav />

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 z-30"
              style={{ background: 'rgba(0,0,0,0.6)' }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -224 }}
              animate={{ x: 0 }}
              exit={{ x: -224 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="md:hidden fixed left-0 top-0 bottom-0 w-56 z-40"
              style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
            >
              <SidebarInner
                profiles={profiles}
                activeProfile={activeProfile}
                onNav={() => setMobileOpen(false)}
                compact
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
