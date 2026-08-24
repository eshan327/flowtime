import { useState } from 'react'
import type { ReactNode } from 'react'
import { Archive, BarChart3, CheckSquare, ChevronRight, Home, LogIn, LogOut } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { useUser } from '@/hooks/useUser'
import { supabase } from '@/lib/supabaseClient'

const NAV_ITEMS = [
  { to: '/', label: 'Timer', icon: Home },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/stats', label: 'Stats', icon: BarChart3 },
  { to: '/history', label: 'History', icon: Archive },
]

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

function UserAvatar({
  initials,
  url,
  className,
}: {
  initials: string
  url?: string
  className: string
}) {
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-hover font-medium text-ink-primary ${className}`}
    >
      {initials}
      {url ? (
        <img
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={(event) => event.currentTarget.remove()}
          src={url}
        />
      ) : null}
    </span>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  const { user } = useUser()
  const [isAuthPending, setIsAuthPending] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [isAccountOpen, setIsAccountOpen] = useState(false)
  const [photoUrl, setPhotoUrl] = useState('')
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const [accountAgeMonths, setAccountAgeMonths] = useState<number | null>(null)
  const isGuest = !user || user.is_anonymous

  const displayName = getUserDisplayName(
    user?.email,
    user?.user_metadata?.full_name ?? user?.user_metadata?.name
  )
  const initials = getInitials(displayName)
  const avatarUrl = user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture

  const openAccount = () => {
    setPhotoUrl(typeof avatarUrl === 'string' ? avatarUrl : '')
    setAccountAgeMonths(
      user?.created_at
        ? Math.max(0, Math.floor((Date.now() - Date.parse(user.created_at)) / 2_629_746_000))
        : null
    )
    setProfileMessage(null)
    setIsAccountOpen(true)
  }

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
    setIsAccountOpen(false)
    setIsAuthPending(false)
  }

  const handlePhotoUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsAuthPending(true)
    setProfileMessage(null)

    const { error } = await supabase.auth.updateUser({
      data: { avatar_url: photoUrl.trim() || null },
    })

    setProfileMessage(error ? error.message : 'Profile photo updated.')
    setIsAuthPending(false)
  }

  return (
    <div className="min-h-screen text-ink-primary">
      <div className="flex min-h-screen md:flex-row">
        <aside className="hidden border-r border-surface-border-subtle bg-surface-sidebar px-4 py-6 md:sticky md:top-0 md:flex md:h-screen md:w-56 md:shrink-0 md:flex-col md:self-start md:overflow-y-auto">
          <p className="px-3 text-lg font-semibold tracking-wide text-ink-primary">Flowtime</p>

          <nav className="mt-7 grid gap-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink className={({ isActive }) => desktopNavClassName(isActive)} key={to} to={to}>
                <Icon className="h-5 w-5" />
                {label}
              </NavLink>
            ))}
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
              <button
                className="flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left transition-colors hover:bg-surface-hover/30 focus-visible:ring-2 focus-visible:ring-accent-primary/70"
                onClick={openAccount}
                type="button"
              >
                <UserAvatar className="h-10 w-10 text-sm" initials={initials} url={avatarUrl} />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-ink-primary">{displayName}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-tertiary" />
              </button>
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
              {isGuest ? (
                <Button disabled={isAuthPending} onClick={handleSignIn} size="sm" variant="ghost">
                  <LogIn className="h-4 w-4" />
                  {isAuthPending ? 'Please wait...' : 'Sign in'}
                </Button>
              ) : (
                <button
                  aria-label="Open account"
                  className="rounded-full focus-visible:ring-2 focus-visible:ring-accent-primary/70"
                  onClick={openAccount}
                  type="button"
                >
                  <UserAvatar className="h-8 w-8 text-xs" initials={initials} url={avatarUrl} />
                </button>
              )}
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
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              aria-label={label}
              className={({ isActive }) => mobileNavClassName(isActive)}
              key={to}
              to={to}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <Modal isOpen={isAccountOpen} onClose={() => setIsAccountOpen(false)} title="Account">
        <div className="flex items-center gap-4">
          <UserAvatar className="h-16 w-16 text-lg" initials={initials} url={avatarUrl} />
          <div className="min-w-0">
            <p className="truncate text-lg font-medium text-ink-primary">{displayName}</p>
            <p className="truncate text-sm text-ink-tertiary">{user?.email}</p>
          </div>
        </div>

        <form className="mt-6" onSubmit={handlePhotoUpdate}>
          <Input
            label="Profile photo URL"
            onChange={(event) => setPhotoUrl(event.target.value)}
            placeholder="https://example.com/photo.jpg"
            type="url"
            value={photoUrl}
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <p
              className={`text-sm ${profileMessage?.endsWith('updated.') ? 'text-ink-secondary' : 'text-red-300'}`}
              role="status"
            >
              {profileMessage}
            </p>
            <Button loading={isAuthPending} size="sm" type="submit">
              Save photo
            </Button>
          </div>
        </form>

        <dl className="mt-6 divide-y divide-surface-border-subtle border-y border-surface-border-subtle text-sm">
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-ink-tertiary">Email</dt>
            <dd className="min-w-0 truncate text-ink-primary">{user?.email}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-ink-tertiary">Account age</dt>
            <dd className="text-ink-primary">
              {accountAgeMonths === null
                ? 'Unknown'
                : `${accountAgeMonths} ${accountAgeMonths === 1 ? 'month' : 'months'}`}
            </dd>
          </div>
        </dl>

        <Button
          className="mt-5 w-full"
          disabled={isAuthPending}
          onClick={handleSignOut}
          variant="ghost"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </Modal>
    </div>
  )
}
