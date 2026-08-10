interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <label className="flex items-center gap-3 text-sm text-ink-secondary">
      <input
        aria-label="Choose color"
        className="h-9 w-14 cursor-pointer rounded-lg border border-surface-border bg-surface-overlay p-1"
        onChange={(event) => onChange(event.target.value)}
        type="color"
        value={value}
      />
      <span className="font-mono text-xs uppercase tracking-wide">{value}</span>
    </label>
  )
}
