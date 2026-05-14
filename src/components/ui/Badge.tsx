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
        'inline-flex items-center gap-2 rounded-full border border-surface-border bg-surface-raised px-2.5 py-1 text-xs text-ink-secondary',
        className
      )}
    >
      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </span>
  )
}
