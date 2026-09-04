import React from 'react'

interface FlagIconProps {
  size?: number
  className?: string
}

export function FlagDE({ size = 20, className = '' }: FlagIconProps) {
  const id = React.useId().replace(/:/g, '')

  return (
    <svg
      width={size}
      height={size * 0.7}
      viewBox="0 0 20 14"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Deutsch"
      role="img"
    >
      <clipPath id={`de-clip-${id}`}>
        <rect width="20" height="14" rx="2" ry="2" />
      </clipPath>
      <g clipPath={`url(#de-clip-${id})`}>
        <rect width="20" height="14" fill="#FFCE00" />
        <rect width="20" height="9.33" fill="#DD0000" />
        <rect width="20" height="4.67" fill="#000000" />
      </g>
      <rect width="20" height="14" rx="2" ry="2" fill="none" stroke="#000000" strokeOpacity="0.12" strokeWidth="0.5" />
    </svg>
  )
}

export function FlagUS({ size = 20, className = '' }: FlagIconProps) {
  const id = React.useId().replace(/:/g, '')
  const stripeHeight = 14 / 7

  return (
    <svg
      width={size}
      height={size * 0.7}
      viewBox="0 0 20 14"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="English"
      role="img"
    >
      <clipPath id={`us-clip-${id}`}>
        <rect width="20" height="14" rx="2" ry="2" />
      </clipPath>
      <g clipPath={`url(#us-clip-${id})`}>
        <rect width="20" height="14" fill="#FFFFFF" />
        {[0, 1, 2, 3, 4, 5, 6].map((i) =>
          i % 2 === 0 ? (
            <rect key={i} y={i * stripeHeight} width="20" height={stripeHeight} fill="#B22234" />
          ) : null
        )}
        <rect width="9" height="7.5" fill="#3C3B6E" />
        {[0, 1, 2].map((row) =>
          [0, 1, 2].map((col) => (
            <circle
              key={`${row}-${col}`}
              cx={1.6 + col * 3}
              cy={1.4 + row * 2.4}
              r="0.5"
              fill="#FFFFFF"
            />
          ))
        )}
      </g>
      <rect width="20" height="14" rx="2" ry="2" fill="none" stroke="#000000" strokeOpacity="0.12" strokeWidth="0.5" />
    </svg>
  )
}
