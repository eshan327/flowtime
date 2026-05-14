import { useCallback, useEffect, useRef, useState } from 'react'
import { COLOR_PRESETS } from '@/features/tasks/constants'
import { ColorPicker } from '@/features/tasks/components/ColorPicker'

interface AddCategoryFormProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (input: { name: string; color: string }) => Promise<void> | void
}

export function AddCategoryForm({ isOpen, onClose, onCreate }: AddCategoryFormProps) {
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(COLOR_PRESETS[0])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClose = useCallback(() => {
    setName('')
    setColor(COLOR_PRESETS[0])
    setIsSubmitting(false)
    setError(null)
    onClose()
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return

    nameInputRef.current?.focus()

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, handleClose])

  const handleSubmit = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Category name is required.')
      return
    }

    if (isSubmitting) return

    setIsSubmitting(true)
    setError(null)

    try {
      await onCreate({ name: trimmed, color })
      handleClose()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to create category.')
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-xl border border-surface-border bg-surface-overlay p-5">
        <h2 className="text-lg font-medium text-ink-primary">New category</h2>

        <label
          className="mt-4 block text-xs uppercase tracking-[0.1em] text-ink-tertiary"
          htmlFor="new-category-name"
        >
          Name
        </label>
        <input
          className="mt-2 w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm text-ink-primary outline-none transition focus:border-ink-secondary"
          id="new-category-name"
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void handleSubmit()
            }
          }}
          ref={nameInputRef}
          value={name}
        />

        <p className="mt-4 text-xs uppercase tracking-[0.1em] text-ink-tertiary">Color</p>
        <div className="mt-2">
          <ColorPicker onChange={setColor} value={color} />
        </div>

        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            className="rounded-lg border border-surface-border px-3 py-2 text-sm text-ink-secondary transition hover:border-ink-secondary hover:text-ink-primary"
            onClick={handleClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-lg border border-ink-primary bg-ink-primary px-3 py-2 text-sm text-surface-base transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={isSubmitting}
            onClick={() => {
              void handleSubmit()
            }}
            type="button"
          >
            {isSubmitting ? 'Creating...' : 'Create category'}
          </button>
        </div>
      </div>
    </div>
  )
}
