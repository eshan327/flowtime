import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from '@/components/ui/Layout'
import { Spinner } from '@/components/ui/Spinner'
import { AuthGuard } from '@/features/auth/components/AuthGuard'

const TimerPage = lazy(() =>
  import('@/features/timer/TimerPage').then((mod) => ({ default: mod.TimerPage }))
)
const TasksPage = lazy(() =>
  import('@/features/tasks/TasksPage').then((mod) => ({ default: mod.TasksPage }))
)
const StatsPage = lazy(() =>
  import('@/features/stats/StatsPage').then((mod) => ({ default: mod.StatsPage }))
)
const HistoryPage = lazy(() =>
  import('@/features/history/HistoryPage').then((mod) => ({ default: mod.HistoryPage }))
)

export function Router() {
  return (
    <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <AuthGuard>
        <Layout>
          <Suspense
            fallback={
              <div className="flex h-[60vh] items-center justify-center">
                <Spinner />
              </div>
            }
          >
            <Routes>
              <Route element={<TimerPage />} path="/" />
              <Route element={<TasksPage />} path="/tasks" />
              <Route element={<StatsPage />} path="/stats" />
              <Route element={<HistoryPage />} path="/history" />
              <Route element={<Navigate replace to="/" />} path="*" />
            </Routes>
          </Suspense>
        </Layout>
      </AuthGuard>
    </BrowserRouter>
  )
}
