import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-surface-border bg-surface-raised px-4 py-6 text-center',
        className
      )}
    >
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-surface-border text-ink-tertiary">
        {icon}
      </div>

      <h3 className="text-sm text-ink-primary">{title}</h3>
      <p className="mt-1 text-sm text-ink-secondary">{description}</p>

      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
