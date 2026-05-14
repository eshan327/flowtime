import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/utils/supabase'

interface SaveSessionInput {
  user_id: string
  task_id: string | null
  work_seconds: number
  break_seconds: number
  started_at: string
  ended_at: string
}

export function useSessionSave() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: SaveSessionInput) => {
      const { error } = await supabase.from('sessions').insert(payload)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions(variables.user_id) })
    },
  })
}
