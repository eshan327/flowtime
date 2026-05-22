import { useMemo } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useUser } from '@/hooks/useUser'
import { queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/lib/supabaseClient'
import type { SessionWithTask } from '@/types'

const SESSION_WITH_CATEGORY_SELECT =
  '*, tasks(id, name, color, category_id, categories(id, name, color, archived_at))'

interface UseHistorySessionsOptions {
  from: Date | null
  to: Date | null
  enabled?: boolean
}

export function useHistorySessions({ from, to, enabled = true }: UseHistorySessionsOptions) {
  const { user } = useUser()
  const userId = user?.id

  const fromIso = useMemo(() => from?.toISOString() ?? null, [from])
  const toIso = useMemo(() => to?.toISOString() ?? null, [to])

  const query = useQuery({
    queryKey: queryKeys.sessionsHistoryRange(userId, fromIso, toIso),
    enabled: enabled && !!userId,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (!userId) {
        throw new Error('User not authenticated')
      }

      let request = supabase
        .from('sessions')
        .select(SESSION_WITH_CATEGORY_SELECT)
        .eq('user_id', userId)
        .is('deleted_at', null)

      if (fromIso) {
        request = request.gte('started_at', fromIso)
      }

      if (toIso) {
        request = request.lte('started_at', toIso)
      }

      const { data, error } = await request.order('started_at', { ascending: false })
      if (error) throw error

      return data as SessionWithTask[]
    },
  })

  return {
    sessions: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  }
}
