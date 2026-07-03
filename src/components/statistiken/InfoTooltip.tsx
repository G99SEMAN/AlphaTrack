'use client'

import { useLayoutEffect, useRef, useState } from 'react'

interface Props {
  text: string
  className?: string
}

export default function InfoTooltip({ text, className }: Props) {
  const [open, setOpen] = useState(false)
  const [shift, setShift] = useState(0)
  const rootRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLSpanElement>(null)

  // Bei Tap außerhalb schließen
  useLayoutEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  // Tooltip in den Viewport schieben, wenn er am Bildschirmrand abgeschnitten würde
  useLayoutEffect(() => {
    if (!open || !tipRef.current) {
      setShift(0)
      return
    }
    const rect = tipRef.current.getBoundingClientRect()
    const pad = 8
    if (rect.left < pad) setShift(pad - rect.left)
    else if (rect.right > window.innerWidth - pad) setShift(window.innerWidth - pad - rect.right)
  }, [open])

  return (
    <span ref={rootRef} className={`relative inline-flex items-center group ${className ?? ''}`}>
      <button
        type="button"
        aria-label="Erklärung anzeigen"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
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
      <span
        ref={tipRef}
        className={`absolute bottom-full left-1/2 mb-2 w-56 max-w-[80vw] rounded-lg px-3 py-2 text-xs leading-relaxed transition-opacity duration-150 z-50 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0 group-hover:opacity-100'
        }`}
        style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          color: 'var(--text-2)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          transform: `translateX(calc(-50% + ${shift}px))`,
        }}
      >
        {text}
      </span>
    </span>
  )
}
