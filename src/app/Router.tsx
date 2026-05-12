import { useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthGuard } from '@/features/auth/components/AuthGuard'
import { useUser } from '@/hooks/useUser'
import { supabase } from '@/lib/supabaseClient'

function AuthenticatedShell() {
  const { user } = useUser()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSignOut = async () => {
    setIsSigningOut(true)
    setError(null)

    const { error } = await supabase.auth.signOut()
    if (error) {
      setError(error.message)
      setIsSigningOut(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-base px-6 text-ink-primary">
      <section className="w-full max-w-xl rounded-2xl border border-surface-border bg-surface-raised p-8">
        <p className="text-xs uppercase tracking-[0.14em] text-ink-tertiary">Authenticated Shell</p>
        <h1 className="mt-2 text-2xl font-light">Welcome back</h1>
        <p className="mt-2 text-sm text-ink-secondary">
          {user?.email ?? 'Google account connected.'}
        </p>

        <div className="mt-8 flex justify-end">
          <button
            className="rounded-lg border border-surface-border px-3 py-2 text-sm text-ink-secondary transition hover:border-ink-secondary hover:text-ink-primary disabled:cursor-not-allowed disabled:opacity-70"
            disabled={isSigningOut}
            onClick={handleSignOut}
            type="button"
          >
            {isSigningOut ? 'Signing out...' : 'Sign out'}
          </button>
        </div>

        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      </section>
    </main>
  )
}

export function Router() {
  return (
    <BrowserRouter>
      <AuthGuard>
        <Routes>
          <Route element={<AuthenticatedShell />} path="/" />
          <Route element={<Navigate replace to="/" />} path="*" />
        </Routes>
      </AuthGuard>
    </BrowserRouter>
  )
}
