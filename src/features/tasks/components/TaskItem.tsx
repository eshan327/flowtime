import { useEffect, useRef, useState } from 'react'
import {
  Check,
  ChevronDown,
  ChevronRight,
  GripVertical,
  MoreHorizontal,
  Trash2,
} from 'lucide-react'
import { DEFAULT_TASK_COLOR } from '@/features/tasks/constants'
import { ColorPicker } from '@/features/tasks/components/ColorPicker'
import { SubtaskList } from '@/features/tasks/components/SubtaskList'
import { useSubtasks } from '@/features/tasks/hooks/useSubtasks'
import type { Category, TaskWithCategory } from '@/types'

type DropPlacement = 'before' | 'after'

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

function getNewPosition(
  tasks: TaskWithCategory[],
  draggedTaskId: string,
  targetTaskId: string,
  placement: DropPlacement
) {
  const ordered = [...tasks].sort((a, b) => a.position - b.position)
  const withoutDragged = ordered.filter((task) => task.id !== draggedTaskId)
  const targetIndex = withoutDragged.findIndex((task) => task.id === targetTaskId)
  if (targetIndex === -1) return null

  const insertIndex = placement === 'before' ? targetIndex : targetIndex + 1
  const previous = withoutDragged[insertIndex - 1]
  const next = withoutDragged[insertIndex]

  if (!previous && !next) return 0
  if (!previous && next) return next.position - 1
  if (previous && !next) return previous.position + 1
  return (previous.position + next.position) / 2
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
  const { subtasks } = useSubtasks(task.id)

  const [isExpanded, setIsExpanded] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [draftName, setDraftName] = useState(task.name)
  const [isCompleting, setIsCompleting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [showMoveMenu, setShowMoveMenu] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)

  const [dragEnabled, setDragEnabled] = useState(false)
  const [dropPlacement, setDropPlacement] = useState<DropPlacement | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

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

    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
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

    const newPosition = getNewPosition(tasksInGroup, draggedTaskId, task.id, placement)
    if (newPosition === null) {
      setDropPlacement(null)
      return
    }

    await onReorderTask({ id: draggedTaskId, newPosition })
    setDropPlacement(null)
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
        draggable={dragEnabled}
        onDragEnd={() => {
          setDragEnabled(false)
          setDropPlacement(null)
        }}
        onDragOver={(event) => {
          const draggedId = event.dataTransfer.getData('application/x-flowtime-task-id')
          if (!draggedId || draggedId === task.id) return
          if (!tasksInGroup.some((item) => item.id === draggedId)) return

          event.preventDefault()
          const rect = event.currentTarget.getBoundingClientRect()
          const placement = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
          setDropPlacement(placement)
        }}
        onDragStart={(event) => {
          if (!dragEnabled) {
            event.preventDefault()
            return
          }

          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('application/x-flowtime-task-id', task.id)
        }}
        onDrop={(event) => {
          event.preventDefault()
          const draggedId = event.dataTransfer.getData('application/x-flowtime-task-id')
          if (!draggedId || !dropPlacement) return
          void handleDrop(draggedId, dropPlacement)
        }}
      >
        <div
          className="flex items-center gap-2 border-l-2 px-2 py-2"
          style={{ borderLeftColor: accentColor }}
        >
          <button
            aria-label={`Reorder ${task.name}`}
            className="cursor-grab rounded p-1 text-ink-tertiary transition hover:text-ink-secondary"
            onMouseDown={() => setDragEnabled(true)}
            onMouseUp={() => setDragEnabled(false)}
            type="button"
          >
            <GripVertical className="h-4 w-4" />
          </button>

          <button
            aria-label={`Complete ${task.name}`}
            className="flex h-5 w-5 items-center justify-center rounded-full border border-surface-border text-ink-tertiary transition hover:border-ink-secondary hover:text-ink-primary"
            onClick={() => {
              setIsCompleting(true)
              window.setTimeout(() => {
                void Promise.resolve(onCompleteTask(task.id)).catch(() => {
                  setIsCompleting(false)
                })
              }, 300)
            }}
            type="button"
          >
            <Check className="h-3 w-3" />
          </button>

          <div className="min-w-0 flex-1">
            {isEditing ? (
              <input
                className="w-full rounded border border-surface-border bg-surface-overlay px-2 py-1 text-sm text-ink-primary outline-none focus:border-ink-secondary"
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
              <button
                className="w-full truncate text-left text-sm text-ink-primary"
                onDoubleClick={() => {
                  setIsEditing(true)
                  setDraftName(task.name)
                }}
                type="button"
              >
                {task.name}
              </button>
            )}

            {subtasks.length > 0 ? (
              <p className="mt-0.5 text-xs text-ink-tertiary">{subtasks.length} subtasks</p>
            ) : null}
          </div>

          {showSubtaskToggle ? (
            <button
              aria-label={isExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
              className="rounded p-1 text-ink-tertiary transition hover:text-ink-secondary"
              onClick={() => setIsExpanded((current) => !current)}
              type="button"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : null}

          <div className="relative" ref={menuRef}>
            <button
              aria-label={`Task options for ${task.name}`}
              className="rounded p-1 text-ink-tertiary transition hover:text-ink-secondary"
              onClick={() => {
                setIsMenuOpen((current) => !current)
                setShowMoveMenu(false)
                setShowColorPicker(false)
              }}
              type="button"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {isMenuOpen ? (
              <div className="absolute right-0 z-20 mt-1 w-52 rounded-lg border border-surface-border bg-surface-overlay p-1 shadow-xl">
                <button
                  className="w-full rounded-md px-3 py-2 text-left text-sm text-ink-secondary transition hover:bg-surface-raised hover:text-ink-primary"
                  onClick={() => {
                    setIsEditing(true)
                    setDraftName(task.name)
                    closeMenu()
                  }}
                  type="button"
                >
                  Edit name
                </button>

                <button
                  className="w-full rounded-md px-3 py-2 text-left text-sm text-ink-secondary transition hover:bg-surface-raised hover:text-ink-primary"
                  onClick={() => {
                    setShowMoveMenu((current) => !current)
                    setShowColorPicker(false)
                  }}
                  type="button"
                >
                  Move to category
                </button>

                {showMoveMenu ? (
                  <div className="mt-1 space-y-1 border-t border-surface-border pt-1">
                    <button
                      className="w-full rounded-md px-3 py-2 text-left text-sm text-ink-secondary transition hover:bg-surface-raised hover:text-ink-primary"
                      onClick={() => {
                        void onMoveTask({ id: task.id, categoryId: null })
                        closeMenu()
                      }}
                      type="button"
                    >
                      Remove from category
                    </button>

                    {categories.map((category) => (
                      <button
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-ink-secondary transition hover:bg-surface-raised hover:text-ink-primary"
                        key={category.id}
                        onClick={() => {
                          void onMoveTask({ id: task.id, categoryId: category.id })
                          closeMenu()
                        }}
                        type="button"
                      >
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                        {category.name}
                      </button>
                    ))}
                  </div>
                ) : null}

                {task.category_id === null ? (
                  <button
                    className="w-full rounded-md px-3 py-2 text-left text-sm text-ink-secondary transition hover:bg-surface-raised hover:text-ink-primary"
                    onClick={() => {
                      setShowColorPicker((current) => !current)
                      setShowMoveMenu(false)
                    }}
                    type="button"
                  >
                    Change color
                  </button>
                ) : null}

                <button
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-red-300 transition hover:bg-surface-raised"
                  onClick={() => {
                    closeMenu()
                    setIsDeleting(true)
                    window.setTimeout(() => {
                      void Promise.resolve(onDeleteTask(task.id)).catch(() => {
                        setIsDeleting(false)
                      })
                    }, 300)
                  }}
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
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
    </div>
  )
}
