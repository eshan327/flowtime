import { useEffect, useRef, useState } from 'react'
import {
  Check,
  ChevronDown,
  ChevronRight,
  GripVertical,
  MoreHorizontal,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DEFAULT_TASK_COLOR } from '@/features/tasks/constants'
import { ColorPicker } from '@/features/tasks/components/ColorPicker'
import { SubtaskList } from '@/features/tasks/components/SubtaskList'
import { useSubtasks } from '@/features/tasks/hooks/useSubtasks'
import {
  canStartDrag,
  clearDragIntentId,
  getVerticalDropPlacement,
  resolveDraggedId,
  setDragIntentId,
  TASK_DRAG_MIME,
} from '@/features/tasks/lib/dragReorder'
import {
  getDropInsertPosition,
  getStepMovePosition,
  setDragData,
  type DropPlacement,
} from '@/lib/ordering'
import { getErrorMessage } from '@/lib/errorMessages'
import type { Category, TaskWithCategory } from '@/types'

interface TaskItemProps {
  task: TaskWithCategory
  tasksInGroup: TaskWithCategory[]
  categories: Category[]
  onCompleteTask: (taskId: string) => Promise<void> | void
  onDeleteTask: (taskId: string) => Promise<void> | void
  onUpdateTask: (payload: { id: string; name?: string; color?: string }) => Promise<void> | void
  onMoveTask: (payload: { id: string; categoryId: string | null }) => Promise<void> | void
  onReorderTask: (payload: { id: string; newPosition: number }) => Promise<void> | void
}

