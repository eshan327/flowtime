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
    <div className="inline-flex rounded-lg border border-surface-border bg-surface-raised p-1">
      {OPTIONS.map((option) => (
        <button
          className={`rounded-md px-3 py-1.5 text-sm transition ${
            value === option.value
              ? 'bg-surface-overlay text-ink-primary'
              : 'text-ink-secondary hover:text-ink-primary'
          }`}
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
