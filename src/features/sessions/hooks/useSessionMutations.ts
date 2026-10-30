import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@/context/UserContext'
import { queryKeys } from '@/lib/queryKeys'
import { commandFlowtime } from '@/lib/flowtimeApi'

export interface SessionUpdateInput {
  id: string
  taskId?: string | null
  workSeconds?: number
  breakSeconds?: number
  startedAt?: string
  endedAt?: string
  notes?: string | null
}

export function useSessionMutations() {
  const queryClient = useQueryClient()
  const { user } = useUser()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.sessions(user?.id) })
  const mutate = async (op: Record<string, unknown>) => {
    if (!user) throw new Error('User is not authenticated')
    await commandFlowtime('sessions', { operations: [op] })
  }
  const updateSession = useMutation({
    mutationFn: (p: SessionUpdateInput) =>
      mutate({
        action: 'update',
        id: p.id,
        ...(p.taskId !== undefined ? { task_id: p.taskId } : {}),
        ...(p.workSeconds !== undefined ? { work_seconds: p.workSeconds } : {}),
        ...(p.breakSeconds !== undefined ? { break_seconds: p.breakSeconds } : {}),
        ...(p.startedAt !== undefined ? { started_at: p.startedAt } : {}),
        ...(p.endedAt !== undefined ? { ended_at: p.endedAt } : {}),
        ...(p.notes !== undefined ? { notes: p.notes } : {}),
      }),
    onSuccess: invalidate,
  })
  const softDeleteSession = useMutation({
    mutationFn: (id: string) => mutate({ action: 'trash', id }),
    onSuccess: invalidate,
  })
  const restoreSession = useMutation({
    mutationFn: (id: string) => mutate({ action: 'restore', id }),
    onSuccess: invalidate,
  })
  return { updateSession, softDeleteSession, restoreSession }
}
