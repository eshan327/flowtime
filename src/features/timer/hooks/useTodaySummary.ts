import { useQuery } from '@tanstack/react-query'
import { useUser } from '@/context/UserContext'
import { queryKeys } from '@/lib/queryKeys'
import { fetchSessionRows } from '@/features/sessions/api/sessionQueries'
import { workSecondsInDateRange } from '@/lib/sessionTime'

interface TodaySummary {
  count: number
  totalWorkSeconds: number
}

export function useTodaySummary() {
  const { user } = useUser()

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const endOfToday = new Date(startOfToday)
  endOfToday.setDate(endOfToday.getDate() + 1)
  endOfToday.setTime(endOfToday.getTime() - 1)

  return useQuery<TodaySummary>({
    queryKey: queryKeys.sessionsTodaySummary(user?.id, startOfToday.toISOString()),
    queryFn: async () => {
      const sessions = await fetchSessionRows({
        userId: user!.id,
        fromIso: startOfToday.toISOString(),
        toIso: endOfToday.toISOString(),
      })
      const totalWorkSeconds = sessions.reduce(
        (sum, session) => sum + workSecondsInDateRange(session, startOfToday, endOfToday),
        0
      )

      return {
        count: sessions.length,
        totalWorkSeconds,
      }
    },
    enabled: !!user,
  })
}
