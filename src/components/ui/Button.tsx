import { cn } from '@/lib/utils'

type ButtonVariant = 'filled' | 'outlined' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

const variantClasses: Record<ButtonVariant, string> = {
  filled:
    'border border-accent-primary bg-accent-primary text-surface-sidebar hover:border-accent-primary-hover hover:bg-accent-primary-hover focus-visible:ring-accent-primary',
  outlined:
    'border border-surface-border-subtle bg-transparent text-ink-primary hover:border-surface-border hover:bg-surface-hover focus-visible:ring-accent-primary',
  ghost:
    'border border-transparent text-ink-secondary hover:bg-surface-hover hover:text-ink-primary focus-visible:ring-accent-primary',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-sm',
  icon: 'h-9 w-9 p-0',
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

export function Button({
  variant = 'outlined',
  size = 'md',
  loading = false,
  type = 'button',
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page disabled:cursor-not-allowed disabled:border-transparent disabled:bg-surface-hover/30 disabled:text-ink-tertiary/50 disabled:opacity-100',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      disabled={disabled || loading}
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
}
