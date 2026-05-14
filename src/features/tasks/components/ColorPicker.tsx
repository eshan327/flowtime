import { useRef } from 'react'
import { Palette } from 'lucide-react'
import { Button } from '@/components/ui/Button'
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
        <Button
          aria-label={`Select color ${hex}`}
          className={`h-7 w-7 rounded-full p-0 transition-shadow ${
            value === hex ? 'ring-2 ring-white ring-offset-1 ring-offset-surface-base' : ''
          }`}
          key={hex}
          onClick={() => onChange(hex)}
          size="icon"
          style={{ backgroundColor: hex }}
          variant="ghost"
        />
      ))}

      <Button
        aria-label="Pick custom color"
        className="h-7 w-7 rounded-full p-0"
        onClick={() => colorInputRef.current?.click()}
        size="icon"
        variant="outlined"
      >
        <Palette className="h-4 w-4" />
      </Button>

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
