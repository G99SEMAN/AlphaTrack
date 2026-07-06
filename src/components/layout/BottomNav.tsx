'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, BookOpen, TrendingUp, Network, BarChart2 } from 'lucide-react'

const ITEMS = [
  { href: '/dashboard',        label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/journal',          label: 'Trades',       icon: BookOpen },
  { href: '/bots/performance', label: 'Performance',  icon: TrendingUp },
  { href: '/netzwerk',         label: 'Netzwerk',     icon: Network },
  { href: '/statistiken',      label: 'Statistik',    icon: BarChart2 },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="bottom-nav md:hidden">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className="bottom-nav-item"
            style={{ color: active ? 'var(--accent)' : 'var(--text-3)' }}
          >
            <span className="bottom-nav-icon" style={{ color: active ? 'var(--accent)' : 'var(--text-3)' }}>
              <Icon size={19} strokeWidth={active ? 2.5 : 1.8} />
            </span>
            <span
              className="bottom-nav-label"
              style={{
                color: active ? 'var(--accent)' : 'var(--text-3)',
                fontWeight: active ? 600 : 400,
              }}
            >
              {label}
            </span>
            {active && (
              <span
                className="bottom-nav-indicator"
                style={{ background: 'var(--accent)' }}
              />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
