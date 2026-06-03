'use client'

interface Props {
  text: string
  className?: string
}

export default function InfoTooltip({ text, className }: Props) {
  return (
    <span className={`relative inline-flex items-center group ${className ?? ''}`}>
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="cursor-help shrink-0"
        style={{ color: 'var(--text-3)' }}
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
      <span
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-lg px-3 py-2 text-xs leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50"
        style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          color: 'var(--text-2)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}
      >
        {text}
      </span>
    </span>
  )
}
