import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface BadgeProps {
  color: string
  label: ReactNode
  className?: string
}

export function Badge({ color, label, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 text-xs font-medium text-ink-secondary',
        className
      )}
    >
      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </span>
  )
}
