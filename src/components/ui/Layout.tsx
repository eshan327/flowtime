import { useState } from 'react'
import type { ReactNode } from 'react'
import { Archive, BarChart3, CheckSquare, Home, LogOut } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { useUser } from '@/hooks/useUser'
import { supabase } from '@/lib/supabaseClient'

function desktopNavClassName(isActive: boolean) {
  return [
    'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors',
    isActive
      ? 'border-surface-border bg-surface-overlay/80 text-ink-primary [&>svg]:text-accent-primary'
      : 'border-transparent text-ink-secondary hover:bg-surface-overlay/50 hover:text-ink-primary',
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

function formatJoinedDate(createdAt: string | null | undefined) {
  if (typeof createdAt !== 'string' || createdAt.length === 0) {
    return null
  }

  const parsed = new Date(createdAt)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function Layout({ children }: { children: ReactNode }) {
  const { user } = useUser()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)

  const displayName = getUserDisplayName(
    user?.email,
    user?.user_metadata?.full_name ?? user?.user_metadata?.name
  )
  const initials = getInitials(displayName)
  const joinedDate = formatJoinedDate(user?.created_at)

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
    <div className="min-h-screen text-ink-primary">
      <div className="mx-auto flex min-h-screen max-w-7xl md:flex-row">
        <aside className="hidden border-r border-surface-border-subtle bg-surface-raised px-5 py-7 md:sticky md:top-0 md:flex md:h-screen md:w-72 md:shrink-0 md:flex-col md:self-start md:overflow-y-auto">
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

          <div className="mt-auto border-t border-surface-border/70 pt-6">
            <div className="mb-3 flex items-center gap-3 rounded-lg border border-surface-border bg-surface-raised px-3 py-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-surface-border bg-surface-overlay text-sm font-medium text-ink-primary">
                {initials}
              </span>

              <div className="min-w-0">
                <p className="truncate text-sm text-ink-primary">{displayName}</p>
                <p className="truncate text-xs text-ink-tertiary">{user?.email ?? 'Signed in'}</p>
                {joinedDate ? (
                  <p className="truncate text-[11px] text-ink-tertiary">Joined {joinedDate}</p>
                ) : null}
              </div>
            </div>

            <Button
              className="w-full gap-2"
              disabled={isSigningOut}
              onClick={handleSignOut}
              variant="outlined"
            >
              <LogOut className="h-4 w-4" />
              {isSigningOut ? 'Signing out...' : 'Sign out'}
            </Button>

            {signOutError ? <p className="mt-2 text-sm text-red-300">{signOutError}</p> : null}
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col pb-16 md:pb-0">
          <header className="flex items-center justify-between border-b border-surface-border-subtle bg-surface-raised px-4 py-3 md:hidden">
            <div>
              <p className="text-sm font-medium tracking-wide text-ink-primary">Flowtime</p>
              <p className="mt-1 max-w-[200px] truncate text-xs text-ink-secondary">
                {displayName}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-surface-border bg-surface-overlay text-xs font-medium text-ink-primary">
                {initials}
              </span>
              <Button
                aria-label="Sign out"
                disabled={isSigningOut}
                onClick={handleSignOut}
                size="icon"
                variant="outlined"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>

          {signOutError ? (
            <p className="border-b border-surface-border px-4 py-2 text-sm text-red-300 md:hidden">
              {signOutError}
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
