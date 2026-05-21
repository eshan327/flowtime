import type { DragEvent, MutableRefObject } from 'react'
import { getDragData, type DropPlacement } from '@/lib/ordering'

export const CATEGORY_DRAG_MIME = 'application/x-flowtime-category-id'
export const TASK_DRAG_MIME = 'application/x-flowtime-task-id'
export const SUBTASK_DRAG_MIME = 'application/x-flowtime-subtask-id'

export function getHorizontalDropPlacement(event: DragEvent<HTMLElement>): DropPlacement {
  const rect = event.currentTarget.getBoundingClientRect()
  return event.clientX < rect.left + rect.width / 2 ? 'before' : 'after'
}

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

export function setDragIntentId(ref: MutableRefObject<string | null>, itemId: string) {
  ref.current = itemId
}

export function clearDragIntentId(ref: MutableRefObject<string | null>) {
  ref.current = null
}

export function canStartDrag(ref: MutableRefObject<string | null>, itemId: string) {
  return ref.current === itemId
}
