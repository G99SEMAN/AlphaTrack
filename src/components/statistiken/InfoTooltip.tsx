'use client'

import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'

interface Props {
  text: string
  className?: string
}

const TOOLTIP_WIDTH = 224 // w-56

export default function InfoTooltip({ text, className }: Props) {
  const t = useTranslations('common')
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const rootRef = useRef<HTMLSpanElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)

  const visible = open || hovered

  const updatePosition = useCallback(() => {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    const tipWidth = tipRef.current?.offsetWidth ?? TOOLTIP_WIDTH
    const pad = 8
    const left = Math.max(pad, Math.min(
      rect.left + rect.width / 2 - tipWidth / 2,
      window.innerWidth - tipWidth - pad,
    ))
    setPos({ top: rect.top - 8, left })
  }, [])

  // Position berechnen, solange sichtbar (auch bei Scroll/Resize aktuell halten)
  useLayoutEffect(() => {
    if (!visible) return
    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [visible, updatePosition])

  // Bei Tap außerhalb schließen
  useLayoutEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      const target = e.target as Node
      if (rootRef.current?.contains(target) || tipRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  return (
    <span ref={rootRef} className={`inline-flex items-center ${className ?? ''}`}>
      <button
        ref={btnRef}
        type="button"
        aria-label={t('infoTooltipAriaLabel')}
        aria-expanded={visible}
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="inline-flex items-center cursor-help shrink-0 bg-transparent border-0 p-0"
        style={{ color: 'var(--text-3)' }}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
      </button>
      {visible && pos && typeof document !== 'undefined' && createPortal(
        <div
          ref={tipRef}
          role="tooltip"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className="fixed w-56 max-w-[80vw] rounded-lg px-3 py-2 text-xs leading-relaxed z-50"
          style={{
            top: pos.top,
            left: pos.left,
            transform: 'translateY(-100%)',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            color: 'var(--text-2)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          {text}
        </div>,
        document.body,
      )}
    </span>
  )
}
