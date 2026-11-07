import { createContext, useContext, useEffect, useRef, useState, Fragment } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { useTimerStore } from '@/features/timer/stores/timerStore'
import { useTimerSettingsStore } from '@/features/timer/stores/timerSettingsStore'
import { useTimerSettingsSync } from '@/features/timer/hooks/useTimerSettingsSync'
import { useTimerCommandStatus, useTimerSync } from '@/features/timer/hooks/useTimerSync'
import { queryClient } from '@/lib/queryClient'
import { supabase } from '@/lib/supabaseClient'
import { withRequestTimeout } from '@/lib/requestTimeout'

interface UserContextValue {
  user: User | null
  authLoading: boolean
  timerReady: boolean
  timerSyncError: unknown
  settingsReady: boolean
  settingsSyncError: unknown
}

export const UserContext = createContext<UserContextValue>({
  user: null,
  authLoading: true,
  timerReady: false,
  timerSyncError: null,
  settingsReady: false,
  settingsSyncError: null,
})

export function useUser() {
  return useContext(UserContext)
}

let anonymousSessionPromise: Promise<Session | null> | null = null

async function getOrCreateSession() {
  const { data, error } = await withRequestTimeout(() => supabase.auth.getSession())
  if (error) throw error
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
  const [authLoading, setAuthLoading] = useState(true)
  const [sessionError, setSessionError] = useState<unknown>(null)
  const [user, setUser] = useState<User | null>(null)
  const timerSync = useTimerSync(user?.id)
  const settingsSync = useTimerSettingsSync(user?.id)
  const previousUserIdRef = useRef<string | null | undefined>(undefined)

  const setSessionUser = (session: { user: User } | null) => {
    setAuthLoading(false)
    setSessionError(null)
    const nextUser = session?.user ?? null
    const nextUserId = nextUser?.id ?? null
    const previousUserId = previousUserIdRef.current
    const timerOwnerUserId = useTimerStore.getState().ownerUserId

    if (
      nextUserId === null ||
      (previousUserId !== undefined && previousUserId !== nextUserId) ||
      (timerOwnerUserId !== null && timerOwnerUserId !== nextUserId)
    ) {
      useTimerCommandStatus.setState({ pending: 0, conflicts: [], error: null })
      queryClient.clear()
      useTimerStore.getState().clearUserState()
      useTimerSettingsStore.getState().clearUserState()
    }

    previousUserIdRef.current = nextUserId
    setUser(nextUser)
  }

  useEffect(() => {
    let isActive = true

    withRequestTimeout(() => getOrCreateSession())
      .then((session) => {
        if (!isActive) return
        setSessionUser(session)
      })
      .catch((error) => {
        if (!isActive) return
        setAuthLoading(false)
        setSessionError(error)
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

  return (
    <UserContext.Provider
      value={{
        user,
        authLoading,
        ...timerSync,
        ...settingsSync,
        timerSyncError: sessionError ?? timerSync.timerSyncError ?? settingsSync.settingsSyncError,
        timerReady: timerSync.timerReady && settingsSync.settingsReady,
      }}
    >
      <Fragment key={user?.id ?? 'signed-out'}>{children}</Fragment>
    </UserContext.Provider>
  )
}
