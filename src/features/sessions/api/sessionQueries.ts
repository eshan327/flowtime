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

export async function fetchSessionRows({
  userId,
  fromIso,
  toIso,
  ascending = true,
}: SessionRangeOptions) {
  const sessions: SessionWithTask[] = []
  let cursor: SessionCursor | null = null

  for (;;) {
    let request = supabase
      .from('sessions')
      .select(SESSION_WITH_TASK_SELECT)
      .eq('user_id', userId)
      .is('deleted_at', null)

    if (fromIso) request = request.gte('started_at', fromIso)
    if (toIso) request = request.lte('started_at', toIso)
    if (cursor) request = request.or(getCursorFilter(cursor, ascending))

    const { data, error } = await request
      .order('started_at', { ascending })
      .order('id', { ascending })
      .limit(SESSION_PAGE_SIZE)

    if (error) throw error

    const page = data as SessionWithTask[]
    sessions.push(...page)
    if (page.length < SESSION_PAGE_SIZE) break

    const lastSession = page[page.length - 1]
    cursor = { id: lastSession.id, startedAt: lastSession.started_at }
  }

  return sessions
}

export async function fetchStreakRows(userId: string) {
  const sessions: Pick<Session, 'id' | 'started_at' | 'work_seconds'>[] = []
  let cursor: SessionCursor | null = null

  for (;;) {
    let request = supabase
      .from('sessions')
      .select('id, started_at, work_seconds')
      .eq('user_id', userId)
      .is('deleted_at', null)

    if (cursor) request = request.or(getCursorFilter(cursor, true))

    const { data, error } = await request
      .order('started_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(SESSION_PAGE_SIZE)

    if (error) throw error

    const page = data as Pick<Session, 'id' | 'started_at' | 'work_seconds'>[]
    sessions.push(...page)
    if (page.length < SESSION_PAGE_SIZE) break

    const lastSession = page[page.length - 1]
    cursor = { id: lastSession.id, startedAt: lastSession.started_at }
  }

  return sessions
}
