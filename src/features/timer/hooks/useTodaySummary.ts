import { useQuery } from '@tanstack/react-query'
import { useUser } from '@/context/UserContext'
import { useTimerSettingsStore } from '@/features/timer/stores/timerSettingsStore'
import { fetchFocusSummary } from '@/lib/focusSummary'
import { dateKeyInZone } from '@/lib/timezone'
export function useTodaySummary() {
  const { user } = useUser()
  const timezone = useTimerSettingsStore((s) => s.timezone)
  return useQuery({
    queryKey: [
      'sessions',
      user?.id,
      'today-summary',
      dateKeyInZone(new Date(), timezone),
      timezone,
    ],
    enabled: !!user,
    refetchInterval: 5000,
    queryFn: async () => {
      const s = await fetchFocusSummary({ period: 'day', timezone })
      return { count: s.session_count, totalWorkSeconds: s.work_seconds }
    },
  })
}
