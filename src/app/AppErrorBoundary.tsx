import { Component, type ReactNode } from 'react'

interface AppErrorBoundaryProps {
  children: ReactNode
}

interface AppErrorBoundaryState {
  hasError: boolean
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  constructor(props: AppErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-surface-base px-6 text-ink-primary">
        <section className="w-full max-w-md rounded-2xl border border-surface-border bg-surface-raised p-8">
          <h1 className="text-2xl font-light">Something went wrong</h1>
          <p className="mt-3 text-sm text-ink-secondary">
            Flowtime hit an unexpected error. Reloading usually resolves temporary issues.
          </p>
          <button
            className="mt-6 inline-flex h-10 items-center justify-center rounded-lg border border-ink-primary bg-ink-primary px-4 text-sm text-surface-base transition hover:opacity-90"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.reload()
              }
            }}
            type="button"
          >
            Reload app
          </button>
        </section>
      </main>
    )
  }
}
