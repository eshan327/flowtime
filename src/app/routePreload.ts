import { measureAsync } from '@/lib/perf'

export type AppRoutePath = '/' | '/tasks' | '/stats' | '/history'

export const loadTimerPageModule = () => import('@/features/timer/TimerPage')
export const loadTasksPageModule = () => import('@/features/tasks/TasksPage')
export const loadStatsPageModule = () => import('@/features/stats/StatsPage')
export const loadHistoryPageModule = () => import('@/features/history/HistoryPage')

const routeModuleLoaders: Record<AppRoutePath, () => Promise<unknown>> = {
  '/': loadTimerPageModule,
  '/tasks': loadTasksPageModule,
  '/stats': loadStatsPageModule,
  '/history': loadHistoryPageModule,
}

function normalizeRoutePath(route: string): AppRoutePath | null {
  if (route === '/' || route.startsWith('/?')) return '/'
  if (route.startsWith('/tasks')) return '/tasks'
  if (route.startsWith('/stats')) return '/stats'
  if (route.startsWith('/history')) return '/history'
  return null
}

export function preloadRouteModule(route: string) {
  const normalizedRoute = normalizeRoutePath(route)
  if (!normalizedRoute) return

  void measureAsync(`chunk:${normalizedRoute}`, routeModuleLoaders[normalizedRoute]).catch(() => {
    // Ignore preload failures; navigation will retry the import path.
  })
}

export async function preloadAllRouteModules() {
  await Promise.all(
    Object.entries(routeModuleLoaders).map(([path, loader]) =>
      measureAsync(`chunk:${path}`, loader).catch(() => {
        // Ignore preload failures; navigation will retry the import path.
      })
    )
  )
}
