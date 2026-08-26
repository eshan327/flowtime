import { useEffect, useRef, useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface AddTaskFormProps {
  label: string
  onAdd: (name: string) => Promise<unknown> | void
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
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
    }
  }, [isOpen])

  useEffect(() => {
    if (!prominent) return

    const openFromShortcut = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'n' || event.metaKey || event.ctrlKey || event.altKey) return
      if (isTypingTarget(event.target)) return
      event.preventDefault()
      setIsOpen(true)
    }

    window.addEventListener('keydown', openFromShortcut)
    return () => window.removeEventListener('keydown', openFromShortcut)
  }, [prominent])

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
      <Button
        className={
          prominent
            ? 'h-14 w-full justify-start border-surface-border px-5 text-base text-ink-tertiary hover:text-ink-primary'
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
    <div
      className={`flex items-center gap-2 ${prominent ? 'rounded-md border border-surface-border bg-surface-sidebar/40 p-2' : ''}`}
    >
      <Input
        autoCapitalize="off"
        autoComplete="new-password"
        autoCorrect="off"
        name="task-title"
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
        placeholder="Task title"
        ref={inputRef}
        spellCheck={false}
        value={value}
      />

      <Button
        aria-label="Save"
        className="p-0"
        disabled={isSubmitting}
        loading={isSubmitting}
        onClick={() => {
          void handleSubmit()
        }}
        size="icon"
        variant="outlined"
      >
        {!isSubmitting ? <Check className="h-4 w-4" /> : null}
      </Button>

      <Button aria-label="Cancel" className="p-0" onClick={reset} size="icon" variant="outlined">
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
