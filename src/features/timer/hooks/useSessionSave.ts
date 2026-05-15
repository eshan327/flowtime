import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import type { Session } from '@/types'
import { supabase } from '@/utils/supabase'

interface SaveSessionInput {
  user_id: string
  task_id: string | null
  task_id_snapshot: string | null
  task_name_snapshot: string | null
  task_color_snapshot: string | null
  category_id_snapshot: string | null
  category_name_snapshot: string | null
  category_color_snapshot: string | null
  work_seconds: number
  break_seconds: number
  started_at: string
  ended_at: string
}

export function useSessionSave() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: SaveSessionInput) => {
      const { data, error } = await supabase.from('sessions').insert(payload).select('*').single()
      if (error) throw error
      return data as Session
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions(variables.user_id) })
    },
  })
}
