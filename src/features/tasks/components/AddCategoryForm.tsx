import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { COLOR_PRESETS } from '@/features/tasks/constants'
import { ColorPicker } from '@/features/tasks/components/ColorPicker'
import { getErrorMessage } from '@/lib/errorMessages'

interface AddCategoryFormProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (input: {
    name: string
    color: string
    breakDivisor: number | null
  }) => Promise<void> | void
}

const MIN_BREAK_DIVISOR = 2
const MAX_BREAK_DIVISOR = 10

export function AddCategoryForm({ isOpen, onClose, onCreate }: AddCategoryFormProps) {
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(COLOR_PRESETS[0])
  const [breakDivisorInput, setBreakDivisorInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClose = useCallback(() => {
    setName('')
    setColor(COLOR_PRESETS[0])
    setBreakDivisorInput('')
    setIsSubmitting(false)
    setError(null)
    onClose()
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return

    nameInputRef.current?.focus()
  }, [isOpen])

  const handleSubmit = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Category name is required.')
      return
    }

    if (isSubmitting) return

    const parsedBreakDivisor =
      breakDivisorInput.trim().length === 0 ? null : Number(breakDivisorInput)

    if (
      parsedBreakDivisor !== null &&
      (!Number.isInteger(parsedBreakDivisor) ||
        parsedBreakDivisor < MIN_BREAK_DIVISOR ||
        parsedBreakDivisor > MAX_BREAK_DIVISOR)
    ) {
      setError(
        `Break divisor must be an integer between ${MIN_BREAK_DIVISOR} and ${MAX_BREAK_DIVISOR}.`
      )
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await onCreate({ name: trimmed, color, breakDivisor: parsedBreakDivisor })
      handleClose()
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Unable to create category.'))
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="New category">
      <Input
        autoCapitalize="off"
        autoComplete="new-password"
        autoCorrect="off"
        error={error ?? undefined}
        label="Name"
        name="category-title"
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            void handleSubmit()
          }
        }}
        ref={nameInputRef}
        spellCheck={false}
        value={name}
      />

      <p className="mt-4 text-xs uppercase tracking-[0.1em] text-ink-tertiary">Color</p>
      <div className="mt-2">
        <ColorPicker onChange={setColor} value={color} />
      </div>

      <Input
        className="mt-4"
        label="Category break divisor (optional)"
        max={MAX_BREAK_DIVISOR}
        min={MIN_BREAK_DIVISOR}
        onChange={(event) => setBreakDivisorInput(event.target.value)}
        placeholder="Use global timer default"
        type="number"
        value={breakDivisorInput}
      />

      <p className="mt-2 text-xs text-ink-secondary">
        Leave blank to use the global timer divisor.
      </p>

      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={handleClose} variant="ghost">
          Cancel
        </Button>
        <Button
          loading={isSubmitting}
          onClick={() => {
            void handleSubmit()
          }}
          variant="filled"
        >
          {isSubmitting ? 'Creating...' : 'Create category'}
        </Button>
      </div>
    </Modal>
  )
}
