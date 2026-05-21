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

export interface SessionSelectionFallback {
  taskId: string | null
  taskName: string | null
  taskColor: string | null
  categoryId: string | null
  categoryName: string | null
  categoryColor: string | null
}

export function getSessionColor(session: SessionWithTask) {
  return (
    session.category_color_snapshot ??
    session.task_color_snapshot ??
    session.tasks?.categories?.color ??
    session.tasks?.color ??
    DEFAULT_NEUTRAL_COLOR
  )
}

export function getSessionCategoryId(session: SessionWithTask) {
  return session.category_id_snapshot ?? session.tasks?.category_id ?? null
}

export function getSessionCategoryName(session: SessionWithTask) {
  return session.category_name_snapshot ?? session.tasks?.categories?.name ?? 'Uncategorized'
}

export function getSessionCategoryColor(session: SessionWithTask) {
  return session.category_color_snapshot ?? session.tasks?.categories?.color ?? null
}

export function getSessionTaskId(session: SessionWithTask) {
  return session.task_id_snapshot ?? session.task_id ?? null
}

export function getSessionTaskName(session: SessionWithTask) {
  return session.task_name_snapshot ?? session.tasks?.name ?? null
}

export function getSessionTaskColor(session: SessionWithTask) {
  return session.task_color_snapshot ?? session.tasks?.color ?? getSessionColor(session)
}

export function createSessionSnapshotFromTask(task: TaskWithCategory): SessionSnapshotInput {
  return {
    taskIdSnapshot: task.id,
    taskNameSnapshot: task.name,
    taskColorSnapshot: task.color ?? null,
    categoryIdSnapshot: task.category_id,
    categoryNameSnapshot: task.categories?.name ?? null,
    categoryColorSnapshot: task.categories?.color ?? null,
  }
}

export function createSessionSnapshotFromSelection(
  selectedTask: TaskWithCategory | null,
  fallback: SessionSelectionFallback
): SessionSnapshotInput {
  if (selectedTask) {
    return createSessionSnapshotFromTask(selectedTask)
  }

  return {
    taskIdSnapshot: fallback.taskId,
    taskNameSnapshot: fallback.taskName,
    taskColorSnapshot: fallback.taskColor,
    categoryIdSnapshot: fallback.categoryId,
    categoryNameSnapshot: fallback.categoryName,
    categoryColorSnapshot: fallback.categoryColor,
  }
}

export function createSessionSnapshotFromSession(session: SessionWithTask): SessionSnapshotInput {
  return {
    taskIdSnapshot: session.task_id_snapshot ?? session.task_id ?? null,
    taskNameSnapshot: session.task_name_snapshot ?? session.tasks?.name ?? null,
    taskColorSnapshot: session.task_color_snapshot ?? session.tasks?.color ?? null,
    categoryIdSnapshot: session.category_id_snapshot ?? session.tasks?.category_id ?? null,
    categoryNameSnapshot: session.category_name_snapshot ?? session.tasks?.categories?.name ?? null,
    categoryColorSnapshot:
      session.category_color_snapshot ?? session.tasks?.categories?.color ?? null,
  }
}

export function createSessionSnapshotForTaskId(
  taskId: string | null,
  selectedTask: TaskWithCategory | null,
  fallbackSession: SessionWithTask
): SessionSnapshotInput {
  if (!taskId) {
    return EMPTY_SESSION_SNAPSHOT
  }

  if (selectedTask) {
    return createSessionSnapshotFromTask(selectedTask)
  }

  const fallback = createSessionSnapshotFromSession(fallbackSession)
  return {
    ...fallback,
    taskIdSnapshot: taskId,
  }
}

export function toSessionSnapshotColumns(snapshot: SessionSnapshotInput) {
  return {
    task_id_snapshot: snapshot.taskIdSnapshot,
    task_name_snapshot: snapshot.taskNameSnapshot,
    task_color_snapshot: snapshot.taskColorSnapshot,
    category_id_snapshot: snapshot.categoryIdSnapshot,
    category_name_snapshot: snapshot.categoryNameSnapshot,
    category_color_snapshot: snapshot.categoryColorSnapshot,
  }
}

export function toSessionWithTask(
  session: Session,
  snapshot: SessionSnapshotInput
): SessionWithTask {
  return {
    ...session,
    ...toSessionSnapshotColumns(snapshot),
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
                break_divisor: null,
                archived_at: null,
              }
            : null,
        }
      : null,
  }
}