export function TaskItem({
  task,
  tasksInGroup,
  categories,
  onCompleteTask,
  onDeleteTask,
  onUpdateTask,
  onMoveTask,
  onReorderTask,
}: TaskItemProps) {
  const accentColor = task.categories?.color ?? task.color ?? DEFAULT_TASK_COLOR
  const { subtasks, completedCount, totalCount } = useSubtasks(task.id)

  const [isExpanded, setIsExpanded] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [draftName, setDraftName] = useState(task.name)
  const [isCompleting, setIsCompleting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [showMoveMenu, setShowMoveMenu] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)

  const [dropPlacement, setDropPlacement] = useState<DropPlacement | null>(null)
  const [reorderError, setReorderError] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const dragIntentTaskIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isMenuOpen) return

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (!menuRef.current?.contains(target)) {
        setIsMenuOpen(false)
        setShowMoveMenu(false)
        setShowColorPicker(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false)
        setShowMoveMenu(false)
        setShowColorPicker(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isMenuOpen])

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditing])

  const closeMenu = () => {
    setIsMenuOpen(false)
    setShowMoveMenu(false)
    setShowColorPicker(false)
  }

  const setTaskReorderError = (error: unknown) => {
    setReorderError(getErrorMessage(error, 'Unable to reorder task right now.'))
  }

  const handleSaveName = async () => {
    const trimmed = draftName.trim()
    if (!trimmed || trimmed === task.name) {
      setDraftName(task.name)
      setIsEditing(false)
      return
    }

    await onUpdateTask({ id: task.id, name: trimmed })
    setIsEditing(false)
  }

  const handleDrop = async (draggedTaskId: string, placement: DropPlacement) => {
    if (draggedTaskId === task.id) {
      setDropPlacement(null)
      return
    }

    if (!tasksInGroup.some((item) => item.id === draggedTaskId)) {
      setDropPlacement(null)
      return
    }

    const newPosition = getDropInsertPosition(tasksInGroup, draggedTaskId, task.id, placement)
    if (newPosition === null) {
      setDropPlacement(null)
      return
    }

    try {
      await onReorderTask({ id: draggedTaskId, newPosition })
      setReorderError(null)
      setDropPlacement(null)
    } catch (error) {
      setTaskReorderError(error)
      setDropPlacement(null)
    }
  }

  const moveTaskByStep = async (direction: -1 | 1) => {
    const newPosition = getStepMovePosition(tasksInGroup, task.id, direction)
    if (newPosition === null) {
      return
    }

    try {
      await onReorderTask({ id: task.id, newPosition })
      setReorderError(null)
    } catch (error) {
      setTaskReorderError(error)
    }
  }

  const showSubtaskToggle = subtasks.length > 0 || isExpanded

  return (
    <div className="relative">
      {dropPlacement === 'before' ? (
        <span className="absolute -top-1 left-0 right-0 h-0.5 bg-ink-primary" />
      ) : null}

      <div
        className={`rounded-lg border border-surface-border transition-all duration-300 transform-gpu ${
          isCompleting || isDeleting
            ? 'max-h-0 -translate-x-2 overflow-hidden opacity-0'
            : 'max-h-[1000px] translate-x-0 opacity-100'
        }`}
        draggable
        onDragEnd={() => {
          clearDragIntentId(dragIntentTaskIdRef)
          setDropPlacement(null)
        }}
        onDragOver={(event) => {
          event.preventDefault()

          const draggedId = resolveDraggedId(event, TASK_DRAG_MIME, null)
          if (draggedId === task.id) {
            setDropPlacement(null)
            return
          }

          if (draggedId && !tasksInGroup.some((item) => item.id === draggedId)) {
            setDropPlacement(null)
            return
          }

          const placement = getVerticalDropPlacement(event)
          setDropPlacement(placement)
        }}
        onDragStart={(event) => {
          if (!canStartDrag(dragIntentTaskIdRef, task.id)) {
            event.preventDefault()
            return
          }

          setDragData(event.dataTransfer, TASK_DRAG_MIME, task.id)
        }}
        onDrop={(event) => {
          event.preventDefault()
          const draggedId = resolveDraggedId(event, TASK_DRAG_MIME, null)
          if (!draggedId) {
            setDropPlacement(null)
            return
          }

          const fallbackPlacement: DropPlacement = getVerticalDropPlacement(event)
          void handleDrop(draggedId, dropPlacement ?? fallbackPlacement)
        }}
      >
        <div
          className="flex items-center gap-2 border-l-2 px-2 py-2"
          style={{ borderLeftColor: accentColor }}
        >
          <Button
            aria-label={`Reorder ${task.name}`}
            className="cursor-grab p-0 text-ink-tertiary transition hover:text-ink-secondary"
            onPointerCancel={() => {
              clearDragIntentId(dragIntentTaskIdRef)
            }}
            onPointerDown={() => {
              setDragIntentId(dragIntentTaskIdRef, task.id)
            }}
            onPointerUp={() => {
              clearDragIntentId(dragIntentTaskIdRef)
            }}
            size="icon"
            variant="ghost"
          >
            <GripVertical className="h-4 w-4" />
          </Button>

          <Button
            aria-label={`Complete ${task.name}`}
            className="h-5 w-5 rounded-full p-0 text-ink-tertiary transition hover:text-ink-primary"
            onClick={() => {
              setIsCompleting(true)
              window.setTimeout(() => {
                void Promise.resolve(onCompleteTask(task.id)).catch(() => {
                  setIsCompleting(false)
                })
              }, 300)
            }}
            size="icon"
            variant="outlined"
          >
            <Check className="h-3 w-3" />
          </Button>

          <div className="min-w-0 flex-1">
            {isEditing ? (
              <Input
                aria-label={`Rename ${task.name}`}
                className="w-full px-2 py-1 text-sm"
                onBlur={() => {
                  void handleSaveName()
                }}
                onChange={(event) => setDraftName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void handleSaveName()
                  }

                  if (event.key === 'Escape') {
                    event.preventDefault()
                    setDraftName(task.name)
                    setIsEditing(false)
                  }
                }}
                ref={inputRef}
                value={draftName}
              />
            ) : (
              <Button
                className="h-auto w-full justify-start p-0 text-left text-sm text-ink-primary"
                onDoubleClick={() => {
                  setIsEditing(true)
                  setDraftName(task.name)
                }}
                size="sm"
                variant="ghost"
              >
                {task.name}
              </Button>
            )}

            {totalCount > 0 ? (
              <p className="mt-0.5 text-xs text-ink-tertiary">
                {completedCount}/{totalCount} done
              </p>
            ) : null}
          </div>

          {showSubtaskToggle ? (
            <Button
              aria-label={isExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
              className="p-0 text-ink-tertiary transition hover:text-ink-secondary"
              onClick={() => setIsExpanded((current) => !current)}
              size="icon"
              variant="ghost"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          ) : null}

          <div className="relative" ref={menuRef}>
            <Button
              aria-expanded={isMenuOpen}
              aria-haspopup="menu"
              aria-label={`Task options for ${task.name}`}
              className="p-0 text-ink-tertiary transition hover:text-ink-secondary"
              onClick={() => {
                setIsMenuOpen((current) => !current)
                setShowMoveMenu(false)
                setShowColorPicker(false)
              }}
              size="icon"
              variant="ghost"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>

            {isMenuOpen ? (
              <div
                aria-label={`${task.name} options`}
                className="absolute right-0 z-20 mt-1 w-52 rounded-lg border border-surface-border bg-surface-overlay p-1 shadow-xl"
                role="menu"
              >
                <Button
                  className="w-full justify-start px-3 py-2 text-left text-sm text-ink-secondary transition hover:bg-surface-raised hover:text-ink-primary"
                  onClick={() => {
                    setIsEditing(true)
                    setDraftName(task.name)
                    closeMenu()
                  }}
                  size="sm"
                  variant="ghost"
                >
                  Edit name
                </Button>

                <Button
                  className="w-full justify-start px-3 py-2 text-left text-sm text-ink-secondary transition hover:bg-surface-raised hover:text-ink-primary"
                  disabled={getStepMovePosition(tasksInGroup, task.id, -1) === null}
                  onClick={() => {
                    void moveTaskByStep(-1)
                    closeMenu()
                  }}
                  size="sm"
                  variant="ghost"
                >
                  Move up
                </Button>

                <Button
                  className="w-full justify-start px-3 py-2 text-left text-sm text-ink-secondary transition hover:bg-surface-raised hover:text-ink-primary"
                  disabled={getStepMovePosition(tasksInGroup, task.id, 1) === null}
                  onClick={() => {
                    void moveTaskByStep(1)
                    closeMenu()
                  }}
                  size="sm"
                  variant="ghost"
                >
                  Move down
                </Button>

                <Button
                  className="w-full justify-start px-3 py-2 text-left text-sm text-ink-secondary transition hover:bg-surface-raised hover:text-ink-primary"
                  onClick={() => {
                    setShowMoveMenu((current) => !current)
                    setShowColorPicker(false)
                  }}
                  size="sm"
                  variant="ghost"
                >
                  Move to category
                </Button>

                {showMoveMenu ? (
                  <div className="mt-1 space-y-1 border-t border-surface-border pt-1">
                    <Button
                      className="w-full justify-start px-3 py-2 text-left text-sm text-ink-secondary transition hover:bg-surface-raised hover:text-ink-primary"
                      onClick={() => {
                        void onMoveTask({ id: task.id, categoryId: null })
                        closeMenu()
                      }}
                      size="sm"
                      variant="ghost"
                    >
                      Remove from category
                    </Button>

                    {categories.map((category) => (
                      <Button
                        className="flex w-full items-center justify-start gap-2 px-3 py-2 text-left text-sm text-ink-secondary transition hover:bg-surface-raised hover:text-ink-primary"
                        key={category.id}
                        onClick={() => {
                          void onMoveTask({ id: task.id, categoryId: category.id })
                          closeMenu()
                        }}
                        size="sm"
                        variant="ghost"
                      >
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                        {category.name}
                      </Button>
                    ))}
                  </div>
                ) : null}

                {task.category_id === null ? (
                  <Button
                    className="w-full justify-start px-3 py-2 text-left text-sm text-ink-secondary transition hover:bg-surface-raised hover:text-ink-primary"
                    onClick={() => {
                      setShowColorPicker((current) => !current)
                      setShowMoveMenu(false)
                    }}
                    size="sm"
                    variant="ghost"
                  >
                    Change color
                  </Button>
                ) : null}

                <Button
                  className="flex w-full items-center justify-start gap-2 px-3 py-2 text-left text-sm text-red-300 transition hover:bg-surface-raised"
                  onClick={() => {
                    const confirmed = window.confirm(
                      `Delete ${task.name} permanently? Its session history will be preserved.`
                    )
                    if (!confirmed) return

                    closeMenu()
                    setIsDeleting(true)
                    window.setTimeout(() => {
                      void Promise.resolve(onDeleteTask(task.id)).catch(() => {
                        setIsDeleting(false)
                      })
                    }, 300)
                  }}
                  size="sm"
                  variant="ghost"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        {showColorPicker && task.category_id === null ? (
          <div className="border-t border-surface-border px-10 py-3">
            <ColorPicker
              onChange={(color) => {
                void onUpdateTask({ id: task.id, color })
                closeMenu()
              }}
              value={task.color ?? DEFAULT_TASK_COLOR}
            />
          </div>
        ) : null}

        {isExpanded ? (
          <div className="border-t border-surface-border px-3 py-3">
            <SubtaskList accentColor={accentColor} taskId={task.id} />
          </div>
        ) : null}
      </div>

      {dropPlacement === 'after' ? (
        <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-ink-primary" />
      ) : null}

      {reorderError ? (
        <p className="mt-2 text-xs text-red-300" role="alert">
          {reorderError}
        </p>
      ) : null}
    </div>
  )
}
