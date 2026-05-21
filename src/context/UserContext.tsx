import { createContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'

interface UserContextValue {
  user: User | null
  loading: boolean
}

export const UserContext = createContext<UserContextValue>({ user: null, loading: true })

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const setSessionUser = (session: { user: User } | null) => {
    setUser(session?.user ?? null)
    setLoading(false)
  }

  useEffect(() => {
    let isActive = true

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!isActive) return
        setSessionUser(data.session)
      })
      .catch(() => {
        if (!isActive) return
        setSessionUser(null)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUser(session)
    })

    return () => {
      isActive = false
      subscription.unsubscribe()
    }
  }, [])

  return <UserContext.Provider value={{ user, loading }}>{children}</UserContext.Provider>
}
