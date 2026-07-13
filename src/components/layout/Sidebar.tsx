'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, BookOpen, BarChart2, Settings, Menu, X, Target,
  CalendarDays, Bot, Activity, ScrollText, SlidersHorizontal,
  Sparkles, ShieldCheck, ShieldOff, Network, Cpu, ListChecks,
  Eye, EyeOff, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import MarketSessions from './MarketSessions'
import BottomNav from './BottomNav'
import { Profile, PROFILE_ICON_MAP } from '@/types/profile'
import { useTradingLock } from '@/context/TradingLockContext'
import { useBotStatus } from '@/context/BotStatusContext'
import LogoMark from './LogoMark'

const UEBERSICHT_NAV = [
  { href: '/dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/journal',     label: 'Trades',       icon: BookOpen },
  { href: '/statistiken', label: 'Statistiken',  icon: BarChart2 },
  { href: '/kalender',    label: 'Kalender',     icon: CalendarDays },
  { href: '/netzwerk',    label: 'Netzwerk',     icon: Network },
]

const BRIDGE_BOTS_NAV = [
  { href: '/bridge',            label: 'Bridge',        icon: Cpu },
  { href: '/bridge/log',        label: 'Bridge Log',    icon: ScrollText },
  { href: '/bots',              label: 'Bots',          icon: Bot },
  { href: '/bots/settings',     label: 'Bot Settings',  icon: SlidersHorizontal },
  { href: '/strategien',        label: 'Strategien',    icon: Target },
  { href: '/bots/performance',  label: 'Performance',   icon: BarChart2 },
  { href: '/bridge/trades',     label: 'Live Trades',   icon: Activity },
  { href: '/bridge/analyse',    label: 'Trade Analyzer',icon: Sparkles },
]

const EXACT_MATCH = new Set(['/dashboard', '/bridge', '/bots'])

function isActive(pathname: string, href: string): boolean {
  if (EXACT_MATCH.has(href)) return pathname === href
  return pathname === href || pathname.startsWith(href + '/')
}

function NavLink({ href, label, icon: Icon, pathname, collapsed, onNav }: {
  href: string; label: string; icon: React.ElementType
  pathname: string; collapsed: boolean; onNav?: () => void
}) {
  const active = isActive(pathname, href)
  return (
    <Link
      href={href}
      onClick={onNav}
      title={collapsed ? label : undefined}
      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all relative"
      style={{
        background: active ? 'rgba(59,130,246,0.12)' : 'transparent',
        border: active ? '1px solid rgba(59,130,246,0.18)' : '1px solid transparent',
        color: active ? 'var(--accent)' : 'var(--text-2)',
        justifyContent: collapsed ? 'center' : undefined,
      }}
    >
      {active && !collapsed && (
        <span style={{
          position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
          width: 3, height: 3, borderRadius: '50%', background: 'var(--accent)',
        }} />
      )}
      <Icon
        size={15}
        strokeWidth={active ? 2.5 : 2}
        style={{ opacity: active ? 1 : 0.5, flexShrink: 0, marginLeft: active && !collapsed ? 6 : 0 }}
      />
      {!collapsed && (
        <span style={{ opacity: active ? 1 : 0.7 }}>{label}</span>
      )}
    </Link>
  )
}

