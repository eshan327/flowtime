import type { TimeRange } from '@/types'

export const queryKeys = {
  categories: (userId?: string) => ['categories', userId] as const,
  tasks: (userId?: string) => ['tasks', userId] as const,
  subtasksRoot: () => ['subtasks'] as const,
  subtasks: (taskId?: string) => ['subtasks', taskId] as const,
  sessions: (userId?: string) => ['sessions', userId] as const,
  sessionsById: (userId: string | undefined, sessionId: string | null | undefined) =>
    ['sessions', userId, 'by-id', sessionId] as const,
  sessionsLogRange: (
    userId: string | undefined,
    range: TimeRange,
    fromIso: string,
    toIso: string,
    page: number,
    pageSize: number
  ) => ['sessions', userId, 'log', { range, from: fromIso, to: toIso, page, pageSize }] as const,
  sessionsTodaySummary: (userId: string | undefined, dayIso: string) =>
    ['sessions', userId, 'today-summary', dayIso] as const,
  sessionsStatsRange: (
    userId: string | undefined,
    range: TimeRange,
    fromIso: string,
    toIso: string
  ) => ['sessions', userId, { range, from: fromIso, to: toIso }] as const,
  sessionsHeatmap: (userId?: string) => ['sessions', userId, 'heatmap'] as const,
  sessionsStreak: (userId?: string) => ['sessions', userId, 'streak'] as const,
  sessionsExportAll: (userId?: string) => ['sessions', userId, 'export', 'all'] as const,
}
