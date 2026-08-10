import type { DragEvent } from 'react'
import { getDragData, type DropPlacement } from '@/lib/ordering'

export const TASK_DRAG_MIME = 'application/x-flowtime-task-id'
export const SUBTASK_DRAG_MIME = 'application/x-flowtime-subtask-id'

export function getVerticalDropPlacement(event: DragEvent<HTMLElement>): DropPlacement {
  const rect = event.currentTarget.getBoundingClientRect()
  return event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
}

export function resolveDraggedId(
  event: DragEvent<HTMLElement>,
  mimeType: string,
  fallbackDraggedId: string | null
) {
  return fallbackDraggedId ?? getDragData(event.dataTransfer, mimeType)
}
