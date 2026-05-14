import { useMemo, useState } from 'react'
import { formatDuration } from '@/lib/utils'
import type { HeatmapDay } from '@/types'

interface HeatmapGridProps {
  data: HeatmapDay[]
}

interface HeatmapCell extends HeatmapDay {
  isFuture: boolean
}

interface HeatmapTooltipState {
  date: string
  totalSeconds: number
  byCategory: HeatmapDay['byCategory']
  x: number
  y: number
}

interface MonthRange {
  label: string
  startIndex: number
  endIndex: number
}

function hexToRgba(hex: string, alpha: number) {
  const sanitized = hex.replace('#', '')
  const r = Number.parseInt(sanitized.slice(0, 2), 16)
  const g = Number.parseInt(sanitized.slice(2, 4), 16)
  const b = Number.parseInt(sanitized.slice(4, 6), 16)

  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function getHeatmapColor(day: HeatmapDay) {
  if (!day.dominantColor || day.totalSeconds === 0) {
    return '#2e2c29'
  }

  const minutes = day.totalSeconds / 60
  if (minutes <= 30) {
    return hexToRgba(day.dominantColor, 0.3)
  }

  if (minutes <= 60) {
    return hexToRgba(day.dominantColor, 0.55)
  }

  if (minutes <= 120) {
    return hexToRgba(day.dominantColor, 0.8)
  }

  return day.dominantColor
}

export function HeatmapGrid({ data }: HeatmapGridProps) {
  const [tooltip, setTooltip] = useState<HeatmapTooltipState | null>(null)
  const [hoveredMonthRange, setHoveredMonthRange] = useState<MonthRange | null>(null)

  const { weeks, monthRanges } = useMemo(() => {
    const map = new Map(data.map((entry) => [entry.date, entry]))

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const currentWeekStart = new Date(today)
    const day = currentWeekStart.getDay()
    currentWeekStart.setDate(currentWeekStart.getDate() - day)

    const firstWeekStart = new Date(currentWeekStart)
    firstWeekStart.setDate(firstWeekStart.getDate() - 51 * 7)

    const nextWeeks: Array<Array<HeatmapCell>> = []
    const labels: Array<{ index: number; label: string }> = []

    for (let weekIndex = 0; weekIndex < 52; weekIndex += 1) {
      const weekStart = new Date(firstWeekStart)
      weekStart.setDate(firstWeekStart.getDate() + weekIndex * 7)

      const monthLabel = weekStart.toLocaleDateString('en-US', { month: 'short' })
      if (weekIndex === 0 || labels[labels.length - 1]?.label !== monthLabel) {
        labels.push({ index: weekIndex, label: monthLabel })
      }

      const weekDays: HeatmapCell[] = []

      for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
        const current = new Date(weekStart)
        current.setDate(weekStart.getDate() + dayIndex)
        const key = current.toLocaleDateString('en-CA')
        const fallback: HeatmapDay = {
          date: key,
          totalSeconds: 0,
          dominantColor: null,
          byCategory: [],
        }
        const isFuture = current > today

        weekDays.push({
          ...(map.get(key) ?? fallback),
          isFuture,
        })
      }

      nextWeeks.push(weekDays)
    }

    const ranges = labels.map((entry, index) => {
      const next = labels[index + 1]
      return {
        label: entry.label,
        startIndex: entry.index,
        endIndex: next ? next.index - 1 : 51,
      }
    })

    return { weeks: nextWeeks, monthRanges: ranges }
  }, [data])

  const tooltipPosition = useMemo(() => {
    if (!tooltip || typeof window === 'undefined') return null

    const tooltipWidth = 280
    const tooltipHeight = Math.min(220, 92 + tooltip.byCategory.length * 20)

    let left = tooltip.x + 14
    let top = tooltip.y + 14

    const maxLeft = window.innerWidth - tooltipWidth - 8
    const maxTop = window.innerHeight - tooltipHeight - 8

    if (left > maxLeft) {
      left = tooltip.x - tooltipWidth - 14
    }

    if (top > maxTop) {
      top = tooltip.y - tooltipHeight - 14
    }

    left = Math.max(8, left)
    top = Math.max(8, top)

    return { left, top }
  }, [tooltip])

  const setTooltipFromEvent = (
    event: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>,
    day: HeatmapCell
  ) => {
    if (day.isFuture) return

    let x = 0
    let y = 0

    if ('clientX' in event) {
      x = event.clientX
      y = event.clientY
    } else {
      const rect = event.currentTarget.getBoundingClientRect()
      x = rect.left + rect.width / 2
      y = rect.top + rect.height / 2
    }

    setTooltip({
      date: day.date,
      totalSeconds: day.totalSeconds,
      byCategory: day.byCategory,
      x,
      y,
    })
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-[20px_1fr] gap-2">
        <div />

        <div className="relative min-h-4">
          {monthRanges.map((month) => (
            <button
              className="absolute top-0 whitespace-nowrap text-[10px] text-ink-tertiary transition hover:text-ink-primary"
              key={`${month.label}-${month.startIndex}`}
              onBlur={() => setHoveredMonthRange(null)}
              onFocus={() => setHoveredMonthRange(month)}
              onMouseEnter={() => setHoveredMonthRange(month)}
              onMouseLeave={() => setHoveredMonthRange(null)}
              style={{ left: `${(month.startIndex / 52) * 100}%` }}
              type="button"
            >
              {month.label}
            </button>
          ))}
        </div>

        <div className="grid grid-rows-7 gap-[2px] text-[10px] text-ink-tertiary">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, index) => (
            <div className="flex items-center" key={`${label}-${index}`}>
              {label}
            </div>
          ))}
        </div>

        <div
          className="grid gap-[2px]"
          style={{ gridTemplateColumns: 'repeat(52, minmax(0, 1fr))' }}
        >
          {weeks.map((week, weekIndex) => (
            <div className="grid grid-rows-7 gap-[2px]" key={`week-${weekIndex}`}>
              {week.map((day) => {
                if (day.isFuture) {
                  return (
                    <div
                      className="aspect-square w-full rounded-[2px] bg-transparent"
                      key={day.date}
                    />
                  )
                }

                return (
                  <button
                    aria-label={`${day.date}: ${formatDuration(day.totalSeconds)}`}
                    className={`aspect-square w-full rounded-[2px] outline-none transition-transform hover:scale-105 focus-visible:ring-1 focus-visible:ring-ink-primary ${
                      hoveredMonthRange &&
                      weekIndex >= hoveredMonthRange.startIndex &&
                      weekIndex <= hoveredMonthRange.endIndex
                        ? 'ring-1 ring-ink-secondary/30 shadow-[0_0_8px_rgba(240,237,232,0.2)]'
                        : ''
                    }`}
                    key={day.date}
                    onBlur={() => setTooltip(null)}
                    onFocus={(event) => setTooltipFromEvent(event, day)}
                    onMouseEnter={(event) => setTooltipFromEvent(event, day)}
                    onMouseLeave={() => setTooltip(null)}
                    onMouseMove={(event) => {
                      setTooltip((current) =>
                        current
                          ? {
                              ...current,
                              x: event.clientX,
                              y: event.clientY,
                            }
                          : current
                      )
                    }}
                    style={{ backgroundColor: getHeatmapColor(day) }}
                    type="button"
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {tooltip && tooltipPosition ? (
        <div
          className="pointer-events-none fixed z-50 max-w-[280px] rounded-lg border border-surface-border bg-surface-overlay p-3 text-xs text-ink-secondary shadow-xl"
          style={{ left: tooltipPosition.left, top: tooltipPosition.top }}
        >
          <p className="text-ink-primary">{tooltip.date}</p>
          <p className="mt-1">{formatDuration(tooltip.totalSeconds)}</p>

          {tooltip.byCategory.length > 0 ? (
            <div className="mt-2 space-y-1">
              {tooltip.byCategory.map((bucket) => (
                <p key={`${tooltip.date}-${bucket.categoryId ?? 'uncategorized'}`}>
                  {bucket.categoryName}: {formatDuration(bucket.seconds)}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
