import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from '@/components/ui/Layout'
import { AuthGuard } from '@/features/auth/components/AuthGuard'
import { StatsPage } from '@/features/stats/StatsPage'
import { TasksPage } from '@/features/tasks/TasksPage'
import { TimerPage } from '@/features/timer/TimerPage'

export function Router() {
  return (
    <BrowserRouter>
      <AuthGuard>
        <Layout>
          <Routes>
            <Route element={<TimerPage />} path="/" />
            <Route element={<TasksPage />} path="/tasks" />
            <Route element={<StatsPage />} path="/stats" />
            <Route element={<Navigate replace to="/" />} path="*" />
          </Routes>
        </Layout>
      </AuthGuard>
    </BrowserRouter>
  )
}
