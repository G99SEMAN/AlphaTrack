import React from "react";

interface LogoMarkProps {
  size?: number;
  className?: string;
}

export default function LogoMark({ size = 40, className = "" }: LogoMarkProps) {
  const id = React.useId().replace(/:/g, "");

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="AlphaTrack Logo"
      role="img"
    >
      <defs>
        {/* Background gradient */}
        <linearGradient
          id={`bg-grad-${id}`}
          x1="0"
          y1="0"
          x2="40"
          y2="40"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#0a0f1e" />
          <stop offset="100%" stopColor="#0f1f3d" />
        </linearGradient>

        {/* Line glow filter */}
        <filter id={`glow-${id}`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.2" result="blur1" />
          <feGaussianBlur stdDeviation="2.5" result="blur2" />
          <feMerge>
            <feMergeNode in="blur2" />
            <feMergeNode in="blur1" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Subtle inner shadow for depth */}
        <filter id={`inner-${id}`} x="0" y="0" width="100%" height="100%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#06d6a0" floodOpacity="0.15" />
        </filter>

        {/* Clip to rounded rect */}
        <clipPath id={`clip-${id}`}>
          <rect width="40" height="40" rx="9" ry="9" />
        </clipPath>

        {/* Line gradient - cyan to green */}
        <linearGradient
          id={`line-grad-${id}`}
          x1="5"
          y1="28"
          x2="35"
          y2="12"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#00c9a7" />
          <stop offset="50%" stopColor="#06d6a0" />
          <stop offset="100%" stopColor="#00e5ff" />
        </linearGradient>

        {/* Area fill gradient */}
        <linearGradient
          id={`area-grad-${id}`}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
          gradientUnits="objectBoundingBox"
        >
          <stop offset="0%" stopColor="#06d6a0" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#06d6a0" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Background */}
      <rect
        width="40"
        height="40"
        rx="9"
        ry="9"
        fill={`url(#bg-grad-${id})`}
      />

      <g clipPath={`url(#clip-${id})`}>
        {/* Subtle grid lines */}
        <line x1="5" y1="14" x2="35" y2="14" stroke="#ffffff" strokeOpacity="0.04" strokeWidth="0.5" />
        <line x1="5" y1="21" x2="35" y2="21" stroke="#ffffff" strokeOpacity="0.04" strokeWidth="0.5" />
        <line x1="5" y1="28" x2="35" y2="28" stroke="#ffffff" strokeOpacity="0.04" strokeWidth="0.5" />
        <line x1="13" y1="8" x2="13" y2="34" stroke="#ffffff" strokeOpacity="0.04" strokeWidth="0.5" />
        <line x1="20" y1="8" x2="20" y2="34" stroke="#ffffff" strokeOpacity="0.04" strokeWidth="0.5" />
        <line x1="27" y1="8" x2="27" y2="34" stroke="#ffffff" strokeOpacity="0.04" strokeWidth="0.5" />

        {/*
          Alpha-chart path:
          - Starts lower left, rises
          - Forms the alpha "loop" - dips inward then back out (the closed eye of alpha)
          - Then continues upward to a sharp peak
          - Then descends slightly (trailing off to the right)

          Points crafted to resemble:
            start  -> gentle rise
            -> alpha loop (small dip-and-circle motion at mid-height)
            -> decisive upward break (the peak)
            -> short descent trailing right
        */}

        {/* Area fill under line */}
        <path
          d="
            M 5 28
            C 7 26, 9 24, 11 23
            C 12.5 22.2, 13.5 23.5, 14.5 22
            C 15.2 21, 15.8 18.5, 16.8 19.5
            C 17.5 20.2, 17.8 21.5, 18.5 20.5
            C 19.2 19.5, 19.5 17, 20.5 13
            C 21 11, 21.8 10.5, 22.5 12
            L 35 29
            L 35 34
            L 5 34
            Z
          "
          fill={`url(#area-grad-${id})`}
        />

        {/* Main alpha-chart line */}
        <path
          d="
            M 5 28
            C 7 26, 9 24, 11 23
            C 12.5 22.2, 13.5 23.5, 14.5 22
            C 15.2 21, 15.8 18.5, 16.8 19.5
            C 17.5 20.2, 17.8 21.5, 18.5 20.5
            C 19.2 19.5, 19.5 17, 20.5 13
            C 21 11, 21.8 10.5, 22.5 12
            L 35 29
          "
          stroke={`url(#line-grad-${id})`}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          filter={`url(#glow-${id})`}
        />

        {/* Peak accent dot */}
        <circle
          cx="20.5"
          cy="13"
          r="1.4"
          fill="#06d6a0"
          filter={`url(#glow-${id})`}
        />

        {/* Subtle border overlay for polish */}
        <rect
          width="40"
          height="40"
          rx="9"
          ry="9"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.06"
          strokeWidth="0.8"
        />
      </g>
    </svg>
  );
}