function SectionDivider({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return <div style={{ height: 1, background: 'var(--border)', margin: '6px 8px' }} />
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 4px 4px', margin: '4px 0' }}>
      <div style={{ height: 1, width: 10, background: 'var(--border)' }} />
      <span style={{
        fontSize: 9, fontWeight: 700, color: 'var(--text-3)',
        textTransform: 'uppercase', letterSpacing: '0.14em', whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
    </div>
  )
}

interface Props {
  profiles: Profile[]
  activeProfile: Profile | null
}

function SidebarInner({ profiles, activeProfile, onNav, collapsed, onToggleCollapse }: Props & {
  onNav?: () => void; collapsed: boolean; onToggleCollapse?: () => void
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { isUnlocked, toggle } = useTradingLock()
  const { bots } = useBotStatus()
  const [balanceVisible, setBalanceVisible] = useState(() => {
    try { return localStorage.getItem('alphatrack-mt5-balance-visible') !== 'false' }
    catch { return true }
  })

  const [checklistStreak, setChecklistStreak] = useState(0)
  useEffect(() => {
    fetch('/api/checklist/streak')
      .then(r => r.json())
      .then(d => setChecklistStreak(d.streak ?? 0))
      .catch(() => {})
  }, [pathname])

  const bridgeBot = bots.find(b => b.bot.type === 'bridge' && b.status?.balance !== undefined)
  const mt5Balance = bridgeBot?.status?.balance
  const mt5Currency = bridgeBot?.status?.currency ?? 'USD'
  const mt5Connected = bridgeBot?.status?.connectionState === 'connected'

  function toggleBalance() {
    setBalanceVisible(v => {
      const next = !v
      try { localStorage.setItem('alphatrack-mt5-balance-visible', String(next)) } catch { /* silent */ }
      return next
    })
  }

  const avatarInitial = activeProfile?.name?.[0]?.toUpperCase() ?? 'P'
  const ProfileIconComp = activeProfile?.icon ? PROFILE_ICON_MAP[activeProfile.icon as keyof typeof PROFILE_ICON_MAP] : null

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Logo + Collapse Button */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: collapsed ? '14px 10px' : '14px 14px 12px',
          borderBottom: '1px solid var(--border)',
          justifyContent: collapsed ? 'center' : undefined,
        }}
      >
        {/* Logo Mark */}
        <LogoMark size={34} />

        {!collapsed && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
              AlphaTrack
            </p>
            <p style={{ fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Trading Journal
            </p>
          </div>
        )}

        {!collapsed && onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            style={{
              width: 22, height: 22, flexShrink: 0,
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-3)',
            }}
            title="Sidebar einklappen"
          >
            <ChevronLeft size={12} />
          </button>
        )}

        {collapsed && onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            style={{
              position: 'absolute', right: -10, top: 20,
              width: 20, height: 20,
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-3)', zIndex: 10,
            }}
            title="Sidebar ausklappen"
          >
            <ChevronRight size={10} />
          </button>
        )}
      </div>

      {/* Trading Lock Hinweis */}
      {isUnlocked && !collapsed && (
        <div style={{ margin: '8px 10px 0', padding: '6px 10px', borderRadius: 8, background: 'rgba(255,69,96,0.06)', border: '1px solid rgba(255,69,96,0.2)' }}>
          <p style={{ fontSize: 11, color: 'var(--red)' }}>Trading aktiv!</p>
        </div>
      )}

      {/* Profil-Pill */}
      {!collapsed && activeProfile && (
        <div style={{ padding: '10px 10px 8px', borderBottom: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={() => router.push('/einstellungen#profile')}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px', borderRadius: 10,
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              cursor: 'pointer', textAlign: 'left',
            }}
            title="Profile verwalten"
          >
            <div style={{
              width: 26, height: 26, flexShrink: 0,
              background: activeProfile.color ?? 'linear-gradient(135deg, #1d4ed8, #60a5fa)',
              borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: '#fff',
            }}>
              {ProfileIconComp ? <ProfileIconComp size={14} /> : avatarInitial}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {activeProfile.name}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-3)' }}>
                {activeProfile.type === 'live' ? 'Live' : 'Demo'} · {activeProfile.startCapital.toLocaleString('de-DE')} {activeProfile.currency}
              </div>
            </div>
            <Settings size={12} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
          </button>
        </div>
      )}

      {/* Collapsed: nur Avatar */}
      {collapsed && activeProfile && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
          <button
            type="button"
            title={activeProfile.name}
            onClick={() => router.push('/einstellungen#profile')}
            style={{
              width: 30, height: 30,
              background: activeProfile.color ?? 'linear-gradient(135deg, #1d4ed8, #60a5fa)',
              borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer', border: 'none',
            }}
          >
            {ProfileIconComp ? <ProfileIconComp size={15} /> : avatarInitial}
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto', minHeight: 0 }}>

        <Link
          href="/checklist"
          onClick={onNav}
          title={collapsed ? 'Daily Checklist' : undefined}
          className="flex items-center gap-2.5 px-2.5 py-2.5 mb-1 rounded-lg text-sm font-bold transition-all"
          style={{
            background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.3)',
            color: '#f59e0b',
            justifyContent: collapsed ? 'center' : 'space-between',
          }}
        >
          <span className="flex items-center gap-2">
            <ListChecks size={15} strokeWidth={2.5} />
            {!collapsed && 'Daily Checklist'}
          </span>
          {!collapsed && checklistStreak > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700 }}>🔥 {checklistStreak}</span>
          )}
        </Link>

        <SectionDivider label="Übersicht" collapsed={collapsed} />
        {UEBERSICHT_NAV.map(item => (
          <NavLink key={item.href} {...item} pathname={pathname} collapsed={collapsed} onNav={onNav} />
        ))}

        <SectionDivider label="Bridge & Bots" collapsed={collapsed} />
        {BRIDGE_BOTS_NAV.map(item => (
          <NavLink key={item.href} {...item} pathname={pathname} collapsed={collapsed} onNav={onNav} />
        ))}

      </nav>

      {/* MT5 Balance Karte */}
      {mt5Balance !== undefined && (
        <div style={{ padding: '0 8px 8px', borderTop: '1px solid var(--border)' }}>
          <div style={{
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 10, padding: collapsed ? '10px 0' : '10px 12px',
            display: 'flex', flexDirection: collapsed ? 'column' : 'row',
            alignItems: 'center', gap: collapsed ? 6 : 8,
            marginTop: 8,
            justifyContent: collapsed ? 'center' : undefined,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 6, flexDirection: collapsed ? 'column' : 'row', flex: 1, minWidth: 0 }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: mt5Connected ? 'var(--green)' : '#f59e0b',
                boxShadow: mt5Connected ? '0 0 5px var(--green)' : '0 0 5px #f59e0b',
              }} />
              {!collapsed && (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 8, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>MT5 Konto</p>
                  {balanceVisible && (
                    <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-1)', fontFamily: 'var(--font-dm-mono)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                      {mt5Balance.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      {' '}<span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-3)' }}>{mt5Currency}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
            {!collapsed && (
              <button type="button" onClick={toggleBalance} style={{ color: 'var(--text-3)', cursor: 'pointer' }} title={balanceVisible ? 'Ausblenden' : 'Einblenden'}>
                {balanceVisible ? <EyeOff size={11} /> : <Eye size={11} />}
              </button>
            )}
          </div>
        </div>
      )}

      {/* MarketSessions */}
      <MarketSessions compact={collapsed} />

      {/* Einstellungen + Trading Lock */}
      <div style={{ padding: '0 8px 10px', display: 'flex', gap: 6, flexDirection: collapsed ? 'column' : 'row', alignItems: 'center' }}>
        <button
          onClick={() => { router.push('/einstellungen'); onNav?.() }}
          style={{
            flex: collapsed ? undefined : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: collapsed ? '7px' : '7px 12px',
            borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
            background: 'rgba(249,115,22,0.07)', color: '#fb923c',
            border: '1px solid rgba(249,115,22,0.2)',
          }}
          title="Einstellungen"
        >
          <Settings size={13} style={{ opacity: 0.85 }} />
          {!collapsed && 'Einstellungen'}
        </button>

        <button
          type="button"
          title={isUnlocked ? 'Trading sperren' : 'Trading entsperren'}
          onClick={toggle}
          style={{
            width: 30, height: 30, flexShrink: 0,
            borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            ...(isUnlocked ? {
              background: 'rgba(255,69,96,0.12)', border: '1px solid rgba(255,69,96,0.35)', color: 'var(--red)',
            } : {
              background: 'rgba(0,217,126,0.12)', border: '1px solid rgba(0,217,126,0.35)', color: 'var(--green)',
              boxShadow: '0 0 8px rgba(0,217,126,0.15)',
            }),
          }}
        >
          {isUnlocked ? <ShieldOff size={14} strokeWidth={2} /> : <ShieldCheck size={14} strokeWidth={2.5} />}
        </button>
      </div>

    </div>
  )
}

