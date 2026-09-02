import { useEffect, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import {
  ChartNoAxesColumnIncreasing,
  Camera,
  Clock3,
  CloudCheck,
  CloudOff,
  ChevronRight,
  History,
  ListChecks,
  LogIn,
  LogOut,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { FlowtimeMark } from '@/components/FlowtimeMark'
import { Modal } from '@/components/ui/Modal'
import { useUser } from '@/context/UserContext'
import { getQueuedSessions } from '@/features/sessions/lib/sessionOutbox'
import { supabase } from '@/lib/supabaseClient'

const NAV_ITEMS = [
  { to: '/', label: 'Timer', icon: Clock3, preload: () => import('@/features/timer/TimerPage') },
  {
    to: '/tasks',
    label: 'Tasks',
    icon: ListChecks,
    preload: () => import('@/features/tasks/TasksPage'),
  },
  {
    to: '/stats',
    label: 'Insights',
    icon: ChartNoAxesColumnIncreasing,
    preload: () => import('@/features/stats/StatsPage'),
  },
  {
    to: '/history',
    label: 'History',
    icon: History,
    preload: () => import('@/features/history/HistoryPage'),
  },
]

const AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_AVATAR_SIZE = 5 * 1024 * 1024

function desktopNavClassName(isActive: boolean) {
  return [
    'relative flex items-center gap-4 rounded-[4px] px-4 py-4 text-[15px] outline-none transition-colors duration-150 before:absolute before:inset-y-0 before:left-0 before:w-[3px] focus-visible:ring-2 focus-visible:ring-accent-primary/70',
    isActive
      ? 'bg-surface-hover/60 font-medium text-ink-primary before:bg-accent-primary [&>svg]:text-ink-primary'
      : 'text-ink-secondary hover:bg-surface-hover/25 hover:text-ink-primary',
  ].join(' ')
}

function mobileNavClassName(isActive: boolean) {
  return [
    'flex flex-col items-center justify-center gap-1 py-2 text-[11px] transition-colors',
    isActive ? 'text-accent-primary' : 'text-ink-tertiary hover:text-ink-secondary',
  ].join(' ')
}

function preloadRoute(preload: () => Promise<unknown>) {
  void preload().catch(() => undefined)
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
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const [accountAgeMonths, setAccountAgeMonths] = useState<number | null>(null)
  const [customAvatarUrl, setCustomAvatarUrl] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const [pendingSyncCount, setPendingSyncCount] = useState(0)
  const isGuest = !user || user.is_anonymous

  const displayName = getUserDisplayName(
    user?.email,
    user?.user_metadata?.full_name ?? user?.user_metadata?.name
  )
  const initials = getInitials(displayName)
  const avatarPath = user?.user_metadata?.avatar_path
  const avatarVersion = user?.user_metadata?.avatar_version
  const avatarUrl =
    (typeof avatarPath === 'string' ? customAvatarUrl : null) ??
    user?.user_metadata?.avatar_url ??
    user?.user_metadata?.picture

  useEffect(() => {
    const refresh = () => {
      setIsOnline(navigator.onLine)
      if (user?.id) {
        void getQueuedSessions(user.id).then((sessions) => setPendingSyncCount(sessions.length))
      }
    }

    refresh()
    const interval = window.setInterval(refresh, 5000)
    window.addEventListener('online', refresh)
    window.addEventListener('offline', refresh)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('online', refresh)
      window.removeEventListener('offline', refresh)
    }
  }, [user?.id])

  useEffect(() => {
    let active = true
    let objectUrl: string | null = null

    if (typeof avatarPath !== 'string') {
      return
    }

    void supabase.storage
      .from('avatars')
      .download(avatarPath)
      .then(({ data }) => {
        if (!data || !active) return
        objectUrl = URL.createObjectURL(data)
        setCustomAvatarUrl(objectUrl)
      })

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [avatarPath, avatarVersion])

  const openAccount = () => {
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

  const handlePhotoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !user) return

    if (!AVATAR_TYPES.has(file.type)) {
      setProfileMessage('Choose a JPG, PNG, or WebP image.')
      return
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setProfileMessage('Choose an image smaller than 5 MB.')
      return
    }

    setIsAuthPending(true)
    setProfileMessage(null)

    const path = `${user.id}/avatar`
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: true,
    })

    if (uploadError) {
      setProfileMessage(uploadError.message)
      setIsAuthPending(false)
      return
    }

    const { error } = await supabase.auth.updateUser({
      data: { avatar_path: path, avatar_version: Date.now() },
    })

    setProfileMessage(error ? error.message : 'Profile photo updated.')
    setIsAuthPending(false)
  }

  return (
    <div className="min-h-screen text-ink-primary">
      <div className="flex min-h-screen md:flex-row">
        <aside className="hidden border-r border-surface-border bg-surface-sidebar/55 px-4 py-9 md:sticky md:top-0 md:flex md:h-screen md:w-[248px] md:shrink-0 md:flex-col md:self-start md:overflow-y-auto">
          <div className="flex items-center gap-3 px-3 text-ink-primary">
            <FlowtimeMark className="h-9 w-9 text-accent-primary" />
            <p className="text-[22px] font-semibold tracking-[-0.035em]">Flowtime</p>
          </div>

          <nav className="mt-12 grid gap-2">
            {NAV_ITEMS.map(({ to, label, icon: Icon, preload }) => (
              <NavLink
                className={({ isActive }) => desktopNavClassName(isActive)}
                key={to}
                onFocus={() => preloadRoute(preload)}
                onMouseEnter={() => preloadRoute(preload)}
                to={to}
              >
                <Icon className="h-5 w-5" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto">
            <div
              className={`mb-5 flex items-center gap-2 px-3 text-xs ${!isOnline ? 'text-ink-tertiary' : pendingSyncCount > 0 ? 'text-accent-primary' : 'text-cyan-300'}`}
              role="status"
            >
              {isOnline ? <CloudCheck className="h-4 w-4" /> : <CloudOff className="h-4 w-4" />}
              <span>
                {!isOnline
                  ? 'Offline · changes stay local'
                  : pendingSyncCount > 0
                    ? `${pendingSyncCount} ${pendingSyncCount === 1 ? 'session' : 'sessions'} pending`
                    : 'All changes synced'}
              </span>
            </div>

            <div className="border-t border-surface-border-subtle pt-5">
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
                    <p className="truncate text-[15px] font-medium text-ink-primary">
                      {displayName}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-tertiary" />
                </button>
              )}

              {authError ? <p className="mt-2 text-sm text-red-300">{authError}</p> : null}
            </div>
          </div>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col pb-20 md:pb-0">
          <header className="flex items-center justify-between border-b border-surface-border-subtle bg-surface-sidebar px-4 py-3 md:hidden">
            <div className="flex items-center gap-2">
              <FlowtimeMark className="h-7 w-7 text-accent-primary" />
              <div>
                <p className="text-lg font-semibold tracking-wide text-ink-primary">Flowtime</p>
                {!isGuest ? (
                  <p className="mt-1 max-w-[200px] truncate text-xs text-ink-secondary">
                    {displayName}
                  </p>
                ) : null}
              </div>
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

          <main className="flex-1 px-4 py-6 md:px-10 md:py-9 xl:px-12">
            <div className="mx-auto w-full max-w-[1320px]">{children}</div>
          </main>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-surface-border-subtle bg-surface-sidebar md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4">
          {NAV_ITEMS.map(({ to, label, icon: Icon, preload }) => (
            <NavLink
              aria-label={label}
              className={({ isActive }) => mobileNavClassName(isActive)}
              key={to}
              onFocus={() => preloadRoute(preload)}
              onTouchStart={() => preloadRoute(preload)}
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
            <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-lg text-sm text-ink-secondary hover:text-ink-primary focus-within:ring-2 focus-within:ring-accent-primary/70">
              <Camera className="h-4 w-4" />
              {isAuthPending ? 'Uploading...' : 'Change photo'}
              <input
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={isAuthPending}
                onChange={handlePhotoUpload}
                type="file"
              />
            </label>
          </div>
        </div>

        {profileMessage ? (
          <p
            className={`mt-3 text-sm ${profileMessage.endsWith('updated.') ? 'text-ink-secondary' : 'text-red-300'}`}
            role="status"
          >
            {profileMessage}
          </p>
        ) : null}

        <dl className="mt-5 divide-y divide-surface-border-subtle border-y border-surface-border-subtle text-sm">
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
