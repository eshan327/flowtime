import { useState } from 'react'
import type { ReactNode } from 'react'
import { Archive, BarChart3, CheckSquare, Home, LogIn, LogOut } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { useUser } from '@/hooks/useUser'
import { supabase } from '@/lib/supabaseClient'

function desktopNavClassName(isActive: boolean) {
  return [
    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent-primary/70',
    isActive
      ? 'bg-surface-hover/55 font-medium text-ink-primary [&>svg]:text-accent-primary'
      : 'text-ink-secondary hover:bg-surface-hover/30 hover:text-ink-primary',
  ].join(' ')
}

function mobileNavClassName(isActive: boolean) {
  return [
    'flex flex-col items-center justify-center gap-1 py-2 text-[11px] transition-colors',
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
        <aside className="hidden border-r border-surface-border-subtle bg-surface-sidebar px-4 py-6 md:sticky md:top-0 md:flex md:h-screen md:w-56 md:shrink-0 md:flex-col md:self-start md:overflow-y-auto">
          <p className="px-3 text-lg font-semibold tracking-wide text-ink-primary">Flowtime</p>

          <nav className="mt-7 grid gap-1">
            <NavLink className={({ isActive }) => desktopNavClassName(isActive)} to="/">
              <Home className="h-5 w-5" />
              Timer
            </NavLink>
            <NavLink className={({ isActive }) => desktopNavClassName(isActive)} to="/tasks">
              <CheckSquare className="h-5 w-5" />
              Tasks
            </NavLink>
            <NavLink className={({ isActive }) => desktopNavClassName(isActive)} to="/stats">
              <BarChart3 className="h-5 w-5" />
              Stats
            </NavLink>
            <NavLink className={({ isActive }) => desktopNavClassName(isActive)} to="/history">
              <Archive className="h-5 w-5" />
              History
            </NavLink>
          </nav>

          <div className="mt-auto border-t border-surface-border-subtle pt-5">
            {isGuest ? (
              <Button
                className="w-full justify-start gap-3 px-2"
                disabled={isAuthPending}
                onClick={handleSignIn}
                variant="ghost"
              >
                <LogIn className="h-4 w-4" />
                {isAuthPending ? 'Please wait...' : 'Sign in'}
              </Button>
            ) : (
              <div className="flex items-center gap-3 px-1 py-1">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-hover text-sm font-medium text-ink-primary">
                  {initials}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-ink-primary">{displayName}</p>
                  <p className="truncate text-xs text-ink-tertiary">{user?.email ?? 'Signed in'}</p>
                </div>

                <Button
                  aria-label={isAuthPending ? 'Signing out' : 'Sign out'}
                  className="shrink-0 text-ink-tertiary"
                  disabled={isAuthPending}
                  onClick={handleSignOut}
                  size="icon"
                  title="Sign out"
                  variant="ghost"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            )}

            {authError ? <p className="mt-2 text-sm text-red-300">{authError}</p> : null}
          </div>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col pb-20 md:pb-0">
          <header className="flex items-center justify-between border-b border-surface-border-subtle bg-surface-sidebar px-4 py-3 md:hidden">
            <div>
              <p className="text-lg font-semibold tracking-wide text-ink-primary">Flowtime</p>
              {!isGuest ? (
                <p className="mt-1 max-w-[200px] truncate text-xs text-ink-secondary">
                  {displayName}
                </p>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              {!isGuest ? (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-hover text-xs font-medium text-ink-primary">
                  {initials}
                </span>
              ) : null}
              <Button
                aria-label={isGuest ? 'Sign in' : 'Sign out'}
                disabled={isAuthPending}
                onClick={isGuest ? handleSignIn : handleSignOut}
                size={isGuest ? 'sm' : 'icon'}
                title={isGuest ? undefined : 'Sign out'}
                variant="ghost"
              >
                {isGuest ? <LogIn className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
                {isGuest ? (isAuthPending ? 'Please wait...' : 'Sign in') : null}
              </Button>
            </div>
          </header>

          {authError ? (
            <p className="border-b border-surface-border px-4 py-2 text-sm text-red-300 md:hidden">
              {authError}
            </p>
          ) : null}

          <main className="flex-1 px-4 py-7 md:px-8 md:py-9">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-surface-border-subtle bg-surface-sidebar md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4">
          <NavLink
            aria-label="Timer"
            className={({ isActive }) => mobileNavClassName(isActive)}
            to="/"
          >
            <Home className="h-5 w-5" />
            <span>Timer</span>
          </NavLink>

          <NavLink
            aria-label="Tasks"
            className={({ isActive }) => mobileNavClassName(isActive)}
            to="/tasks"
          >
            <CheckSquare className="h-5 w-5" />
            <span>Tasks</span>
          </NavLink>

          <NavLink
            aria-label="Stats"
            className={({ isActive }) => mobileNavClassName(isActive)}
            to="/stats"
          >
            <BarChart3 className="h-5 w-5" />
            <span>Stats</span>
          </NavLink>

          <NavLink
            aria-label="History"
            className={({ isActive }) => mobileNavClassName(isActive)}
            to="/history"
          >
            <Archive className="h-5 w-5" />
            <span>History</span>
          </NavLink>
        </div>
      </nav>
    </div>
  )
}
