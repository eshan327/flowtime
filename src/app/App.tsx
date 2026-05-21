import { AppErrorBoundary } from '@/app/AppErrorBoundary'
import { AppQueryClientProvider } from '@/app/QueryClientProvider'
import { Router } from '@/app/Router'
import { UserProvider } from '@/context/UserContext'

export function App() {
  return (
    <AppErrorBoundary>
      <UserProvider>
        <AppQueryClientProvider>
          <Router />
        </AppQueryClientProvider>
      </UserProvider>
    </AppErrorBoundary>
  )
}
