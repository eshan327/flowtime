import { supabase } from '@/lib/supabaseClient'
import type { Session, SessionWithTask } from '@/types'

export const SESSION_WITH_TASK_SELECT =
  '*, tasks(id, name, color, category_id, categories(id, name, color, archived_at))'

const SESSION_PAGE_SIZE = 1_000

interface SessionCursor {
  id: string
  startedAt: string
}

interface SessionRangeOptions {
  userId: string
  fromIso?: string
  toIso?: string
  ascending?: boolean
}

function getCursorFilter(cursor: SessionCursor, ascending: boolean) {
  const comparison = ascending ? 'gt' : 'lt'

  return `started_at.${comparison}.${cursor.startedAt},and(started_at.eq.${cursor.startedAt},id.${comparison}.${cursor.id})`
}

type SessionTimeRow = Pick<Session, 'id' | 'started_at' | 'ended_at' | 'work_seconds'>

export function fetchSessionRows(options: SessionRangeOptions) {
  return fetchRows<SessionWithTask>(options, SESSION_WITH_TASK_SELECT)
}

export function fetchSessionTimeRows(options: SessionRangeOptions) {
  return fetchRows<SessionTimeRow>(options, 'id, started_at, ended_at, work_seconds')
}

async function fetchRows<T extends SessionTimeRow>(
  { userId, fromIso, toIso, ascending = true }: SessionRangeOptions,
  select: string
): Promise<T[]> {
  const sessions: T[] = []
  let cursor: SessionCursor | null = null

  for (;;) {
    let request = supabase
      .from('sessions')
      .select(select)
      .eq('user_id', userId)
      .is('deleted_at', null)

    if (fromIso) request = request.gt('ended_at', fromIso)
    if (toIso) request = request.lte('started_at', toIso)
    if (cursor) request = request.or(getCursorFilter(cursor, ascending))

    const { data, error } = await request
      .order('started_at', { ascending })
      .order('id', { ascending })
      .limit(SESSION_PAGE_SIZE)

    if (error) throw error

    const page = data as unknown as T[]
    sessions.push(...page)
    if (page.length < SESSION_PAGE_SIZE) break

    const lastSession = page[page.length - 1]
    cursor = { id: lastSession.id, startedAt: lastSession.started_at }
  }

  return sessions
}

export function fetchStreakRows(userId: string) {
  return fetchSessionTimeRows({ userId })
}
