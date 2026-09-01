'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { LayoutDashboard, BookOpen, TrendingUp, Network, BarChart2 } from 'lucide-react'

const ITEMS = [
  { href: '/dashboard',        labelKey: 'dashboard',   icon: LayoutDashboard },
  { href: '/journal',          labelKey: 'trades',      icon: BookOpen },
  { href: '/bots/performance', labelKey: 'performance', icon: TrendingUp },
  { href: '/netzwerk',         labelKey: 'network',     icon: Network },
  { href: '/statistiken',      labelKey: 'statistics',  icon: BarChart2 },
] as const

export default function BottomNav() {
  const pathname = usePathname()
  const t = useTranslations('bottomNav')

  return (
    <nav className="bottom-nav md:hidden">
      {ITEMS.map(({ href, labelKey, icon: Icon }) => {
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
              {t(labelKey)}
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
