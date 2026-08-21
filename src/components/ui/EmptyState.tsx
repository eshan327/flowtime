import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, action, className }: EmptyStateProps) {
  return (
    <div className={cn('px-4 py-6 text-center', className)}>
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center text-accent-primary">
        {icon}
      </div>

      <h3 className="text-sm font-medium text-ink-primary">{title}</h3>

      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
