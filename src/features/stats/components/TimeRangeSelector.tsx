import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { TimeRange } from '@/types'
import { Button } from '@/components/ui/Button'

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
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (!containerRef.current?.contains(target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [isOpen])

  const activeLabel = OPTIONS.find((option) => option.value === value)?.label ?? 'Week'

  return (
    <div className="relative inline-flex" ref={containerRef}>
      <Button
        className="gap-2 px-2 py-1 text-sm text-ink-primary"
        onClick={() => setIsOpen((current) => !current)}
        size="sm"
        variant="ghost"
      >
        {activeLabel.toLowerCase()}
        <ChevronDown className="h-3.5 w-3.5 text-ink-tertiary" />
      </Button>

      {isOpen ? (
        <div className="absolute left-0 top-full z-20 mt-1 min-w-28 rounded-lg border border-surface-border bg-surface-overlay p-1 shadow-lg">
          {OPTIONS.map((option) => (
            <Button
              className={`w-full justify-start rounded-md px-3 py-2 text-left text-sm transition ${
                value === option.value
                  ? 'bg-surface-raised text-ink-primary'
                  : 'text-ink-secondary hover:bg-surface-raised hover:text-ink-primary'
              }`}
              key={option.value}
              onClick={() => {
                onChange(option.value)
                setIsOpen(false)
              }}
              size="sm"
              variant="ghost"
            >
              {option.label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
