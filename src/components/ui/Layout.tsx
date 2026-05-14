import { useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useUser } from '@/hooks/useUser'
import { supabase } from '@/utils/supabase'

function navClassName(isActive: boolean) {
  return [
    'block rounded-lg border px-3 py-2 text-sm transition',
    isActive
      ? 'border-ink-secondary bg-surface-overlay text-ink-primary'
      : 'border-transparent text-ink-secondary hover:border-surface-border hover:text-ink-primary',
  ].join(' ')
}

export function Layout({ children }: { children: ReactNode }) {
  const { user } = useUser()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)

  const handleSignOut = async () => {
    setIsSigningOut(true)
    setSignOutError(null)

    const { error } = await supabase.auth.signOut()
    if (error) {
      setSignOutError(error.message)
      setIsSigningOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-base text-ink-primary">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col md:flex-row">
        <aside className="border-b border-surface-border px-4 py-4 md:w-72 md:shrink-0 md:border-b-0 md:border-r md:px-5 md:py-6">
          <p className="text-xs uppercase tracking-[0.14em] text-ink-tertiary">Flowtime</p>
          <p className="mt-2 truncate text-sm text-ink-secondary">{user?.email ?? 'Signed in'}</p>

          <nav className="mt-5 grid grid-cols-3 gap-2 md:grid-cols-1 md:gap-1">
            <NavLink className={({ isActive }) => navClassName(isActive)} to="/">
              Timer
            </NavLink>
            <NavLink className={({ isActive }) => navClassName(isActive)} to="/tasks">
              Tasks
            </NavLink>
            <NavLink className={({ isActive }) => navClassName(isActive)} to="/stats">
              Stats
            </NavLink>
          </nav>

          <div className="mt-4 md:mt-8 md:pt-8">
            <button
              className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm text-ink-secondary transition hover:border-ink-secondary hover:text-ink-primary disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isSigningOut}
              onClick={handleSignOut}
              type="button"
            >
              {isSigningOut ? 'Signing out...' : 'Sign out'}
            </button>

            {signOutError ? <p className="mt-2 text-sm text-red-300">{signOutError}</p> : null}
          </div>
        </aside>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  )
}
