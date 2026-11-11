import { useEffect, useRef, useState } from 'react'
import { CalendarDays, Check, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { getErrorMessage } from '@/lib/errorMessages'
import { Input } from '@/components/ui/Input'

interface AddTaskFormProps {
  label: string
  onAdd: (name: string, dueDate: string | null) => Promise<unknown> | void
  prominent?: boolean
}

function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  )
}

export function AddTaskForm({ label, onAdd, prominent = false }: AddTaskFormProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [value, setValue] = useState('')
  const [showDueDate, setShowDueDate] = useState(false)
  const [dueDate, setDueDate] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
    }
  }, [isOpen])

  useEffect(() => {
    if (!prominent) return

    const openFromShortcut = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'n' || event.metaKey || event.ctrlKey || event.altKey) return
      if (isTypingTarget(event.target) || document.querySelector('dialog[open]')) return
      event.preventDefault()
      setIsOpen(true)
    }

    window.addEventListener('keydown', openFromShortcut)
    return () => window.removeEventListener('keydown', openFromShortcut)
  }, [prominent])

  const reset = () => {
    setIsOpen(false)
    setValue('')
    setShowDueDate(false)
    setDueDate('')
    setError(null)
    setIsSubmitting(false)
  }

  const handleSubmit = async () => {
    const trimmed = value.trim()
    if (!trimmed || isSubmitting) return

    setIsSubmitting(true)
    setError(null)
    try {
      await onAdd(trimmed, dueDate || null)
      reset()
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Unable to add task. Please try again.'))
      setIsSubmitting(false)
    }
  }

  if (!isOpen) {
    return (
      <Button
        className={
          prominent
            ? 'h-16 w-full justify-start border-surface-border px-5 text-base text-ink-tertiary hover:border-accent-primary/50 hover:text-ink-primary'
            : 'gap-1 px-0 text-base'
        }
        onClick={() => setIsOpen(true)}
        variant={prominent ? 'outlined' : 'ghost'}
      >
        <Plus className={prominent ? 'h-5 w-5' : 'h-4 w-4'} />
        <span>{label}</span>
        {prominent ? (
          <kbd className="ml-auto rounded border border-surface-border px-2 py-0.5 font-sans text-xs text-ink-tertiary">
            N
          </kbd>
        ) : null}
      </Button>
    )
  }

  return (
    <form
      className={`space-y-2 ${prominent ? 'rounded-[4px] border border-surface-border p-2' : ''}`}
      onSubmit={(event) => {
        event.preventDefault()
        void handleSubmit()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !isSubmitting) {
          event.preventDefault()
          reset()
        }
      }}
    >
      <div className="flex items-center gap-2">
        <Input
          aria-label={label}
          error={error ?? undefined}
          disabled={isSubmitting}
          autoCapitalize="off"
          autoComplete="new-password"
          autoCorrect="off"
          name="task-title"
          onChange={(event) => setValue(event.target.value)}
          containerClassName="min-w-0 flex-1"
          maxLength={200}
          placeholder="Task title"
          ref={inputRef}
          spellCheck={false}
          value={value}
        />

        <Button
          aria-label="Save"
          className="shrink-0 p-0"
          disabled={isSubmitting || !value.trim()}
          loading={isSubmitting}
          type="submit"
          size="icon"
          variant="outlined"
        >
          {!isSubmitting ? <Check className="h-4 w-4" /> : null}
        </Button>

        <Button
          aria-label="Cancel"
          disabled={isSubmitting}
          className="shrink-0 p-0"
          onClick={reset}
          size="icon"
          variant="outlined"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      {showDueDate ? (
        <div className="flex items-end gap-2 px-1 pb-1">
          <Input
            autoFocus
            containerClassName="min-w-0 max-w-56"
            disabled={isSubmitting}
            label="Due date (optional)"
            max="9999-12-31"
            onChange={(event) => setDueDate(event.target.value)}
            type="date"
            value={dueDate}
          />
          <Button
            aria-label="Remove due date"
            className="shrink-0 text-ink-tertiary"
            disabled={isSubmitting}
            onClick={() => {
              setDueDate('')
              setShowDueDate(false)
              inputRef.current?.focus()
            }}
            size="icon"
            variant="ghost"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button
          className="gap-1.5 px-2 text-xs text-ink-tertiary"
          disabled={isSubmitting}
          onClick={() => setShowDueDate(true)}
          size="sm"
          variant="ghost"
        >
          <CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />
          Due date
        </Button>
      )}
    </form>
  )
}
