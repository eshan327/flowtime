import { useState } from 'react'
import type { ReactNode } from 'react'
import { BarChart3, CheckSquare, Home, LogOut } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useUser } from '@/hooks/useUser'
import { supabase } from '@/utils/supabase'

function desktopNavClassName(isActive: boolean) {
  return [
    'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition',
    isActive
      ? 'border-ink-secondary bg-surface-overlay text-ink-primary'
      : 'border-transparent text-ink-secondary hover:border-surface-border hover:text-ink-primary',
  ].join(' ')
}

function mobileNavClassName(isActive: boolean) {
  return [
    'flex flex-col items-center justify-center py-2 text-xs transition',
    isActive ? 'text-ink-primary' : 'text-ink-tertiary hover:text-ink-secondary',
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
      <div className="mx-auto flex min-h-screen max-w-7xl md:flex-row">
        <aside className="hidden border-r border-surface-border px-5 py-6 md:flex md:w-72 md:shrink-0 md:flex-col">
          <p className="text-xs uppercase tracking-[0.14em] text-ink-tertiary">Flowtime</p>
          <p className="mt-2 truncate text-sm text-ink-secondary">{user?.email ?? 'Signed in'}</p>

          <nav className="mt-5 grid gap-1">
            <NavLink className={({ isActive }) => desktopNavClassName(isActive)} to="/">
              <Home className="h-4 w-4" />
              Timer
            </NavLink>
            <NavLink className={({ isActive }) => desktopNavClassName(isActive)} to="/tasks">
              <CheckSquare className="h-4 w-4" />
              Tasks
            </NavLink>
            <NavLink className={({ isActive }) => desktopNavClassName(isActive)} to="/stats">
              <BarChart3 className="h-4 w-4" />
              Stats
            </NavLink>
          </nav>

          <div className="mt-auto pt-8">
            <button
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-surface-border px-3 py-2 text-sm text-ink-secondary transition hover:border-ink-secondary hover:text-ink-primary disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isSigningOut}
              onClick={handleSignOut}
              type="button"
            >
              <LogOut className="h-4 w-4" />
              {isSigningOut ? 'Signing out...' : 'Sign out'}
            </button>

            {signOutError ? <p className="mt-2 text-sm text-red-300">{signOutError}</p> : null}
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col pb-16 md:pb-0">
          <header className="flex items-center justify-between border-b border-surface-border px-4 py-3 md:hidden">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-ink-tertiary">Flowtime</p>
              <p className="mt-1 max-w-[200px] truncate text-xs text-ink-secondary">
                {user?.email ?? 'Signed in'}
              </p>
            </div>

            <button
              aria-label="Sign out"
              className="rounded-lg border border-surface-border p-2 text-ink-secondary transition hover:border-ink-secondary hover:text-ink-primary disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isSigningOut}
              onClick={handleSignOut}
              type="button"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </header>

          {signOutError ? (
            <p className="border-b border-surface-border px-4 py-2 text-sm text-red-300 md:hidden">
              {signOutError}
            </p>
          ) : null}

          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-surface-border bg-surface-raised/95 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-3">
          <NavLink
            aria-label="Timer"
            className={({ isActive }) => mobileNavClassName(isActive)}
            to="/"
          >
            <Home className="h-5 w-5" />
            <span className="sr-only">Timer</span>
          </NavLink>

          <NavLink
            aria-label="Tasks"
            className={({ isActive }) => mobileNavClassName(isActive)}
            to="/tasks"
          >
            <CheckSquare className="h-5 w-5" />
            <span className="sr-only">Tasks</span>
          </NavLink>

          <NavLink
            aria-label="Stats"
            className={({ isActive }) => mobileNavClassName(isActive)}
            to="/stats"
          >
            <BarChart3 className="h-5 w-5" />
            <span className="sr-only">Stats</span>
          </NavLink>
        </div>
      </nav>
    </div>
  )
}
