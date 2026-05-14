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

export function shouldRenormalizeById<T extends { id: string; position: number }>(
  items: T[],
  movedId: string,
  threshold: number
) {
  const movedIndex = items.findIndex((item) => item.id === movedId)
  if (movedIndex === -1) return false

  const moved = items[movedIndex]
  const previous = items[movedIndex - 1]
  const next = items[movedIndex + 1]

  const previousGap = previous
    ? Math.abs(moved.position - previous.position)
    : Number.POSITIVE_INFINITY
  const nextGap = next ? Math.abs(next.position - moved.position) : Number.POSITIVE_INFINITY

  return Math.min(previousGap, nextGap) < threshold
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
