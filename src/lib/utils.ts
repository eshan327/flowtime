import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { toHourKey, toLocalDateKey, toStartOfDay, toWeekStart } from '@/lib/dateMath'
import {
  getSessionCategoryId,
  getSessionCategoryName,
  getSessionColor,
  getSessionTaskColor,
  getSessionTaskId,
  getSessionTaskName,
} from '@/lib/sessionSnapshot'
import type {
  CategorySeconds,
  CategorySummary,
  DaySummary,
  HeatmapDay,
  SessionWithTask,
  TaskSummary,
} from '@/types'

function addSessionToCategoryBuckets(
  buckets: Map<string, CategorySeconds>,
  session: SessionWithTask
) {
  const categoryId = getSessionCategoryId(session)
  const mapKey = categoryId ?? 'uncategorized'
  const existing = buckets.get(mapKey)

  if (existing) {
    existing.seconds += session.work_seconds
    return
  }

  buckets.set(mapKey, {
    categoryId,
    categoryName: getSessionCategoryName(session),
    color: getSessionColor(session),
    seconds: session.work_seconds,
  })
}

function toSortedCategoryBuckets(buckets: Map<string, CategorySeconds>) {
  return Array.from(buckets.values()).sort((a, b) => b.seconds - a.seconds)
}

interface AggregateEntry {
  date: string
  totalSeconds: number
  byCategory: Map<string, CategorySeconds>
}

function createAggregateMap(keys: string[]) {
  const map = new Map<string, AggregateEntry>()
  for (const key of keys) {
    map.set(key, {
      date: key,
      totalSeconds: 0,
      byCategory: new Map(),
    })
  }

  return map
}

function aggregateSessionsByKeys(
  sessions: SessionWithTask[],
  keys: string[],
  getSessionKey: (session: SessionWithTask) => string
) {
  const map = createAggregateMap(keys)

  for (const session of sessions) {
    const entry = map.get(getSessionKey(session))
    if (!entry) continue

    entry.totalSeconds += session.work_seconds
    addSessionToCategoryBuckets(entry.byCategory, session)
  }

  return Array.from(map.values()).map((entry) => ({
    date: entry.date,
    totalSeconds: entry.totalSeconds,
    byCategory: toSortedCategoryBuckets(entry.byCategory),
  }))
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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

export function aggregateByHour(sessions: SessionWithTask[], anchorDate: Date): DaySummary[] {
  const dayStart = toStartOfDay(anchorDate)
  const keys = Array.from({ length: 24 }, (_value, hour) => {
    const keyDate = new Date(dayStart)
    keyDate.setHours(hour, 0, 0, 0)
    return toHourKey(keyDate)
  })

  return aggregateSessionsByKeys(sessions, keys, (session) =>
    toHourKey(new Date(session.started_at))
  )
}

export function aggregateByDay(sessions: SessionWithTask[], from: Date, to: Date): DaySummary[] {
  const start = new Date(from)
  start.setHours(0, 0, 0, 0)

  const end = new Date(to)
  end.setHours(0, 0, 0, 0)
  const keys: string[] = []
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    keys.push(toLocalDateKey(cursor))
  }

  return aggregateSessionsByKeys(sessions, keys, (session) =>
    toLocalDateKey(new Date(session.started_at))
  )
}

export function aggregateByWeek(sessions: SessionWithTask[], from: Date, to: Date): DaySummary[] {
  const firstWeekStart = toWeekStart(from)
  const end = toStartOfDay(to)
  const keys: string[] = []
  for (
    const cursor = new Date(firstWeekStart);
    cursor <= end;
    cursor.setDate(cursor.getDate() + 7)
  ) {
    const weekStart = new Date(cursor)
    keys.push(toLocalDateKey(weekStart))
  }

  return aggregateSessionsByKeys(sessions, keys, (session) =>
    toLocalDateKey(toWeekStart(new Date(session.started_at)))
  )
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
    const taskName = getSessionTaskName(session)
    if (!taskName) continue

    const taskId = getSessionTaskId(session)
    const mapKey = taskId ?? `snapshot:${taskName}`

    const existing = map.get(mapKey)
    if (existing) {
      existing.totalSeconds += session.work_seconds
      existing.sessionCount += 1
      continue
    }

    map.set(mapKey, {
      taskId,
      taskName,
      categoryName: session.category_name_snapshot ?? session.tasks?.categories?.name ?? null,
      color: getSessionTaskColor(session),
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

  const map = new Map<
    string,
    {
      date: string
      totalSeconds: number
      dominantColor: string | null
      byCategory: Map<string, CategorySeconds>
    }
  >()

  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const key = toLocalDateKey(cursor)
    map.set(key, {
      date: key,
      totalSeconds: 0,
      dominantColor: null,
      byCategory: new Map(),
    })
  }

  for (const session of sessions) {
    const key = toLocalDateKey(new Date(session.started_at))
    const entry = map.get(key)
    if (!entry) continue

    entry.totalSeconds += session.work_seconds
    addSessionToCategoryBuckets(entry.byCategory, session)
  }

  return Array.from(map.values()).map((entry) => {
    const byCategory = toSortedCategoryBuckets(entry.byCategory)

    return {
      date: entry.date,
      totalSeconds: entry.totalSeconds,
      dominantColor: byCategory[0]?.color ?? null,
      byCategory,
    }
  })
}
