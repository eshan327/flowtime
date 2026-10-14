import type { SessionWithTask, TaskWithCategory } from '@/types'

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
  const hasSnapshot = session.task_id_snapshot !== null || session.task_name_snapshot !== null
  return {
    taskIdSnapshot: hasSnapshot ? session.task_id_snapshot : session.task_id,
    taskNameSnapshot: hasSnapshot ? session.task_name_snapshot : (session.tasks?.name ?? null),
    taskColorSnapshot: hasSnapshot ? session.task_color_snapshot : (session.tasks?.color ?? null),
    categoryIdSnapshot: hasSnapshot
      ? session.category_id_snapshot
      : (session.tasks?.category_id ?? null),
    categoryNameSnapshot: hasSnapshot
      ? session.category_name_snapshot
      : (session.tasks?.categories?.name ?? null),
    categoryColorSnapshot: hasSnapshot
      ? session.category_color_snapshot
      : (session.tasks?.categories?.color ?? null),
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
