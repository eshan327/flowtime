import { useEffect, useRef, useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface AddTaskFormProps {
  label: string
  onAdd: (name: string) => Promise<unknown> | void
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
      <Button className="gap-1 px-0 text-base" onClick={() => setIsOpen(true)} variant="ghost">
        <Plus className="h-4 w-4" />
        {label}
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-2">
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
