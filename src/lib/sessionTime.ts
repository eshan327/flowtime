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
  return splitSessionTime(session, 'day').reduce(
    (sum, slice) =>
      (!from || slice.start >= from) && (!to || slice.start <= to) ? sum + slice.seconds : sum,
    0
  )
}
