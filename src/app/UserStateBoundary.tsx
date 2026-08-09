import { useEffect, useRef, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTimerStore } from '@/features/timer/stores/timerStore'
import { useUser } from '@/hooks/useUser'

export function UserStateBoundary({ children }: { children: ReactNode }) {
  const { user, loading } = useUser()
  const queryClient = useQueryClient()
  const previousUserIdRef = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    if (loading) return

    const nextUserId = user?.id ?? null
    const previousUserId = previousUserIdRef.current
    const timerOwnerUserId = useTimerStore.getState().ownerUserId
    const userChanged = previousUserId !== undefined && previousUserId !== nextUserId
    const timerBelongsToAnotherUser = timerOwnerUserId !== null && timerOwnerUserId !== nextUserId

    if (nextUserId === null || userChanged || timerBelongsToAnotherUser) {
      queryClient.clear()
      useTimerStore.getState().clearUserState()
    }

    previousUserIdRef.current = nextUserId
  }, [loading, queryClient, user?.id])

  return <>{children}</>
}
