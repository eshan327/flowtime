import { createContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { useTimerStore } from '@/features/timer/stores/timerStore'
import { queryClient } from '@/lib/queryClient'
import { supabase } from '@/lib/supabaseClient'

interface UserContextValue {
  user: User | null
}

export const UserContext = createContext<UserContextValue>({ user: null })

let anonymousSessionPromise: Promise<Session | null> | null = null

async function getOrCreateSession() {
  const { data } = await supabase.auth.getSession()
  if (data.session) return data.session

  anonymousSessionPromise ??= supabase.auth
    .signInAnonymously()
    .then(({ data: anonymousData, error }) => {
      if (error) throw error
      return anonymousData.session
    })
    .finally(() => {
      anonymousSessionPromise = null
    })

  return anonymousSessionPromise
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const previousUserIdRef = useRef<string | null | undefined>(undefined)

  const setSessionUser = (session: { user: User } | null) => {
    const nextUser = session?.user ?? null
    const nextUserId = nextUser?.id ?? null
    const previousUserId = previousUserIdRef.current
    const timerOwnerUserId = useTimerStore.getState().ownerUserId

    if (
      nextUserId === null ||
      (previousUserId !== undefined && previousUserId !== nextUserId) ||
      (timerOwnerUserId !== null && timerOwnerUserId !== nextUserId)
    ) {
      queryClient.clear()
      useTimerStore.getState().clearUserState()
    }

    previousUserIdRef.current = nextUserId
    setUser(nextUser)
  }

  useEffect(() => {
    let isActive = true

    getOrCreateSession()
      .then((session) => {
        if (!isActive) return
        setSessionUser(session)
      })
      .catch(() => {
        if (!isActive) return
        setSessionUser(null)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSessionUser(session)

      if (event === 'SIGNED_OUT') {
        window.setTimeout(() => {
          void getOrCreateSession()
            .then((nextSession) => {
              if (isActive) setSessionUser(nextSession)
            })
            .catch(() => {
              if (isActive) setSessionUser(null)
            })
        }, 0)
      }
    })

    return () => {
      isActive = false
      subscription.unsubscribe()
    }
  }, [])

  return <UserContext.Provider value={{ user }}>{children}</UserContext.Provider>
}
