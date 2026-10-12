import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useUser } from '@/context/UserContext'
import { supabase } from '@/lib/supabaseClient'

function redirectToClient(url: string) {
  const destination = new URL(url)
  if (
    destination.protocol !== 'https:' &&
    !(
      destination.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(destination.hostname)
    )
  ) {
    throw new Error('The connector must use an HTTPS or localhost callback.')
  }
  window.location.assign(destination.href)
}

export function ConnectionsPage() {
  const { user } = useUser()
  const [params] = useSearchParams()
  const authorizationId = params.get('authorization_id')
  const queryClient = useQueryClient()
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const signedIn = !!user && !user.is_anonymous
  const authorization = useQuery({
    queryKey: ['oauth-authorization', user?.id, authorizationId],
    enabled: signedIn && !!authorizationId,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId!)
      if (error) throw error
      return data
    },
  })
  const grants = useQuery({
    queryKey: ['oauth-grants', user?.id],
    enabled: signedIn && !authorizationId,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.auth.oauth.listGrants()
      if (error) throw error
      return data
    },
  })

  async function act(action: () => Promise<void>) {
    setPending(true)
    setMessage(null)
    try {
      await action()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not complete the request.')
    } finally {
      setPending(false)
    }
  }
  function signIn() {
    return act(async () => {
      const credentials = {
        provider: 'google' as const,
        options: { redirectTo: window.location.href },
      }
      const { error } = user?.is_anonymous
        ? await supabase.auth.linkIdentity(credentials)
        : await supabase.auth.signInWithOAuth(credentials)
      if (error) throw error
    })
  }
  function decide(approved: boolean) {
    return act(async () => {
      const { data, error } = approved
        ? await supabase.auth.oauth.approveAuthorization(authorizationId!, {
            skipBrowserRedirect: true,
          })
        : await supabase.auth.oauth.denyAuthorization(authorizationId!, {
            skipBrowserRedirect: true,
          })
      if (error) throw error
      redirectToClient(data.redirect_url)
    })
  }

  const details = authorization.data && 'client' in authorization.data ? authorization.data : null
  const existingRedirect =
    authorization.data && 'redirect_url' in authorization.data
      ? authorization.data.redirect_url
      : null
  const error = authorization.error ?? grants.error

  return (
    <section className="mx-auto max-w-xl space-y-6 px-4 py-10">
      <h1 className="text-2xl font-semibold text-ink-primary">
        {authorizationId ? 'Connect to Flowtime' : 'Agent connections'}
      </h1>
      {!signedIn ? (
        <>
          <p className="text-ink-secondary">
            Sign in with the Google account you use for Flowtime to connect an assistant to your
            tasks and study history.
          </p>
          <Button onClick={signIn} loading={pending}>
            Sign in with Google
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-secondary">Signed in as {user.email}</p>
          {(authorization.isFetching || grants.isFetching) && <Spinner />}
          {details && (
            <>
              <p className="text-ink-primary">
                <strong>{details.client.name}</strong> is requesting access to Flowtime.
              </p>
              <p className="break-all text-sm text-ink-secondary">
                Client ID: {details.client.id}
                <br />
                Return address: {details.redirect_uri}
                <br />
                Identity scopes: {details.scope}
              </p>
              <ul className="list-disc space-y-2 pl-5 text-ink-secondary">
                <li>Read your tasks, categories, study history, timer snapshot, and settings.</li>
                <li>Create, rename, move, complete, and reopen your tasks.</li>
                <li>
                  Cannot delete tasks, edit study history, control the timer, or change settings.
                </li>
              </ul>
              <p className="text-sm text-ink-secondary">
                Only approve a connection you started. Study history can reveal your routines. You
                can revoke access from Agent connections in your account.
              </p>
              <div className="flex gap-3">
                <Button onClick={() => decide(false)} disabled={pending}>
                  Deny
                </Button>
                <Button onClick={() => decide(true)} loading={pending} variant="filled">
                  Allow access
                </Button>
              </div>
            </>
          )}
          {existingRedirect && (
            <Button
              loading={pending}
              onClick={() => act(async () => redirectToClient(existingRedirect))}
            >
              Continue to connected assistant
            </Button>
          )}
          {!authorizationId && grants.data && (
            <>
              <p className="text-sm text-ink-secondary">
                Revoking stops token refresh. An existing access token may remain usable until it
                expires.
              </p>
              {grants.data.length === 0 && (
                <p className="text-ink-secondary">No assistants connected.</p>
              )}
              <ul className="space-y-4">
                {grants.data.map((grant) => (
                  <li
                    key={grant.client.id}
                    className="flex items-center justify-between gap-4 rounded-lg border border-surface-border p-4"
                  >
                    <div className="min-w-0">
                      <p className="text-ink-primary">{grant.client.name}</p>
                      <p className="break-all text-xs text-ink-tertiary">{grant.client.id}</p>
                    </div>
                    <Button
                      disabled={pending}
                      onClick={() =>
                        act(async () => {
                          const { error: revokeError } = await supabase.auth.oauth.revokeGrant({
                            clientId: grant.client.id,
                          })
                          if (revokeError) throw revokeError
                          await queryClient.invalidateQueries({
                            queryKey: ['oauth-grants', user.id],
                          })
                        })
                      }
                    >
                      Revoke
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
      {(message || error) && (
        <p role="alert" className="text-ink-primary">
          {message ??
            'Connections are unavailable. The OAuth server may still need to be configured; try again later.'}
        </p>
      )}
      <Link to="/" className="inline-block text-accent-primary underline">
        Back to timer
      </Link>
    </section>
  )
}
