import { useMemo } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchSessionRows } from '@/features/sessions/api/sessionQueries'
import { useUser } from '@/hooks/useUser'
import { queryKeys } from '@/lib/queryKeys'

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

      return fetchSessionRows({
        userId,
        fromIso: fromIso ?? undefined,
        toIso: toIso ?? undefined,
        ascending: false,
      })
    },
  })

  return {
    sessions: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  }
}
