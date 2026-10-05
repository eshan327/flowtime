import { supabase } from '@/lib/supabaseClient'

export async function fetchSubtaskCounts(userId: string) {
  const counts: Record<string, { total: number; completed: number }> = Object.create(null)
  let cursor: string | undefined
  for (;;) {
    let request = supabase
      .from('subtasks')
      .select('id, task_id, completed_at, tasks!inner(completed_at)')
      .eq('user_id', userId)
      .is('tasks.completed_at', null)
    if (cursor) request = request.gt('id', cursor)
    const { data, error } = await request.order('id').limit(1000)
    if (error) throw error
    for (const subtask of data) {
      const count = (counts[subtask.task_id] ??= { total: 0, completed: 0 })
      count.total++
      if (subtask.completed_at !== null) count.completed++
    }
    if (data.length < 1000) return counts
    cursor = data[data.length - 1].id
  }
}
