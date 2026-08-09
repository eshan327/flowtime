import type { SessionSnapshotInput } from '@/lib/sessionSnapshot'

export interface SaveSessionInput {
  id: string
  user_id: string
  task_id: string | null
  work_seconds: number
  break_seconds: number
  started_at: string
  ended_at: string
  notes?: string | null
  snapshot: SessionSnapshotInput
}
