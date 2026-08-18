import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

type ButtonVariant = 'filled' | 'outlined' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

const variantClasses: Record<ButtonVariant, string> = {
  filled:
    'border border-accent-primary bg-accent-primary text-[#181926] hover:border-[#b7bdf8] hover:bg-[#b7bdf8] focus-visible:ring-accent-primary',
  outlined:
    'border border-surface-border bg-transparent text-ink-primary hover:border-[#5b6078] hover:bg-surface-overlay focus-visible:ring-accent-primary',
  ghost:
    'border border-transparent text-ink-secondary hover:bg-surface-overlay hover:text-ink-primary focus-visible:ring-accent-primary',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-sm',
  icon: 'h-9 w-9 p-0',
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'outlined',
    size = 'md',
    loading = false,
    type = 'button',
    disabled,
    className,
    children,
    ...props
  },
  ref
) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base disabled:cursor-not-allowed disabled:opacity-60',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      disabled={disabled || loading}
      ref={ref}
      type={type}
      {...props}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      ) : null}
      {children}
    </button>
  )
})
