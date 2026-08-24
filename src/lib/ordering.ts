export type DropPlacement = 'before' | 'after'

const DRAG_DATA_FALLBACK_TYPE = 'text/plain'

export function requireUserId(userId?: string): string {
  if (!userId) {
    throw new Error('User is not authenticated')
  }

  return userId
}

export function requireTaskId(taskId?: string): string {
  if (!taskId) {
    throw new Error('Task is required for subtask operations')
  }

  return taskId
}

export function getNextPosition(items: Array<{ position: number }>) {
  const maxPosition = items.length > 0 ? Math.max(...items.map((item) => item.position)) : -1
  return maxPosition + 1
}

export interface PositionedItem {
  id: string
  position: number
  created_at: string
}

export function sortByPositionAndCreatedAt<T extends PositionedItem>(items: T[]) {
  return [...items].sort(
    (a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at)
  )
}

export function getDropInsertPosition<T extends { id: string; position: number }>(
  items: T[],
  draggedId: string,
  targetId: string,
  placement: DropPlacement
) {
  const ordered = [...items].sort((a, b) => a.position - b.position)
  const withoutDragged = ordered.filter((item) => item.id !== draggedId)
  const targetIndex = withoutDragged.findIndex((item) => item.id === targetId)
  if (targetIndex === -1) return null

  const insertIndex = placement === 'before' ? targetIndex : targetIndex + 1
  const previous = withoutDragged[insertIndex - 1]
  const next = withoutDragged[insertIndex]

  if (!previous && !next) return 0
  if (!previous && next) return next.position - 1
  if (previous && !next) return previous.position + 1
  return (previous.position + next.position) / 2
}

export function getStepMovePosition<T extends { id: string; position: number }>(
  items: T[],
  itemId: string,
  direction: -1 | 1
) {
  const ordered = [...items].sort((a, b) => a.position - b.position)
  const currentIndex = ordered.findIndex((item) => item.id === itemId)
  if (currentIndex === -1) return null

  const targetIndex = currentIndex + direction
  if (targetIndex < 0 || targetIndex >= ordered.length) return null

  const target = ordered[targetIndex]
  const placement: DropPlacement = direction < 0 ? 'before' : 'after'
  return getDropInsertPosition(ordered, itemId, target.id, placement)
}

export function setDragData(dataTransfer: DataTransfer, type: string, id: string) {
  dataTransfer.effectAllowed = 'move'
  dataTransfer.setData(type, id)
  dataTransfer.setData(DRAG_DATA_FALLBACK_TYPE, id)
}

export function getDragData(dataTransfer: DataTransfer, type: string) {
  const customValue = dataTransfer.getData(type).trim()
  if (customValue.length > 0) {
    return customValue
  }

  const fallbackValue = dataTransfer.getData(DRAG_DATA_FALLBACK_TYPE).trim()
  if (fallbackValue.length > 0) {
    return fallbackValue
  }

  return null
}
