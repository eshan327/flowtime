import { calendarRange, dateKeyInZone, midnightInZone } from './timezone'
import { toEndOfDay, toStartOfDay, toWeekStart } from '@/lib/dateMath'
import type { TimeRange } from '@/types'

export function getRangeDatesForAnchor(
  range: TimeRange,
  anchorDate: Date,
  timezone?: string
): { from: Date; to: Date } {
  if (timezone) return calendarRange(range, anchorDate, timezone)
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

export function shiftRangeAnchor(
  range: TimeRange,
  anchorDate: Date,
  direction: -1 | 1,
  timezone?: string
): Date {
  if (timezone) {
    const key = dateKeyInZone(anchorDate, timezone)
    const d = new Date(key + 'T12:00:00Z')
    if (range === 'day') d.setUTCDate(d.getUTCDate() + direction)
    else if (range === 'week') d.setUTCDate(d.getUTCDate() + 7 * direction)
    else if (range === 'month') {
      d.setUTCDate(1)
      d.setUTCMonth(d.getUTCMonth() + direction)
    } else {
      d.setUTCMonth(0, 1)
      d.setUTCFullYear(d.getUTCFullYear() + direction)
    }
    return midnightInZone(d.toISOString().slice(0, 10), timezone)
  }
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

export function formatRangeWindow(range: TimeRange, from: Date, to: Date, timezone?: string) {
  if (timezone) {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      month: range === 'year' ? undefined : 'short',
      day: range === 'day' || range === 'week' ? 'numeric' : undefined,
      year: range === 'week' ? undefined : 'numeric',
    }
    const a = from.toLocaleDateString('en-US', options)
    return range === 'week'
      ? a + ' – ' + new Date(to.getTime() - 1).toLocaleDateString('en-US', options)
      : a
  }
  if (range === 'day') {
    return from.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (range === 'week') {
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
    return `${from.toLocaleDateString('en-US', options)} – ${to.toLocaleDateString('en-US', options)}`
  }

  return from.toLocaleDateString(
    'en-US',
    range === 'month' ? { month: 'long', year: 'numeric' } : { year: 'numeric' }
  )
}
