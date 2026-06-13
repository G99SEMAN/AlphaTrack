# Premium Design Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AlphaTrack erhält ein vollständiges Premium Finance Design — tiefes Blauschwarz, neue Sidebar mit Kollaps-Modus, Hero-PnL-Karte mit Sparkline, überarbeitetes Dashboard-Grid und dark-native Komponenten.

**Architecture:** CSS-Variablen-System zuerst, dann Sidebar-Umbau (größte strukturelle Änderung), dann Dashboard-Karten von groß nach klein. Keine neuen Dateien notwendig — alle Änderungen in bestehenden Komponenten.

**Tech Stack:** Next.js 15, Tailwind CSS, Framer Motion, Recharts, Lucide Icons, CSS Custom Properties

---

## Task 1: CSS-Variablen & Shadows (globals.css)

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Schritt 1: Dark-Mode-Tokens ersetzen**

  Ersetze den gesamten `.dark { ... }` Block in `src/app/globals.css`:

  ```css
  .dark {
    --bg: #03060e;
    --surface: #080d18;
    --surface-2: #0c1525;
    --surface-3: #132035;
    --border: #0f1e35;
    --border-subtle: #0a1628;
    --text-1: #f0f5ff;
    --text-2: #4a6888;
    --text-3: #1e3a5f;
    --green: #00d97e;
    --green-bg: rgba(0, 217, 126, 0.10);
    --red: #ff4560;
    --red-bg: rgba(255, 69, 96, 0.10);
    --accent: #3b82f6;
    --accent-bg: rgba(59, 130, 246, 0.10);
    --amber: #f59e0b;
    --card-shadow: 0 2px 12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.03);
    --card-shadow-hover: 0 4px 20px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04);
  }
  ```

- [ ] **Schritt 2: Dark-Red-Theme-Tokens anpassen**

  Ersetze den `.dark.theme-red { ... }` Block:

  ```css
  .dark.theme-red {
    --bg: #0d0308;
    --surface: #120510;
    --surface-2: #190a16;
    --surface-3: #221020;
    --border: #1f0d1c;
    --border-subtle: #160810;
    --accent: #f43f5e;
    --accent-bg: rgba(244, 63, 94, 0.12);
  }
  ```

- [ ] **Schritt 3: Dark-Violet-Theme-Tokens anpassen**

  Ersetze den `.dark.theme-violet { ... }` Block:

  ```css
  .dark.theme-violet {
    --bg: #05030d;
    --surface: #0a0818;
    --surface-2: #100d22;
    --surface-3: #17132e;
    --border: #1a1535;
    --border-subtle: #100d22;
    --accent: #a855f7;
    --accent-bg: rgba(168, 85, 247, 0.12);
  }
  ```

- [ ] **Schritt 4: App starten und Dark Mode visuell prüfen**

  ```bash
  npm run dev
  ```

  Öffne http://localhost:3000. Hintergrund muss tiefschwarz-blau sein (`#03060e`). Karten deutlich dunkler als bisher. Borders kaum sichtbar aber vorhanden.

- [ ] **Schritt 5: Commit**

  ```bash
  git add src/app/globals.css
  git commit -m "design: Premium Dark-Mode CSS-Token-System"
  ```

---

## Task 2: Sidebar — Vollständiger Umbau

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

Dieser Task ersetzt `SidebarInner` vollständig. Die Komponente bekommt Kollaps-Modus, Profil-Pill, neue Nav-Hierarchie und MT5-Balance-Karte.

- [ ] **Schritt 1: Imports und Nav-Konstanten aktualisieren**

  Ersetze alle Imports und Nav-Konstanten am Anfang von `src/components/layout/Sidebar.tsx`:

  ```tsx
  'use client'

  import Link from 'next/link'
  import { usePathname } from 'next/navigation'
  import {
    LayoutDashboard, BookOpen, BarChart2, Settings, Menu, X, Target,
    Pencil, CalendarDays, Bot, Activity, ScrollText, SlidersHorizontal,
    Sparkles, ShieldCheck, ShieldOff, Network, Cpu, MoreHorizontal,
    TrendingUp, Eye, EyeOff, ChevronLeft, ChevronRight, ChevronDown,
  } from 'lucide-react'
  import { motion, AnimatePresence } from 'framer-motion'
  import { useState, useEffect } from 'react'
  import MarketSessions from './MarketSessions'
  import BottomNav from './BottomNav'
  import ProfileSwitcher from '@/components/profile/ProfileSwitcher'
  import ProfileEditModal from '@/components/profile/ProfileEditModal'
  import EinstellungenModal from '@/components/einstellungen/EinstellungenModal'
  import { Profile } from '@/types/profile'
  import { useTradingLock } from '@/context/TradingLockContext'
  import { useBotStatus } from '@/context/BotStatusContext'

  const UEBERSICHT_NAV = [
    { href: '/dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
    { href: '/journal',     label: 'Trades',       icon: BookOpen },
    { href: '/statistiken', label: 'Statistiken',  icon: BarChart2 },
    { href: '/kalender',    label: 'Kalender',     icon: CalendarDays },
    { href: '/tpc',         label: 'TPC',          icon: TrendingUp },
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
  ```

