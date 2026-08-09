import { QueryClientProvider } from '@tanstack/react-query'
import { AppErrorBoundary } from '@/app/AppErrorBoundary'
import { Router } from '@/app/Router'
import { UserStateBoundary } from '@/app/UserStateBoundary'
import { UserProvider } from '@/context/UserContext'
import { queryClient } from '@/lib/queryClient'

export function App() {
  return (
    <AppErrorBoundary>
      <UserProvider>
        <QueryClientProvider client={queryClient}>
          <UserStateBoundary>
            <Router />
          </UserStateBoundary>
        </QueryClientProvider>
      </UserProvider>
    </AppErrorBoundary>
  )
}
