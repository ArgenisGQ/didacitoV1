import * as React from "react"

export function ComplexityGauge({ value = 50, size = 120 }: { value: number; size?: number }) {
  const strokeWidth = 12
  const radius = (size - strokeWidth) / 2
  const circumference = radius * Math.PI
  // value represents percentage from 0 to 100
  const strokeDashoffset = circumference - (value / 100) * circumference

  return (
    <div className="relative flex flex-col items-center justify-center">
      <svg width={size} height={size / 2 + strokeWidth} className="overflow-visible">
        <defs>
          <linearGradient id="gauge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop offset="100%" stopColor="hsl(var(--accent))" />
          </linearGradient>
        </defs>
        {/* Background Arc */}
        <path
          d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted"
          strokeLinecap="round"
        />
        {/* Value Arc */}
        <path
          d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
          fill="none"
          stroke="url(#gauge-gradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500 ease-in-out"
        />
      </svg>
      <div className="absolute bottom-0 text-center">
        <span className="text-2xl font-bold font-heading">{value}%</span>
      </div>
    </div>
  )
}