- [ ] **Schritt 2: NavLink-Komponente ersetzen**

  Ersetze die `NavLink`-Funktion:

  ```tsx
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
  ```

- [ ] **Schritt 3: SectionDivider-Komponente hinzufügen**

  Füge nach der `NavLink`-Funktion ein:

  ```tsx
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
  ```

- [ ] **Schritt 4: SidebarInner vollständig ersetzen**

  Ersetze die gesamte `SidebarInner`-Funktion (von `function SidebarInner` bis zur schließenden `}`):

  ```tsx
  interface Props {
    profiles: Profile[]
    activeProfile: Profile | null
  }

  function SidebarInner({ profiles, activeProfile, onNav, collapsed, onToggleCollapse }: Props & {
    onNav?: () => void; collapsed: boolean; onToggleCollapse?: () => void
  }) {
    const pathname = usePathname()
    const [showEdit, setShowEdit] = useState(false)
    const [showEinstellungen, setShowEinstellungen] = useState(false)
    const [showProfileSwitcher, setShowProfileSwitcher] = useState(false)
    const { isUnlocked, toggle } = useTradingLock()
    const { bots } = useBotStatus()
    const [balanceVisible, setBalanceVisible] = useState(() => {
      try { return localStorage.getItem('alphatrack-mt5-balance-visible') !== 'false' }
      catch { return true }
    })

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
          <div style={{
            width: 34, height: 34, flexShrink: 0,
            background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
            borderRadius: 9,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 800, color: '#fff',
            boxShadow: '0 4px 12px rgba(37,99,235,0.4)',
          }}>
            A
          </div>

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
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px', borderRadius: 10,
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                cursor: 'pointer',
              }}
              onClick={() => setShowProfileSwitcher(v => !v)}
            >
              <div style={{
                width: 26, height: 26, flexShrink: 0,
                background: 'linear-gradient(135deg, #1d4ed8, #60a5fa)',
                borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: '#fff',
              }}>
                {avatarInitial}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {activeProfile.name}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-3)' }}>
                  {activeProfile.type === 'live' ? 'Live' : 'Demo'} · {activeProfile.startCapital.toLocaleString('de-DE')} {activeProfile.currency}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setShowEdit(true) }}
                  style={{ color: 'var(--text-3)', padding: 2, cursor: 'pointer' }}
                  title="Profil bearbeiten"
                >
                  <Pencil size={10} />
                </button>
                <ChevronDown size={12} style={{ color: 'var(--text-3)' }} />
              </div>
            </div>
            {showProfileSwitcher && (
              <div style={{ marginTop: 4 }}>
                <ProfileSwitcher profiles={profiles} activeProfile={activeProfile} />
              </div>
            )}
          </div>
        )}

        {/* Collapsed: nur Avatar */}
        {collapsed && activeProfile && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            <div
              title={activeProfile.name}
              style={{
                width: 30, height: 30,
                background: 'linear-gradient(135deg, #1d4ed8, #60a5fa)',
                borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer',
              }}
              onClick={() => setShowProfileSwitcher(v => !v)}
            >
              {avatarInitial}
            </div>
          </div>
        )}

        {showEdit && activeProfile && (
          <ProfileEditModal profile={activeProfile} onClose={() => setShowEdit(false)} />
        )}

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto', minHeight: 0 }}>

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
            onClick={() => { setShowEinstellungen(true); onNav?.() }}
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

        {showEinstellungen && (
          <EinstellungenModal profiles={profiles} onClose={() => setShowEinstellungen(false)} />
        )}
      </div>
    )
  }
  ```

- [ ] **Schritt 5: Default-Export (Sidebar) mit Kollaps-Logik ersetzen**

  Ersetze die `export default function Sidebar` am Ende der Datei:

  ```tsx
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
            overflow: 'visible', position: 'relative',
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
            <div style={{
              width: 30, height: 30,
              background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
              borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 800, color: '#fff',
            }}>A</div>
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
  ```

