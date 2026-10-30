import { readFlowtime } from './flowtimeApi'
import type { Json } from '@/types/supabase'
export interface SnapshotCategory {
  category_id: string | null
  category_name: string | null
  color: string | null
  work_seconds: number
  session_count: number
}
export interface SnapshotTask {
  task_id: string | null
  task_name: string | null
  category_id: string | null
  category_name: string | null
  color: string | null
  work_seconds: number
  session_count: number
}
export interface FocusDay {
  date: string
  work_seconds: number
  by_category: SnapshotCategory[]
}
export interface FocusSummary {
  from: string
  to: string
  timezone: string
  session_count: number
  work_seconds: number
  current_streak: number
  longest_streak: number
  by_task_snapshot: SnapshotTask[]
  by_category_snapshot: SnapshotCategory[]
  by_day: FocusDay[]
  by_hour: FocusDay[]
  next_cursor: Json | null
}
export async function fetchFocusSummary(input: Record<string, unknown>) {
  let summary: FocusSummary | null = null,
    cursor: Json | null = null
  do {
    const page: FocusSummary = await readFlowtime<FocusSummary>('summary', {
      ...input,
      limit: 100,
      ...(cursor ? { cursor } : {}),
    })
    if (!summary) summary = page
    else {
      summary.by_task_snapshot.push(...page.by_task_snapshot)
      summary.by_category_snapshot.push(...page.by_category_snapshot)
      summary.by_day.push(...page.by_day)
    }
    cursor = page.next_cursor
  } while (cursor)
  return summary!
}
