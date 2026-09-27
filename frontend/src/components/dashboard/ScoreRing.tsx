import { clsx } from 'clsx'
import { useIsMobile } from '../../hooks/useMediaQuery'

export interface ScoreRingProps {
  score?: number
  size?: number
  strokeWidth?: number
  label?: string
  className?: string
}

export default function ScoreRing({
  score = 0,
  size: sizeProp,
  strokeWidth = 8,
  label,
  className,
}: ScoreRingProps) {
  const isMobile = useIsMobile()
  // Shrink on phones unless the caller pinned an explicit size.
  const size = sizeProp ?? (isMobile ? 96 : 120)
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  const getColor = (score: number): string => {
    if (score >= 75) return '#2EA043'
    if (score >= 50) return '#171717'
    if (score >= 25) return '#D97706'
    return '#DC2626'
  }

  return (
    <div className={clsx('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--border-default)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getColor(score)}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out dark:stroke-white"
          style={score >= 50 && score < 75 ? {} : undefined}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-[var(--text-primary)]">{score}</span>
        {label && <span className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{label}</span>}
      </div>
    </div>
  )
}
