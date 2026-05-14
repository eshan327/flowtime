import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface TooltipProps {
  content: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
}

export function Tooltip({ content, children, className, contentClassName }: TooltipProps) {
  return (
    <span className={cn('group relative inline-flex', className)}>
      {children}
      <span
        className={cn(
          'pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-max max-w-xs -translate-x-1/2 rounded-lg border border-surface-border bg-surface-overlay px-2 py-1 text-xs text-ink-secondary opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100',
          contentClassName
        )}
        role="tooltip"
      >
        {content}
      </span>
    </span>
  )
}
