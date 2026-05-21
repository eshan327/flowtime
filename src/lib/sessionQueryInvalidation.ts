import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'

export async function invalidateSessionQueries(queryClient: QueryClient, userId?: string) {
  if (!userId) return
  await queryClient.invalidateQueries({ queryKey: queryKeys.sessions(userId) })
}
