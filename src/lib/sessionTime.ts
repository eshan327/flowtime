import { toStartOfDay } from './dateMath.ts'

interface TimedSession {
  started_at: string
  ended_at: string
  work_seconds: number
}

export function splitSessionTime(session: TimedSession, unit: 'day' | 'hour') {
  const start = new Date(session.started_at).getTime()
  const end = new Date(session.ended_at).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return [{ start: new Date(session.started_at), seconds: session.work_seconds }]
  }

  const slices: { start: Date; seconds: number }[] = []
  for (let cursor = start; cursor < end; ) {
    const boundary = unit === 'day' ? toStartOfDay(new Date(cursor)) : new Date(cursor)
    if (unit === 'day') boundary.setDate(boundary.getDate() + 1)
    else {
      boundary.setMinutes(0, 0, 0)
      boundary.setTime(boundary.getTime() + 3_600_000)
    }
    const next = Math.min(end, boundary.getTime())
    const seconds =
      Math.round((session.work_seconds * (next - start)) / (end - start)) -
      Math.round((session.work_seconds * (cursor - start)) / (end - start))
    slices.push({ start: new Date(cursor), seconds })
    cursor = next
  }
  return slices
}

export function workSecondsInDateRange(session: TimedSession, from: Date | null, to: Date | null) {
  const a = Date.parse(session.started_at),
    b = Date.parse(session.ended_at)
  const start = from?.getTime() ?? -Infinity,
    end = to?.getTime() ?? Infinity
  if (b <= a) return a >= start && a < end ? session.work_seconds : 0
  return Math.max(
    0,
    Math.round((session.work_seconds * (Math.min(b, end) - a)) / (b - a)) -
      Math.round((session.work_seconds * (Math.max(a, start) - a)) / (b - a))
  )
}
