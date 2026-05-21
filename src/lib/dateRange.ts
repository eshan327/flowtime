import { toEndOfDay, toStartOfDay, toWeekStart } from '@/lib/dateMath'
import type { TimeRange } from '@/types'

export function getRangeDates(range: TimeRange): { from: Date; to: Date } {
  return getRangeDatesForAnchor(range, new Date())
}

export function getRangeDatesForAnchor(
  range: TimeRange,
  anchorDate: Date
): { from: Date; to: Date } {
  const anchor = new Date(anchorDate)

  if (range === 'day') {
    const from = toStartOfDay(anchor)
    return { from, to: toEndOfDay(from) }
  }

  if (range === 'week') {
    const from = toWeekStart(anchor)
    const to = new Date(from)
    to.setDate(from.getDate() + 6)
    return { from, to: toEndOfDay(to) }
  }

  if (range === 'month') {
    const from = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    const to = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
    return { from, to: toEndOfDay(to) }
  }

  const from = new Date(anchor.getFullYear(), 0, 1)
  const to = new Date(anchor.getFullYear(), 11, 31)
  return { from, to: toEndOfDay(to) }
}

export function shiftRangeAnchor(range: TimeRange, anchorDate: Date, direction: -1 | 1): Date {
  const { from } = getRangeDatesForAnchor(range, anchorDate)
  const next = new Date(from)

  if (range === 'day') {
    next.setDate(next.getDate() + direction)
    return next
  }

  if (range === 'week') {
    next.setDate(next.getDate() + direction * 7)
    return next
  }

  if (range === 'month') {
    next.setMonth(next.getMonth() + direction)
    return next
  }

  next.setFullYear(next.getFullYear() + direction)
  return next
}
