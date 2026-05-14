import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type {
  CategorySummary,
  DaySummary,
  HeatmapDay,
  SessionWithTask,
  TaskSummary,
  TaskWithCategory,
  TimeRange,
} from '@/types'

const DEFAULT_COLOR = '#a8a8a8'

function pad(num: number) {
  return String(num).padStart(2, '0')
}

function toLocalDateKey(date: Date) {
  return date.toLocaleDateString('en-CA')
}

function toHourKey(date: Date) {
  return `${toLocalDateKey(date)}T${pad(date.getHours())}`
}

function toWeekStart(date: Date) {
  const weekStart = new Date(date)
  weekStart.setHours(0, 0, 0, 0)
  const day = weekStart.getDay()
  const offsetFromMonday = (day + 6) % 7
  weekStart.setDate(weekStart.getDate() - offsetFromMonday)
  return weekStart
}

function getSessionColor(session: SessionWithTask) {
  if (!session.tasks) return DEFAULT_COLOR
  return session.tasks.categories?.color ?? session.tasks.color ?? DEFAULT_COLOR
}

function getSessionCategoryId(session: SessionWithTask) {
  return session.tasks?.category_id ?? null
}

function getSessionCategoryName(session: SessionWithTask) {
  return session.tasks?.categories?.name ?? 'Uncategorized'
}

