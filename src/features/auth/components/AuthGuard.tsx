import type { ReactNode } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { LoginPage } from '@/features/auth/LoginPage'
import { useUser } from '@/hooks/useUser'

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useUser()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-base">
        <Spinner />
      </div>
    )
  }

  if (!user) return <LoginPage />
  return <>{children}</>
}