export default function Sidebar({ profiles, activeProfile }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('alphatrack-sidebar-collapsed') === 'true' }
    catch { return false }
  })

  function toggleCollapse() {
    setCollapsed(v => {
      const next = !v
      try { localStorage.setItem('alphatrack-sidebar-collapsed', String(next)) } catch { /* silent */ }
      return next
    })
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <motion.aside
        className="hidden md:flex flex-col shrink-0 h-screen sticky top-0"
        animate={{ width: collapsed ? 52 : 224 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        style={{
          background: 'var(--surface)', borderRight: '1px solid var(--border)',
          overflow: 'visible',
        }}
      >
        <SidebarInner
          profiles={profiles}
          activeProfile={activeProfile}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
        />
      </motion.aside>

      {/* Mobile Header */}
      <header
        className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4"
        style={{
          background: 'var(--surface)', borderBottom: '1px solid var(--border)',
          paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))',
          paddingBottom: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LogoMark size={30} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>AlphaTrack</span>
        </div>
        <button
          onClick={() => setMobileOpen(v => !v)}
          style={{
            width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 8, cursor: 'pointer',
            background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-2)',
          }}
        >
          {mobileOpen ? <X size={16} /> : <Menu size={16} />}
        </button>
      </header>

      <BottomNav />

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 z-30"
              style={{ background: 'rgba(0,0,0,0.7)' }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -224 }} animate={{ x: 0 }} exit={{ x: -224 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="md:hidden fixed left-0 top-0 bottom-0 z-40"
              style={{ width: 224, background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
            >
              <SidebarInner
                profiles={profiles}
                activeProfile={activeProfile}
                onNav={() => setMobileOpen(false)}
                collapsed={false}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
