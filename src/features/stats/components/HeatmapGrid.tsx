import { useMemo, useState } from 'react'
import { DEFAULT_NEUTRAL_COLOR, EMPTY_HEATMAP_COLOR } from '@/lib/colors'
import { formatDuration } from '@/lib/formatting'
import type { HeatmapDay } from '@/types'

interface HeatmapGridProps {
  data: HeatmapDay[]
  selectedDate?: string | null
  onSelectDay?: (day: HeatmapDay) => void
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

function hexToRgba(hex: string, alpha: number) {
  const sanitized = hex.replace('#', '')
  const r = Number.parseInt(sanitized.slice(0, 2), 16)
  const g = Number.parseInt(sanitized.slice(2, 4), 16)
  const b = Number.parseInt(sanitized.slice(4, 6), 16)

  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function getHeatmapColor(day: HeatmapDay) {
  if (!day.dominantColor || day.totalSeconds === 0) {
    return EMPTY_HEATMAP_COLOR
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

export function HeatmapGrid({ data, selectedDate = null, onSelectDay }: HeatmapGridProps) {
  const [tooltip, setTooltip] = useState<HeatmapTooltipState | null>(null)

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

    const ranges = labels.map((entry) => ({
      label: entry.label,
      startIndex: entry.index,
    }))

    return { weeks: nextWeeks, monthRanges: ranges }
  }, [data])

  const tooltipPosition = useMemo(() => {
    if (!tooltip || typeof window === 'undefined') return null

    const tooltipWidth = 240
    const tooltipHeight = Math.min(220, 92 + tooltip.byCategory.length * 20)

    const maxLeft = window.innerWidth - tooltipWidth - 8
    const maxTop = window.innerHeight - tooltipHeight - 8
    const left = Math.min(maxLeft, Math.max(8, tooltip.x - tooltipWidth / 2))
    const top = Math.max(
      8,
      tooltip.y + 10 > maxTop ? tooltip.y - tooltipHeight - 18 : tooltip.y + 10
    )

    return { left, top }
  }, [tooltip])
  const legendColor = data.find((day) => day.dominantColor)?.dominantColor ?? DEFAULT_NEUTRAL_COLOR

  const setTooltipFromEvent = (
    event: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>,
    day: HeatmapCell
  ) => {
    if (day.isFuture) return

    const rect = event.currentTarget.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.bottom

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
      <div className="-mx-1 min-w-0 overflow-x-auto px-1 pb-1">
        <div className="grid min-w-[42rem] grid-cols-[20px_1fr] gap-2">
          <div />

          <div className="relative min-h-4">
            {monthRanges.map((month) => (
              <span
                className="absolute top-0 whitespace-nowrap text-[10px] text-ink-tertiary"
                key={`${month.label}-${month.startIndex}`}
                style={{ left: `${(month.startIndex / 52) * 100}%` }}
              >
                {month.label}
              </span>
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
                      className={`aspect-square w-full rounded-[2px] outline-none transition-transform hover:scale-105 focus-visible:ring-1 focus-visible:ring-accent-primary ${
                        selectedDate === day.date
                          ? 'ring-2 ring-accent-primary ring-offset-1 ring-offset-surface-panel'
                          : ''
                      }`}
                      key={day.date}
                      onBlur={() => setTooltip(null)}
                      onClick={() => {
                        onSelectDay?.(day)
                      }}
                      onFocus={(event) => setTooltipFromEvent(event, day)}
                      onMouseEnter={(event) => setTooltipFromEvent(event, day)}
                      onMouseLeave={() => setTooltip(null)}
                      style={{ backgroundColor: getHeatmapColor(day) }}
                      type="button"
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-3 text-[11px] text-ink-tertiary">
        <span>Color = top category</span>
        <span
          className="flex items-center gap-1"
          aria-label="Higher intensity means more focus time"
        >
          <span>Less</span>
          {[0.25, 0.5, 0.75, 1].map((opacity) => (
            <span
              className="h-2.5 w-2.5 rounded-[2px]"
              key={opacity}
              style={{ backgroundColor: legendColor, opacity }}
            />
          ))}
          <span>More focus</span>
        </span>
      </div>

      {tooltip && tooltipPosition ? (
        <div
          className="pointer-events-none fixed z-50 w-[240px] max-w-[calc(100vw-16px)] rounded-[4px] border border-surface-border bg-surface-panel p-3 text-xs text-ink-secondary shadow-xl"
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
