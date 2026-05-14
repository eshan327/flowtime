import { useQuery } from '@tanstack/react-query'
import { useUser } from '@/hooks/useUser'
import { queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/utils/supabase'

interface TodaySummary {
  count: number
  totalWorkSeconds: number
}

export function useTodaySummary() {
  const { user } = useUser()

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  return useQuery<TodaySummary>({
    queryKey: queryKeys.sessionsTodaySummary(user?.id, startOfToday.toISOString()),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('work_seconds')
        .eq('user_id', user!.id)
        .gte('started_at', startOfToday.toISOString())

      if (error) throw error

      const sessions = data ?? []
      const totalWorkSeconds = sessions.reduce((sum, session) => sum + session.work_seconds, 0)

      return {
        count: sessions.length,
        totalWorkSeconds,
      }
    },
    enabled: !!user,
  })
}
