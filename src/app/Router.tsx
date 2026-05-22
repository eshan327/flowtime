import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import {
  loadHistoryPageModule,
  loadStatsPageModule,
  loadTasksPageModule,
  loadTimerPageModule,
} from '@/app/routePreload'
import { Layout } from '@/components/ui/Layout'
import { Spinner } from '@/components/ui/Spinner'
import { AuthGuard } from '@/features/auth/components/AuthGuard'

const TimerPage = lazy(() => loadTimerPageModule().then((mod) => ({ default: mod.TimerPage })))
const TasksPage = lazy(() => loadTasksPageModule().then((mod) => ({ default: mod.TasksPage })))
const StatsPage = lazy(() => loadStatsPageModule().then((mod) => ({ default: mod.StatsPage })))
const HistoryPage = lazy(() =>
  loadHistoryPageModule().then((mod) => ({ default: mod.HistoryPage }))
)

export function Router() {
  return (
    <BrowserRouter>
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