function aggregateCategorySeconds(sessions: SessionWithTask[]) {
  const map = new Map<
    string,
    { categoryId: string | null; categoryName: string; color: string; seconds: number }
  >()

  for (const session of sessions) {
    const categoryId = getSessionCategoryId(session)
    const mapKey = categoryId ?? 'uncategorized'
    const existing = map.get(mapKey)

    if (existing) {
      existing.seconds += session.work_seconds
      continue
    }

    map.set(mapKey, {
      categoryId,
      categoryName: getSessionCategoryName(session),
      color: getSessionColor(session),
      seconds: session.work_seconds,
    })
  }

  return Array.from(map.values()).sort((a, b) => b.seconds - a.seconds)
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatClock(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60

  return `${pad(minutes)}:${pad(seconds)}`
}

export function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`
  }

  if (hours > 0) {
    return `${hours}h`
  }

  return `${minutes}m`
}

export function formatShortDuration(totalSeconds: number) {
  return formatDuration(totalSeconds)
}

export function getTaskColor(task: TaskWithCategory) {
  return task.categories?.color ?? task.color ?? DEFAULT_COLOR
}

export function computeStreak(sessions: { started_at: string }[]) {
  const uniqueDateKeys = Array.from(
    new Set(sessions.map((session) => toLocalDateKey(new Date(session.started_at))))
  ).sort()

  if (uniqueDateKeys.length === 0) {
    return { current: 0, longest: 0 }
  }

  let longest = 1
  let running = 1

  for (let index = 1; index < uniqueDateKeys.length; index += 1) {
    const prev = new Date(`${uniqueDateKeys[index - 1]}T00:00:00`)
    const curr = new Date(`${uniqueDateKeys[index]}T00:00:00`)
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000))

    if (diffDays === 1) {
      running += 1
      if (running > longest) {
        longest = running
      }
    } else {
      running = 1
    }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const keySet = new Set(uniqueDateKeys)

  let current = 0
  const cursor = new Date(today)

  while (keySet.has(toLocalDateKey(cursor))) {
    current += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return { current, longest }
}

export function aggregateByHour(sessions: SessionWithTask[]): DaySummary[] {
  const now = new Date()
  const dayStart = new Date(now)
  dayStart.setHours(0, 0, 0, 0)

  const dayMap = new Map<string, DaySummary>()

  for (let hour = 0; hour < 24; hour += 1) {
    const keyDate = new Date(dayStart)
    keyDate.setHours(hour, 0, 0, 0)
    const key = toHourKey(keyDate)
    dayMap.set(key, {
      date: key,
      totalSeconds: 0,
      byCategory: [],
    })
  }

  for (const session of sessions) {
    const key = toHourKey(new Date(session.started_at))
    const entry = dayMap.get(key)
    if (!entry) continue

    entry.totalSeconds += session.work_seconds
    entry.byCategory = aggregateCategorySeconds(
      sessions.filter((item) => toHourKey(new Date(item.started_at)) === key)
    )
  }

  return Array.from(dayMap.values())
}

export function aggregateByDay(sessions: SessionWithTask[], from: Date, to: Date): DaySummary[] {
  const start = new Date(from)
  start.setHours(0, 0, 0, 0)

  const end = new Date(to)
  end.setHours(0, 0, 0, 0)

  const map = new Map<string, DaySummary>()

  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const key = toLocalDateKey(cursor)
    map.set(key, { date: key, totalSeconds: 0, byCategory: [] })
  }

  for (const session of sessions) {
    const key = toLocalDateKey(new Date(session.started_at))
    const day = map.get(key)
    if (!day) continue

    day.totalSeconds += session.work_seconds
  }

  for (const [key, day] of map.entries()) {
    day.byCategory = aggregateCategorySeconds(
      sessions.filter((session) => toLocalDateKey(new Date(session.started_at)) === key)
    )
  }

  return Array.from(map.values())
}

export function aggregateByWeek(sessions: SessionWithTask[]): DaySummary[] {
  const thisWeekStart = toWeekStart(new Date())
  const firstWeekStart = new Date(thisWeekStart)
  firstWeekStart.setDate(firstWeekStart.getDate() - 51 * 7)

  const map = new Map<string, DaySummary>()

  for (let index = 0; index < 52; index += 1) {
    const weekStart = new Date(firstWeekStart)
    weekStart.setDate(weekStart.getDate() + index * 7)
    const key = toLocalDateKey(weekStart)
    map.set(key, { date: key, totalSeconds: 0, byCategory: [] })
  }

  for (const session of sessions) {
    const weekKey = toLocalDateKey(toWeekStart(new Date(session.started_at)))
    const week = map.get(weekKey)
    if (!week) continue

    week.totalSeconds += session.work_seconds
  }

  for (const [key, week] of map.entries()) {
    week.byCategory = aggregateCategorySeconds(
      sessions.filter(
        (session) => toLocalDateKey(toWeekStart(new Date(session.started_at))) === key
      )
    )
  }

  return Array.from(map.values())
}

export function aggregateByCategory(sessions: SessionWithTask[]): CategorySummary[] {
  const map = new Map<
    string,
    {
      categoryId: string | null
      categoryName: string
      color: string
      totalSeconds: number
      sessionCount: number
    }
  >()

  for (const session of sessions) {
    const categoryId = getSessionCategoryId(session)
    const mapKey = categoryId ?? 'uncategorized'
    const existing = map.get(mapKey)

    if (existing) {
      existing.totalSeconds += session.work_seconds
      existing.sessionCount += 1
      continue
    }

    map.set(mapKey, {
      categoryId,
      categoryName: getSessionCategoryName(session),
      color: getSessionColor(session),
      totalSeconds: session.work_seconds,
      sessionCount: 1,
    })
  }

  return Array.from(map.values()).sort((a, b) => b.totalSeconds - a.totalSeconds)
}

export function aggregateByTask(sessions: SessionWithTask[]): TaskSummary[] {
  const map = new Map<
    string,
    {
      taskId: string | null
      taskName: string
      categoryName: string | null
      color: string
      totalSeconds: number
      sessionCount: number
    }
  >()

  for (const session of sessions) {
    if (!session.tasks) continue

    const taskId = session.task_id
    if (!taskId) continue

    const existing = map.get(taskId)
    if (existing) {
      existing.totalSeconds += session.work_seconds
      existing.sessionCount += 1
      continue
    }

    map.set(taskId, {
      taskId,
      taskName: session.tasks.name,
      categoryName: session.tasks.categories?.name ?? null,
      color: getSessionColor(session),
      totalSeconds: session.work_seconds,
      sessionCount: 1,
    })
  }

  return Array.from(map.values()).sort((a, b) => b.totalSeconds - a.totalSeconds)
}

export function buildHeatmapData(sessions: SessionWithTask[]): HeatmapDay[] {
  const end = new Date()
  end.setHours(0, 0, 0, 0)

  const start = new Date(end)
  start.setDate(start.getDate() - 364)

  const map = new Map<string, HeatmapDay>()

  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const key = toLocalDateKey(cursor)
    map.set(key, {
      date: key,
      totalSeconds: 0,
      dominantColor: null,
      byCategory: [],
    })
  }

  for (const session of sessions) {
    const key = toLocalDateKey(new Date(session.started_at))
    const entry = map.get(key)
    if (!entry) continue

    entry.totalSeconds += session.work_seconds
  }

  for (const [key, entry] of map.entries()) {
    const sameDaySessions = sessions.filter(
      (session) => toLocalDateKey(new Date(session.started_at)) === key
    )
    const byCategory = aggregateCategorySeconds(sameDaySessions)

    entry.byCategory = byCategory
    entry.dominantColor = byCategory[0]?.color ?? null
  }

  return Array.from(map.values())
}

export function getRangeDates(range: TimeRange): { from: Date; to: Date } {
  const to = new Date()
  const from = new Date(to)
  from.setHours(0, 0, 0, 0)

  if (range === 'day') {
    return { from, to }
  }

  if (range === 'week') {
    from.setDate(from.getDate() - 6)
    return { from, to }
  }

  if (range === 'month') {
    from.setDate(from.getDate() - 29)
    return { from, to }
  }

  from.setDate(from.getDate() - 364)
  return { from, to }
}