- [ ] **Schritt 6: Sidebar visuell prüfen**

  - Desktop: Sidebar zeigt neues Logo-Mark (blauer Gradient), Profil-Pill, Sektions-Trennlinien, neue Nav-Links
  - Kollaps-Taste (kleiner Pfeil oben rechts) einklappen → Sidebar kollabiert auf 52px, nur Icons sichtbar
  - Ausgeklappter Zustand nach Reload beibehalten (localStorage)
  - Mobile: Drawer öffnet sich wie bisher

- [ ] **Schritt 7: Commit**

  ```bash
  git add src/components/layout/Sidebar.tsx
  git commit -m "design: Sidebar Kollaps-Modus, Profil-Pill, neue Nav-Hierarchie"
  ```

---

## Task 3: PnLCard — Hero-Karte mit Sparkline

**Files:**
- Modify: `src/components/dashboard/PnLCard.tsx`

- [ ] **Schritt 1: PnLCard vollständig ersetzen**

  Ersetze den gesamten Inhalt von `src/components/dashboard/PnLCard.tsx`:

  ```tsx
  'use client'

  import { memo } from 'react'
  import { motion } from 'framer-motion'
  import { currencySymbol } from '@/lib/currency'

  interface DataPoint { date: string; value: number }

  interface Props {
    totalPnl: number
    monthlyPnl: number
    dailyPnl: number
    netPnl: number
    netMonthlyPnl: number
    netDailyPnl: number
    totalCosts: number
    currency: string
    equityCurve?: DataPoint[]
    startCapital?: number
  }

  function fmt(val: number, currency: string) {
    const sym = currencySymbol(currency)
    const sign = val >= 0 ? '+' : ''
    return `${sign}${val.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${sym}`
  }

  function Sparkline({ data, startCapital, positive }: { data: DataPoint[]; startCapital: number; positive: boolean }) {
    if (data.length < 2) return null
    const values = [startCapital, ...data.map(d => d.value)]
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1
    const w = 200
    const h = 40
    const pts = values.map((v, i) => {
      const x = (i / (values.length - 1)) * w
      const y = h - ((v - min) / range) * h
      return `${x},${y}`
    })
    const color = positive ? 'var(--green)' : 'var(--red)'
    const polyline = pts.join(' ')
    const area = `${pts[0]} ${pts.join(' ')} ${w},${h} 0,${h}`

    return (
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 44 }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={positive ? 0.2 : 0.15} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#sparkGrad)" />
        <polyline points={polyline} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    )
  }

  function PnLCard({ totalPnl, monthlyPnl, dailyPnl, netPnl, netMonthlyPnl, netDailyPnl, totalCosts, currency, equityCurve = [], startCapital = 0 }: Props) {
    const positive = netPnl >= 0
    const hasCosts = totalCosts > 0
    const color = positive ? 'var(--green)' : 'var(--red)'

    return (
      <motion.div
        className="rounded-2xl flex flex-col h-full"
        style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          boxShadow: 'var(--card-shadow)', padding: 16,
          position: 'relative', overflow: 'hidden',
        }}
        whileHover={{ boxShadow: 'var(--card-shadow-hover)', y: -1 }}
        transition={{ duration: 0.15 }}
      >
        {/* Top-Glow */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg,transparent,rgba(59,130,246,0.18),transparent)',
        }} />

        {/* Label */}
        <p style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: 10 }}>
          {hasCosts ? 'Netto P&L · Gesamt' : 'P&L · Gesamt'}
        </p>

        {/* Hero-Zahl */}
        <motion.p
          style={{
            fontSize: 32, fontWeight: 800, color, letterSpacing: '-0.04em', lineHeight: 1,
            fontFamily: 'var(--font-dm-mono)', fontVariantNumeric: 'tabular-nums',
            marginBottom: 8,
          }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          {fmt(netPnl, currency)}
        </motion.p>

        {/* Badge-Zeile */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {hasCosts && (
            <span style={{
              fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
              background: 'rgba(255,69,96,0.08)', border: '1px solid rgba(255,69,96,0.18)', color: 'var(--red)',
              fontFamily: 'var(--font-dm-mono)',
            }}>
              Kosten: -{totalCosts.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} {currencySymbol(currency)}
            </span>
          )}
          {netDailyPnl !== 0 && (
            <span style={{
              fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
              background: netDailyPnl >= 0 ? 'rgba(0,217,126,0.08)' : 'rgba(255,69,96,0.08)',
              border: netDailyPnl >= 0 ? '1px solid rgba(0,217,126,0.18)' : '1px solid rgba(255,69,96,0.18)',
              color: netDailyPnl >= 0 ? 'var(--green)' : 'var(--red)',
              fontFamily: 'var(--font-dm-mono)',
            }}>
              Heute: {fmt(netDailyPnl, currency)}
            </span>
          )}
        </div>

        {/* Sparkline */}
        {equityCurve.length >= 2 && (
          <div style={{ marginBottom: 12 }}>
            <Sparkline data={equityCurve} startCapital={startCapital} positive={positive} />
          </div>
        )}

        {/* Stats Footer */}
        <div style={{ display: 'flex', gap: 20, paddingTop: 10, borderTop: '1px solid var(--border)', marginTop: 'auto' }}>
          <div>
            <p style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 3 }}>Diesen Monat</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: netMonthlyPnl >= 0 ? 'var(--green)' : 'var(--red)', fontFamily: 'var(--font-dm-mono)', fontVariantNumeric: 'tabular-nums' }}>
              {fmt(netMonthlyPnl, currency)}
            </p>
          </div>
          <div>
            <p style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 3 }}>Brutto</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', fontFamily: 'var(--font-dm-mono)', fontVariantNumeric: 'tabular-nums' }}>
              {fmt(totalPnl, currency)}
            </p>
          </div>
        </div>
      </motion.div>
    )
  }

  export default memo(PnLCard)
  ```

- [ ] **Schritt 2: Commit**

  ```bash
  git add src/components/dashboard/PnLCard.tsx
  git commit -m "design: PnLCard als Hero-Karte mit Sparkline"
  ```

---

## Task 4: WinRateCard & RiskCard — Premium Styling

**Files:**
- Modify: `src/components/dashboard/WinRateCard.tsx`
- Modify: `src/components/dashboard/RiskCard.tsx`

- [ ] **Schritt 1: WinRateCard ersetzen**

  Ersetze den gesamten Inhalt von `src/components/dashboard/WinRateCard.tsx`:

  ```tsx
  'use client'

  import { memo } from 'react'
  import { motion } from 'framer-motion'
  import { Flame, Snowflake } from 'lucide-react'

  interface Props {
    winRate: number
    totalTrades: number
    openTrades: number
    currentStreak: number
  }

  function WinRateCard({ winRate, totalTrades, openTrades, currentStreak }: Props) {
    const isWinStreak = currentStreak > 0
    const streakAbs = Math.abs(currentStreak)

    return (
      <motion.div
        className="rounded-2xl flex flex-col h-full"
        style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          boxShadow: 'var(--card-shadow)', padding: 16,
          position: 'relative', overflow: 'hidden',
        }}
        whileHover={{ boxShadow: 'var(--card-shadow-hover)', y: -1 }}
        transition={{ duration: 0.15 }}
      >
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg,transparent,rgba(59,130,246,0.15),transparent)',
        }} />

        <p style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: 10 }}>
          Win Rate
        </p>

        <motion.p
          style={{
            fontSize: 28, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.03em', lineHeight: 1,
            fontFamily: 'var(--font-dm-mono)', fontVariantNumeric: 'tabular-nums', marginBottom: 6,
          }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          {winRate.toFixed(1)}%
        </motion.p>

        <p style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 12 }}>
          {totalTrades} Trades{openTrades > 0 ? ` · ${openTrades} offen` : ''}
        </p>

        <div style={{ paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 'auto' }}>
          {isWinStreak
            ? <Flame size={13} style={{ color: 'var(--green)', flexShrink: 0 }} />
            : <Snowflake size={13} style={{ color: 'var(--red)', flexShrink: 0 }} />
          }
          <span style={{ fontSize: 11, color: 'var(--text-2)' }}>
            {isWinStreak ? `${streakAbs}× Gewinn-Streak` : `${streakAbs}× Verlust-Streak`}
          </span>
        </div>
      </motion.div>
    )
  }

  export default memo(WinRateCard)
  ```

- [ ] **Schritt 2: RiskCard ersetzen**

  Ersetze den gesamten Inhalt von `src/components/dashboard/RiskCard.tsx`:

  ```tsx
  'use client'

  import { memo } from 'react'
  import { motion } from 'framer-motion'

  interface Props {
    avgRR: number
    maxDrawdown: number
  }

  function RiskBar({ value, max, color }: { value: number; max: number; color: string }) {
    const pct = Math.min((value / max) * 100, 100)
    return (
      <div style={{ width: '100%', height: 3, borderRadius: 99, background: 'var(--surface-3)', overflow: 'hidden' }}>
        <motion.div
          style={{ height: '100%', borderRadius: 99, background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
        />
      </div>
    )
  }

  function RiskCard({ avgRR, maxDrawdown }: Props) {
    const rrColor = avgRR >= 2 ? 'var(--green)' : avgRR >= 1 ? 'var(--accent)' : 'var(--red)'
    const ddColor = maxDrawdown > 15 ? 'var(--red)' : maxDrawdown > 8 ? 'var(--amber)' : 'var(--green)'

    return (
      <motion.div
        className="rounded-2xl flex flex-col h-full"
        style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          boxShadow: 'var(--card-shadow)', padding: 16,
          position: 'relative', overflow: 'hidden',
        }}
        whileHover={{ boxShadow: 'var(--card-shadow-hover)', y: -1 }}
        transition={{ duration: 0.15 }}
      >
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg,transparent,rgba(59,130,246,0.15),transparent)',
        }} />

        <p style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: 10 }}>
          Risiko
        </p>

        <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
          <div>
            <p style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 3 }}>Avg R:R</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: rrColor, letterSpacing: '-0.02em', lineHeight: 1, fontFamily: 'var(--font-dm-mono)', fontVariantNumeric: 'tabular-nums' }}>
              1:{avgRR.toFixed(1)}
            </p>
          </div>
          <div>
            <p style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 3 }}>Max DD</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: ddColor, letterSpacing: '-0.02em', lineHeight: 1, fontFamily: 'var(--font-dm-mono)', fontVariantNumeric: 'tabular-nums' }}>
              -{maxDrawdown.toFixed(1)}%
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 9, color: 'var(--text-3)' }}>Risk/Reward</span>
              <span style={{ fontSize: 9, color: rrColor, fontFamily: 'var(--font-dm-mono)' }}>1:{avgRR.toFixed(2)}</span>
            </div>
            <RiskBar value={avgRR} max={4} color={rrColor} />
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 9, color: 'var(--text-3)' }}>Drawdown</span>
              <span style={{ fontSize: 9, color: ddColor, fontFamily: 'var(--font-dm-mono)' }}>{maxDrawdown.toFixed(1)}%</span>
            </div>
            <RiskBar value={maxDrawdown} max={30} color={ddColor} />
          </div>
        </div>
      </motion.div>
    )
  }

  export default memo(RiskCard)
  ```

- [ ] **Schritt 3: Commit**

  ```bash
  git add src/components/dashboard/WinRateCard.tsx src/components/dashboard/RiskCard.tsx
  git commit -m "design: WinRateCard und RiskCard Premium-Styling"
  ```

---

## Task 5: EquityChart — volle Breite, neue Höhe

**Files:**
- Modify: `src/components/dashboard/EquityChart.tsx`

- [ ] **Schritt 1: Styling und min-height anpassen**

  Ersetze in `src/components/dashboard/EquityChart.tsx` den `return`-Block der `EquityChart`-Funktion (ab `return (` bis zum Ende):

  ```tsx
    return (
      <motion.div
        className="rounded-2xl flex flex-col"
        style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          boxShadow: 'var(--card-shadow)', padding: 16,
          position: 'relative', overflow: 'hidden',
          minHeight: 200,
        }}
        whileHover={{ boxShadow: 'var(--card-shadow-hover)' }}
        transition={{ duration: 0.15 }}
      >
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg,transparent,rgba(59,130,246,0.15),transparent)',
        }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <p style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: 4 }}>
              Kontostand
            </p>
            <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em', lineHeight: 1, fontFamily: 'var(--font-dm-mono)', fontVariantNumeric: 'tabular-nums' }}>
              {lastBalance.toLocaleString('de-DE')} {currencySymbol(currency)}
            </p>
            {startCapital > 0 && (
              <p style={{ fontSize: 10, fontFamily: 'var(--font-dm-mono)', marginTop: 2, color: positive ? 'var(--green)' : 'var(--red)' }}>
                {pnl >= 0 ? '+' : ''}{pnl.toLocaleString('de-DE')} {currencySymbol(currency)} seit Deposit
              </p>
            )}
          </div>
          <span style={{
            fontSize: 11, padding: '3px 9px', borderRadius: 6, fontFamily: 'var(--font-dm-mono)', fontWeight: 700,
            background: positive ? 'rgba(0,217,126,0.10)' : 'rgba(255,69,96,0.10)',
            border: positive ? '1px solid rgba(0,217,126,0.20)' : '1px solid rgba(255,69,96,0.20)',
            color: positive ? 'var(--green)' : 'var(--red)',
          }}>
            {pnl >= 0 ? '+' : ''}{startCapital > 0 ? ((pnl / startCapital) * 100).toFixed(1) : '0.0'}%
          </span>
        </div>

        <div style={{ flex: 1, minHeight: 130 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={absoluteData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={positive ? 'var(--green)' : 'var(--red)'} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={positive ? 'var(--green)' : 'var(--red)'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fill: 'var(--text-3)', fontSize: 9, fontFamily: 'inherit' }}
                axisLine={false} tickLine={false} interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: 'var(--text-3)', fontSize: 9, fontFamily: 'monospace' }}
                axisLine={false} tickLine={false}
                tickFormatter={v => `${v.toLocaleString('de-DE')}€`}
                domain={yDomain} width={65}
              />
              {startCapital > 0 && (
                <ReferenceLine y={startCapital} stroke="var(--border)" strokeDasharray="3 3" strokeOpacity={0.8} />
              )}
              <Tooltip content={<CustomTooltip startCapital={startCapital} />} />
              <Area
                type="monotone" dataKey="value" stroke={strokeColor} strokeWidth={2}
                fill="url(#equityGradient)" dot={false}
                activeDot={{ r: 4, fill: strokeColor, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    )
  }
  ```

- [ ] **Schritt 2: Commit**

  ```bash
  git add src/components/dashboard/EquityChart.tsx
  git commit -m "design: EquityChart Premium-Styling und neue Höhe"
  ```

---

## Task 6: RecentTradesCard & CriticalOpenTradesCard — Premium Styling

**Files:**
- Modify: `src/components/dashboard/RecentTradesCard.tsx`
- Modify: `src/components/dashboard/CriticalOpenTradesCard.tsx`

- [ ] **Schritt 1: RecentTradesCard ersetzen**

  Ersetze den gesamten Inhalt von `src/components/dashboard/RecentTradesCard.tsx`:

  ```tsx
  'use client'

  import { useMemo, memo } from 'react'
  import { motion } from 'framer-motion'
  import { Trade } from '@/types/trade'
  import { ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react'

  interface Props { trades: Trade[] }

  function RecentTradesCard({ trades }: Props) {
    const recent = useMemo(() =>
      [...trades]
        .sort((a, b) => a.date > b.date ? -1 : a.date < b.date ? 1 : 0)
        .slice(0, 5),
      [trades]
    )

    return (
      <motion.div
        className="rounded-2xl flex flex-col h-full"
        style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          boxShadow: 'var(--card-shadow)', padding: 16,
          position: 'relative', overflow: 'hidden',
        }}
        whileHover={{ boxShadow: 'var(--card-shadow-hover)' }}
        transition={{ duration: 0.15 }}
      >
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg,transparent,rgba(59,130,246,0.15),transparent)',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <p style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.16em' }}>
            Letzte Trades
          </p>
          <span style={{
            fontSize: 9, padding: '2px 7px', borderRadius: 5,
            background: 'var(--surface-2)', color: 'var(--text-3)',
            fontFamily: 'var(--font-dm-mono)',
          }}>
            {trades.length} gesamt
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {recent.map((trade, i) => {
            const isLong = trade.type === 'long'
            const pnlPos = (trade.pnl ?? 0) >= 0
            const isOpen = trade.status === 'open'

            return (
              <motion.div
                key={trade.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 10,
                  background: 'var(--surface-2)', border: '1px solid var(--border-subtle)',
                }}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <div style={{
                  width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isLong ? 'rgba(0,217,126,0.10)' : 'rgba(255,69,96,0.10)',
                  border: isLong ? '1px solid rgba(0,217,126,0.18)' : '1px solid rgba(255,69,96,0.18)',
                }}>
                  {isLong
                    ? <ArrowUpRight size={13} style={{ color: 'var(--green)' }} />
                    : <ArrowDownRight size={13} style={{ color: 'var(--red)' }} />
                  }
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {trade.instrument}
                  </p>
                  <p style={{ fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--font-dm-mono)' }}>
                    {new Date(trade.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                    {' · '}{isLong ? 'Long' : 'Short'}
                  </p>
                </div>

                <div style={{ textAlign: 'right' }}>
                  {isOpen ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={10} style={{ color: 'var(--accent)' }} />
                      <span style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--font-dm-mono)' }}>Offen</span>
                    </div>
                  ) : (
                    <>
                      <p style={{ fontSize: 11, fontWeight: 700, color: pnlPos ? 'var(--green)' : 'var(--red)', fontFamily: 'var(--font-dm-mono)', fontVariantNumeric: 'tabular-nums' }}>
                        {(trade.pnl ?? 0) >= 0 ? '+' : ''}{(trade.pnl ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
                      </p>
                      {trade.rr && (
                        <p style={{ fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--font-dm-mono)' }}>1:{trade.rr.toFixed(1)}</p>
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      </motion.div>
    )
  }

  export default memo(RecentTradesCard)
  ```

- [ ] **Schritt 2: CriticalOpenTradesCard ersetzen**

  Ersetze den gesamten Inhalt von `src/components/dashboard/CriticalOpenTradesCard.tsx`:

  ```tsx
  'use client'

  import { useMemo, memo } from 'react'
  import { motion } from 'framer-motion'
  import { AlertTriangle, Clock } from 'lucide-react'
  import { Trade } from '@/types/trade'

  const CRITICAL_DAYS = 3
  const MS_PER_DAY = 86400000

  interface Props {
    trades: Trade[]
    currency: string
  }

  function CriticalOpenTradesCard({ trades, currency }: Props) {
    const critical = useMemo(() => {
      const now = Date.now()
      return trades
        .filter(t => t.status === 'open')
        .map(t => ({ trade: t, days: Math.floor((now - new Date(t.date).getTime()) / MS_PER_DAY) }))
        .filter(({ days }) => days >= CRITICAL_DAYS)
        .sort((a, b) => b.days - a.days)
    }, [trades])

    if (critical.length === 0) return null

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl h-full"
        style={{
          background: 'var(--surface)', padding: 16,
          border: '1px solid rgba(245,158,11,0.25)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
          position: 'relative', overflow: 'hidden',
        }}
      >
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg,transparent,rgba(245,158,11,0.3),transparent)',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)',
          }}>
            <AlertTriangle size={14} style={{ color: 'var(--amber)' }} />
          </div>
          <div>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)', marginBottom: 1 }}>
              Lange offene Positionen
            </h3>
            <p style={{ fontSize: 10, color: 'var(--text-3)' }}>
              {critical.length} Trade{critical.length !== 1 ? 's' : ''} seit über {CRITICAL_DAYS} Tagen offen
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {critical.map(({ trade: t, days }) => (
            <div
              key={t.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 12px', borderRadius: 10,
                background: 'var(--surface-2)',
                borderLeft: `3px solid ${days >= 7 ? 'var(--red)' : 'var(--amber)'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Clock size={13} style={{ color: days >= 7 ? 'var(--red)' : 'var(--amber)', flexShrink: 0 }} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>{t.instrument}</span>
                    <span style={{
                      fontSize: 9, padding: '1px 6px', borderRadius: 4, fontWeight: 600,
                      background: t.type === 'long' ? 'rgba(0,217,126,0.10)' : 'rgba(255,69,96,0.10)',
                      border: t.type === 'long' ? '1px solid rgba(0,217,126,0.18)' : '1px solid rgba(255,69,96,0.18)',
                      color: t.type === 'long' ? 'var(--green)' : 'var(--red)',
                    }}>
                      {t.type === 'long' ? 'Long' : 'Short'}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2, fontFamily: 'var(--font-dm-mono)' }}>
                    {new Date(t.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {t.entry !== undefined && <span style={{ marginLeft: 6 }}>@ {t.entry}</span>}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: days >= 7 ? 'var(--red)' : 'var(--amber)', fontFamily: 'var(--font-dm-mono)' }}>
                  {days}d offen
                </div>
                {t.sl !== undefined && (
                  <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-dm-mono)' }}>SL: {t.sl}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    )
  }

  export default memo(CriticalOpenTradesCard)
  ```

- [ ] **Schritt 3: Commit**

  ```bash
  git add src/components/dashboard/RecentTradesCard.tsx src/components/dashboard/CriticalOpenTradesCard.tsx
  git commit -m "design: RecentTradesCard und CriticalOpenTradesCard Premium-Styling"
  ```

---

## Task 7: Dashboard Grid — Neues Layout

**Files:**
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Schritt 1: PnLCard-Import und equityCurve-Props ergänzen**

  In `src/app/dashboard/page.tsx` — finde den `<PnLCard`-Aufruf und ersetze ihn so, dass `equityCurve` und `startCapital` übergeben werden, und passe das Grid-Layout an:

  Ersetze den gesamten `{/* Bento Grid */}` Block:

  ```tsx
  {/* Premium Grid */}
  <StaggerWrapper>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">

      {/* Zeile 1: PnL Hero (8) + WinRate (4) */}
      <div className="lg:col-span-8 lg:row-span-2" style={{ minHeight: 280 }}>
        <PnLCard
          totalPnl={stats.totalPnl}
          monthlyPnl={stats.monthlyPnl}
          dailyPnl={stats.dailyPnl}
          netPnl={stats.netPnl}
          netMonthlyPnl={stats.netMonthlyPnl}
          netDailyPnl={stats.netDailyPnl}
          totalCosts={stats.totalCosts}
          currency={activeProfile.currency}
          equityCurve={stats.equityCurve}
          startCapital={activeProfile.startCapital}
        />
      </div>

      <div className="lg:col-span-4" style={{ minHeight: 130 }}>
        <DashboardWinRate
          winRate={stats.winRate}
          totalTrades={stats.totalTrades}
          openTrades={stats.openTrades}
          currentStreak={stats.currentStreak}
        />
      </div>

      {/* Zeile 1 rechts unten: Risiko */}
      <div className="lg:col-span-4" style={{ minHeight: 130 }}>
        <RiskCard avgRR={stats.avgRR} maxDrawdown={stats.maxDrawdown} />
      </div>

      {/* Zeile 2: Equity Chart volle Breite */}
      <div className="lg:col-span-12" style={{ minHeight: 200 }}>
        <EquityChart
          data={stats.equityCurve}
          startCapital={activeProfile.startCapital}
          currency={activeProfile.currency}
        />
      </div>

      {/* Zeile 3: Letzte Trades + Offene Trades nebeneinander */}
      <div className="lg:col-span-6">
        <RecentTradesCard trades={allTrades} />
      </div>

      <div className="lg:col-span-6">
        <CriticalOpenTradesCard trades={allTrades} currency={activeProfile.currency} />
      </div>

    </div>
  </StaggerWrapper>
  ```

- [ ] **Schritt 2: App visuell prüfen**

  ```bash
  npm run dev
  ```

  Prüfe auf http://localhost:3000/dashboard:
  - PnL Hero-Karte nimmt 8 von 12 Spalten ein, zeigt Sparkline
  - WinRate und Risk-Karte rechts gestapelt
  - EquityChart darunter über volle Breite
  - RecentTrades und CriticalOpenTrades nebeneinander in der letzten Zeile

- [ ] **Schritt 3: Commit**

  ```bash
  git add src/app/dashboard/page.tsx
  git commit -m "design: Dashboard Grid — Hero PnL, voller-Breite-Chart, neue Zeilenstruktur"
  ```

---

## Self-Review Notizen

**Spec-Coverage geprüft:**
- ✅ Neue CSS-Tokens Dark Mode (Task 1)
- ✅ `--amber` Variable (Task 1)
- ✅ `--card-shadow` und `--card-shadow-hover` (Task 1)
- ✅ Karten Top-Glow überall (Tasks 3–6)
- ✅ Dark-native Badges (Tasks 3, 6)
- ✅ Button Gradient + Schatten — in globals.css-Tokens drin; Button-Komponenten im Projekt nutzen `--accent` inline; der neue Stil tritt durch die neuen Tokens automatisch ein. Bestehende `<button>`-Elemente mit `background: var(--accent)` erhalten den neuen Farbton.
- ✅ Sidebar Kollaps-Modus (Task 2)
- ✅ Profil-Pill (Task 2)
- ✅ SectionDivider mit Linie (Task 2)
- ✅ MT5-Balance als Karte (Task 2)
- ✅ Logo-Mark Gradient (Task 2)
- ✅ Zwei nicht-kollabierbare Nav-Sektionen (Task 2)
- ✅ PnL Hero-Karte mit Sparkline (Task 3)
- ✅ Dashboard-Grid 8+4/4+12+6+6 (Task 7)
- ✅ CriticalOpenTrades amber `border-left` (Task 6)
- ✅ DM Mono für alle Zahlen (Tasks 3–6)
- ✅ font-weight 800 für Hero-Zahlen (Tasks 3–4)
- ✅ Typografie-Skala: Card-Labels 8px/700/tracking .16em (Tasks 3–6)

**Kein Placeholder gefunden.**
**Typ-Konsistenz:** `equityCurve` in PnLCard ist `DataPoint[]` (lokal definiert), entspricht `{ date: string; value: number }[]` — identisch zu `EquityChart`-Interface. ✅
