import { useMemo } from 'react'
import { Tooltip } from '@/components/ui/Tooltip'
import { formatDuration } from '@/lib/utils'
import type { HeatmapDay } from '@/types'

interface HeatmapGridProps {
  data: HeatmapDay[]
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
  const { weeks, monthLabels } = useMemo(() => {
    const map = new Map(data.map((entry) => [entry.date, entry]))

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const currentWeekStart = new Date(today)
    const day = currentWeekStart.getDay()
    const offsetFromMonday = (day + 6) % 7
    currentWeekStart.setDate(currentWeekStart.getDate() - offsetFromMonday)

    const firstWeekStart = new Date(currentWeekStart)
    firstWeekStart.setDate(firstWeekStart.getDate() - 51 * 7)

    const nextWeeks: Array<Array<HeatmapDay>> = []
    const labels: Array<{ index: number; label: string }> = []

    for (let weekIndex = 0; weekIndex < 52; weekIndex += 1) {
      const weekStart = new Date(firstWeekStart)
      weekStart.setDate(firstWeekStart.getDate() + weekIndex * 7)

      const monthLabel = weekStart.toLocaleDateString('en-US', { month: 'short' })
      if (weekIndex === 0 || labels[labels.length - 1]?.label !== monthLabel) {
        labels.push({ index: weekIndex, label: monthLabel })
      }

      const weekDays: HeatmapDay[] = []

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

        weekDays.push(map.get(key) ?? fallback)
      }

      nextWeeks.push(weekDays)
    }

    return { weeks: nextWeeks, monthLabels: labels }
  }, [data])

  return (
    <div className="overflow-x-auto">
      <div className="min-w-max">
        <div className="mb-2 ml-8 flex gap-[2px]">
          {Array.from({ length: 52 }).map((_, weekIndex) => {
            const label = monthLabels.find((entry) => entry.index === weekIndex)
            return (
              <div className="w-3" key={`month-${weekIndex}`}>
                {label ? (
                  <span className="text-[10px] text-ink-tertiary">{label.label}</span>
                ) : null}
              </div>
            )
          })}
        </div>

        <div className="flex gap-2">
          <div className="grid grid-rows-7 gap-[2px]">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, index) => (
              <div className="h-3 text-[10px] text-ink-tertiary" key={`${label}-${index}`}>
                {label}
              </div>
            ))}
          </div>

          <div className="flex gap-[2px]">
            {weeks.map((week, weekIndex) => (
              <div className="grid grid-rows-7 gap-[2px]" key={`week-${weekIndex}`}>
                {week.map((day) => {
                  const categoryBreakdown = day.byCategory
                    .map((bucket) => `${bucket.categoryName}: ${formatDuration(bucket.seconds)}`)
                    .join(' | ')

                  const title = `${day.date}\n${formatDuration(day.totalSeconds)}${
                    categoryBreakdown ? `\n${categoryBreakdown}` : ''
                  }`

                  return (
                    <Tooltip
                      className="h-3 w-3"
                      content={<span className="block whitespace-pre-line">{title}</span>}
                      key={day.date}
                    >
                      <div
                        className="h-full w-full rounded-[2px]"
                        style={{ backgroundColor: getHeatmapColor(day) }}
                      />
                    </Tooltip>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
