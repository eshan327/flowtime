import type { Database } from '@/types/supabase'

export type Category = Database['public']['Tables']['categories']['Row']
export type Task = Database['public']['Tables']['tasks']['Row']
export type Subtask = Database['public']['Tables']['subtasks']['Row']
export type Session = Database['public']['Tables']['sessions']['Row']

export type TimeRange = 'day' | 'week' | 'month' | 'year'

export interface TaskWithCategory extends Task {
  categories: Pick<Category, 'name' | 'color'> | null
}

export type SessionWithTask = Session & {
  tasks:
    | (Pick<Task, 'name' | 'color' | 'category_id'> & {
        id: string
        categories: Pick<Category, 'name' | 'color'> | null
      })
    | null
}

export interface CategorySeconds {
  categoryId: string | null
  categoryName: string
  color: string
  seconds: number
}

export interface DaySummary {
  date: string
  totalSeconds: number
  byCategory: CategorySeconds[]
}

export interface CategorySummary {
  categoryId: string | null
  categoryName: string
  color: string
  totalSeconds: number
  sessionCount: number
}

export interface TaskSummary {
  taskId: string | null
  taskName: string
  categoryName: string | null
  color: string
  totalSeconds: number
  sessionCount: number
}

export interface HeatmapDay {
  date: string
  totalSeconds: number
  dominantColor: string | null
  byCategory: CategorySeconds[]
}
