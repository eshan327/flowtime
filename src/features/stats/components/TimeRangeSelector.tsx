import type { TimeRange } from '@/types'

interface TimeRangeSelectorProps {
  value: TimeRange
  onChange: (next: TimeRange) => void
}

const OPTIONS: Array<{ label: string; value: TimeRange }> = [
  { label: 'Day', value: 'day' },
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'Year', value: 'year' },
]

export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  return (
    <select
      aria-label="Focus time range"
      className="rounded border border-surface-border bg-surface-overlay px-2 py-1 text-sm text-ink-primary"
      onChange={(event) => onChange(event.target.value as TimeRange)}
      value={value}
    >
      {OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label.toLowerCase()}
        </option>
      ))}
    </select>
  )
}
