import { useEffect, useRef, useState } from 'react'
import { Check, Plus, X } from 'lucide-react'

interface AddTaskFormProps {
  label: string
  onAdd: (name: string) => Promise<void> | void
}

export function AddTaskForm({ label, onAdd }: AddTaskFormProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [value, setValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
    }
  }, [isOpen])

  const reset = () => {
    setIsOpen(false)
    setValue('')
    setIsSubmitting(false)
  }

  const handleSubmit = async () => {
    const trimmed = value.trim()
    if (!trimmed || isSubmitting) return

    setIsSubmitting(true)
    try {
      await onAdd(trimmed)
      reset()
    } catch {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        className="inline-flex items-center gap-1 text-sm text-ink-secondary transition hover:text-ink-primary"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <Plus className="h-4 w-4" />
        {label}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <input
        className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-ink-primary outline-none transition focus:border-ink-secondary"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            void handleSubmit()
          }

          if (event.key === 'Escape') {
            event.preventDefault()
            reset()
          }
        }}
        placeholder="Name"
        ref={inputRef}
        value={value}
      />

      <button
        aria-label="Save"
        className="rounded-md border border-surface-border p-2 text-ink-secondary transition hover:border-ink-secondary hover:text-ink-primary disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
        onClick={() => {
          void handleSubmit()
        }}
        type="button"
      >
        <Check className="h-4 w-4" />
      </button>

      <button
        aria-label="Cancel"
        className="rounded-md border border-surface-border p-2 text-ink-secondary transition hover:border-ink-secondary hover:text-ink-primary"
        onClick={reset}
        type="button"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
