import { readAllFlowtime } from '@/lib/flowtimeApi'
import type { Session, SessionWithTask } from '@/types'

export const SESSION_WITH_TASK_SELECT =
  '*, tasks(id, name, color, category_id, categories(id, name, color, archived_at))'

interface SessionRangeOptions {
  userId: string
  fromIso?: string
  toIso?: string
  ascending?: boolean
}

type SessionTimeRow = Pick<Session, 'id' | 'started_at' | 'ended_at' | 'work_seconds'>

export function fetchSessionRows(options: SessionRangeOptions) {
  return fetchRows<SessionWithTask>(options, SESSION_WITH_TASK_SELECT)
}

export function fetchSessionTimeRows(options: SessionRangeOptions) {
  return fetchRows<SessionTimeRow>(options, 'id, started_at, ended_at, work_seconds')
}

async function fetchRows<T extends SessionTimeRow>(
  { fromIso, toIso, ascending = true }: SessionRangeOptions,
  _select: string
): Promise<T[]> {
  const rows = await readAllFlowtime<T>('sessions', {
    ...(fromIso ? { from: fromIso } : {}),
    ...(toIso ? { to: toIso } : {}),
  })
  return ascending ? rows : rows.reverse()
}

export function fetchStreakRows(userId: string) {
  return fetchSessionTimeRows({ userId })
}
