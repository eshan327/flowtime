import { useState } from 'react'
import type { ReactNode } from 'react'
import { Archive, BarChart3, CheckSquare, Home, LogIn, LogOut } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { useUser } from '@/hooks/useUser'
import { supabase } from '@/lib/supabaseClient'

function desktopNavClassName(isActive: boolean) {
  return [
    'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent-primary/70',
    isActive
      ? 'bg-surface-overlay/60 text-ink-primary [&>svg]:text-accent-primary'
      : 'text-ink-secondary hover:bg-surface-overlay/40 hover:text-ink-primary',
  ].join(' ')
}

function mobileNavClassName(isActive: boolean) {
  return [
    'flex flex-col items-center justify-center py-2 text-xs transition-colors',
    isActive ? 'text-accent-primary' : 'text-ink-tertiary hover:text-ink-secondary',
  ].join(' ')
}

function getUserDisplayName(userEmail: string | null | undefined, metadataName: unknown) {
  if (typeof metadataName === 'string' && metadataName.trim().length > 0) {
    return metadataName.trim()
  }

  if (typeof userEmail === 'string' && userEmail.length > 0) {
    return userEmail.split('@')[0]
  }

  return 'Signed in'
}

function getInitials(label: string) {
  const parts = label.trim().split(/\s+/).filter(Boolean)

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  return 'U'
}

export function Layout({ children }: { children: ReactNode }) {
  const { user } = useUser()
  const [isAuthPending, setIsAuthPending] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const isGuest = !user || user.is_anonymous

  const displayName = getUserDisplayName(
    user?.email,
    user?.user_metadata?.full_name ?? user?.user_metadata?.name
  )
  const initials = getInitials(displayName)

  const handleSignIn = async () => {
    setIsAuthPending(true)
    setAuthError(null)

    const credentials = {
      provider: 'google' as const,
      options: { redirectTo: window.location.origin },
    }
    const { error } = user?.is_anonymous
      ? await supabase.auth.linkIdentity(credentials)
      : await supabase.auth.signInWithOAuth(credentials)

    if (error) {
      setAuthError(error.message)
      setIsAuthPending(false)
    }
  }

  const handleSignOut = async () => {
    setIsAuthPending(true)
    setAuthError(null)

    const { error } = await supabase.auth.signOut()
    if (error) {
      setAuthError(error.message)
    }
    setIsAuthPending(false)
  }

  return (
    <div className="min-h-screen text-ink-primary">
      <div className="flex min-h-screen md:flex-row">
        <aside className="hidden border-r border-surface-border-subtle bg-surface-raised px-6 py-8 md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col md:self-start md:overflow-y-auto">
          <p className="text-base font-medium tracking-wide text-ink-primary">Flowtime</p>

          <nav className="mt-8 grid gap-1.5">
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
            <NavLink className={({ isActive }) => desktopNavClassName(isActive)} to="/history">
              <Archive className="h-4 w-4" />
              History
            </NavLink>
          </nav>

          <div className="mt-auto border-t border-surface-border-subtle pt-5">
            {!isGuest ? (
              <div className="flex items-center gap-3 px-2 py-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-overlay text-sm font-medium text-ink-primary">
                  {initials}
                </span>

                <div className="min-w-0">
                  <p className="truncate text-sm text-ink-primary">{displayName}</p>
                  <p className="truncate text-xs text-ink-tertiary">{user?.email ?? 'Signed in'}</p>
                </div>
              </div>
            ) : null}

            <Button
              className="mt-1 w-full justify-start gap-3 px-2"
              disabled={isAuthPending}
              onClick={isGuest ? handleSignIn : handleSignOut}
              variant="ghost"
            >
              {isGuest ? <LogIn className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
              {isAuthPending ? 'Please wait...' : isGuest ? 'Sign in' : 'Sign out'}
            </Button>

            {authError ? <p className="mt-2 text-sm text-red-300">{authError}</p> : null}
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col pb-16 md:pb-0">
          <header className="flex items-center justify-between border-b border-surface-border-subtle bg-surface-raised px-4 py-3 md:hidden">
            <div>
              <p className="text-sm font-medium tracking-wide text-ink-primary">Flowtime</p>
              {!isGuest ? (
                <p className="mt-1 max-w-[200px] truncate text-xs text-ink-secondary">
                  {displayName}
                </p>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              {!isGuest ? (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-overlay text-xs font-medium text-ink-primary">
                  {initials}
                </span>
              ) : null}
              <Button
                aria-label={isGuest ? 'Sign in' : 'Sign out'}
                disabled={isAuthPending}
                onClick={isGuest ? handleSignIn : handleSignOut}
                size="sm"
                variant="ghost"
              >
                {isGuest ? <LogIn className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
                {isAuthPending ? 'Please wait...' : isGuest ? 'Sign in' : 'Sign out'}
              </Button>
            </div>
          </header>

          {authError ? (
            <p className="border-b border-surface-border px-4 py-2 text-sm text-red-300 md:hidden">
              {authError}
            </p>
          ) : null}

          <main className="flex-1 px-4 py-7 md:px-10 md:py-10">{children}</main>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-surface-border-subtle bg-surface-raised md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4">
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

          <NavLink
            aria-label="History"
            className={({ isActive }) => mobileNavClassName(isActive)}
            to="/history"
          >
            <Archive className="h-5 w-5" />
            <span className="sr-only">History</span>
          </NavLink>
        </div>
      </nav>
    </div>
  )
}
