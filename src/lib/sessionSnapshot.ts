import { DEFAULT_NEUTRAL_COLOR } from '@/lib/colors'
import type { Session, SessionWithTask, TaskWithCategory } from '@/types'

export interface SessionSnapshotInput {
  taskIdSnapshot: string | null
  taskNameSnapshot: string | null
  taskColorSnapshot: string | null
  categoryIdSnapshot: string | null
  categoryNameSnapshot: string | null
  categoryColorSnapshot: string | null
}

export const EMPTY_SESSION_SNAPSHOT: SessionSnapshotInput = {
  taskIdSnapshot: null,
  taskNameSnapshot: null,
  taskColorSnapshot: null,
  categoryIdSnapshot: null,
  categoryNameSnapshot: null,
  categoryColorSnapshot: null,
}

export function snapshotTask(task: TaskWithCategory): SessionSnapshotInput {
  return {
    taskIdSnapshot: task.id,
    taskNameSnapshot: task.name,
    taskColorSnapshot: task.color,
    categoryIdSnapshot: task.category_id,
    categoryNameSnapshot: task.categories?.name ?? null,
    categoryColorSnapshot: task.categories?.color ?? null,
  }
}

export function snapshotSession(session: SessionWithTask): SessionSnapshotInput {
  return {
    taskIdSnapshot: session.task_id_snapshot ?? session.task_id,
    taskNameSnapshot: session.task_name_snapshot ?? session.tasks?.name ?? null,
    taskColorSnapshot: session.task_color_snapshot ?? session.tasks?.color ?? null,
    categoryIdSnapshot: session.category_id_snapshot ?? session.tasks?.category_id ?? null,
    categoryNameSnapshot: session.category_name_snapshot ?? session.tasks?.categories?.name ?? null,
    categoryColorSnapshot:
      session.category_color_snapshot ?? session.tasks?.categories?.color ?? null,
  }
}

export function snapshotColumns(snapshot: SessionSnapshotInput) {
  return {
    task_id_snapshot: snapshot.taskIdSnapshot,
    task_name_snapshot: snapshot.taskNameSnapshot,
    task_color_snapshot: snapshot.taskColorSnapshot,
    category_id_snapshot: snapshot.categoryIdSnapshot,
    category_name_snapshot: snapshot.categoryNameSnapshot,
    category_color_snapshot: snapshot.categoryColorSnapshot,
  }
}

export function hydrateSession(session: Session, snapshot: SessionSnapshotInput): SessionWithTask {
  return {
    ...session,
    ...snapshotColumns(snapshot),
    tasks: snapshot.taskIdSnapshot
      ? {
          id: snapshot.taskIdSnapshot,
          name: snapshot.taskNameSnapshot ?? 'Task',
          color: snapshot.taskColorSnapshot,
          category_id: snapshot.categoryIdSnapshot,
          categories: snapshot.categoryIdSnapshot
            ? {
                id: snapshot.categoryIdSnapshot,
                name: snapshot.categoryNameSnapshot ?? 'Category',
                color: snapshot.categoryColorSnapshot ?? DEFAULT_NEUTRAL_COLOR,
                archived_at: null,
              }
            : null,
        }
      : null,
  }
}
