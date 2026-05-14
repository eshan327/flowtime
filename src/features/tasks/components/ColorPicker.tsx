import { useRef } from 'react'
import { Palette } from 'lucide-react'
import { COLOR_PRESETS } from '@/features/tasks/constants'

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const colorInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="grid grid-cols-5 gap-2">
      {COLOR_PRESETS.map((hex) => (
        <button
          aria-label={`Select color ${hex}`}
          className={`h-7 w-7 rounded-full transition-shadow ${
            value === hex ? 'ring-2 ring-white ring-offset-1 ring-offset-surface-base' : ''
          }`}
          key={hex}
          onClick={() => onChange(hex)}
          style={{ backgroundColor: hex }}
          type="button"
        />
      ))}

      <button
        aria-label="Pick custom color"
        className="flex h-7 w-7 items-center justify-center rounded-full border border-surface-border text-ink-secondary transition hover:border-ink-secondary hover:text-ink-primary"
        onClick={() => colorInputRef.current?.click()}
        type="button"
      >
        <Palette className="h-4 w-4" />
      </button>

      <input
        className="sr-only"
        onChange={(event) => onChange(event.target.value)}
        ref={colorInputRef}
        type="color"
        value={value}
      />
    </div>
  )
}
