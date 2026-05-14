import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/utils/supabase'

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
      <path
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.46a5.5 5.5 0 0 1-2.4 3.61v3h3.87c2.25-2.07 3.56-5.12 3.56-8.64z"
        fill="#4285F4"
      />
      <path
        d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.87-3A7.18 7.18 0 0 1 12 19.45a7.2 7.2 0 0 1-6.78-4.96H1.22v3.1A12 12 0 0 0 12 24z"
        fill="#34A853"
      />
      <path
        d="M5.22 14.49A7.2 7.2 0 0 1 4.82 12c0-.86.15-1.7.4-2.49v-3.1h-4A12 12 0 0 0 0 12c0 1.94.46 3.78 1.22 5.59z"
        fill="#FBBC05"
      />
      <path
        d="M12 4.55c1.77 0 3.35.61 4.59 1.8l3.44-3.44A11.9 11.9 0 0 0 12 0 12 12 0 0 0 1.22 6.41l4 3.1A7.2 7.2 0 0 1 12 4.55z"
        fill="#EA4335"
      />
    </svg>
  )
}

export function LoginPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleContinueWithGoogle = async () => {
    setError(null)
    setIsSubmitting(true)

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      })

      if (error) {
        setError(error.message)
        setIsSubmitting(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start Google sign in.')
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-base px-6 text-ink-primary">
      <section className="w-full max-w-md rounded-2xl border border-surface-border bg-surface-raised p-8">
        <h1 className="text-5xl font-light tracking-tight">Flowtime</h1>
        <p className="mt-3 text-sm text-ink-secondary">
          Focus until you stop, then take the break you earn.
        </p>

        <Button
          className="mt-8 w-full gap-2"
          disabled={isSubmitting}
          loading={isSubmitting}
          onClick={handleContinueWithGoogle}
          variant="outlined"
        >
          {!isSubmitting ? <GoogleIcon /> : null}
          <span>{isSubmitting ? 'Connecting...' : 'Continue with Google'}</span>
        </Button>

        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      </section>
    </main>
  )
}
