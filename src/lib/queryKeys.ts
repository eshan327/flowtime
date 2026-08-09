import type { TimeRange } from '@/types'

export const queryKeys = {
  categories: (userId?: string) => ['categories', userId] as const,
  tasks: (userId?: string) => ['tasks', userId] as const,
  subtasksRoot: () => ['subtasks'] as const,
  subtasks: (taskId?: string) => ['subtasks', taskId] as const,
  sessions: (userId?: string) => ['sessions', userId] as const,
  sessionsTodaySummary: (userId: string | undefined, dayIso: string) =>
    ['sessions', userId, 'today-summary', dayIso] as const,
  sessionsStatsRange: (
    userId: string | undefined,
    range: TimeRange,
    fromIso: string,
    toIso: string
  ) => ['sessions', userId, { range, from: fromIso, to: toIso }] as const,
  sessionsHistoryRange: (
    userId: string | undefined,
    fromIso: string | null,
    toIso: string | null
  ) => ['sessions', userId, 'history', { from: fromIso ?? 'all', to: toIso ?? 'all' }] as const,
  sessionsHeatmap: (userId?: string) => ['sessions', userId, 'heatmap'] as const,
  sessionsStreak: (userId?: string) => ['sessions', userId, 'streak'] as const,
}
