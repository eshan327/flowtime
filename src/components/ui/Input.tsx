import { forwardRef, useId } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  containerClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { id, label, error, className, containerClassName, ...props },
  ref
) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <div className={cn('w-full', containerClassName)}>
      {label ? (
        <label
          className="block text-xs uppercase tracking-[0.1em] text-ink-tertiary"
          htmlFor={inputId}
        >
          {label}
        </label>
      ) : null}

      <input
        className={cn(
          'w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-ink-primary outline-none transition focus:border-ink-secondary',
          label ? 'mt-2' : '',
          error ? 'border-red-400/70 focus:border-red-300' : '',
          className
        )}
        id={inputId}
        ref={ref}
        {...props}
      />

      {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
    </div>
  )
})
