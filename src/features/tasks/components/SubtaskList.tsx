import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronUp, GripVertical, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AddTaskForm } from '@/features/tasks/components/AddTaskForm'
import { useSubtasks } from '@/features/tasks/hooks/useSubtasks'
import {
  getVerticalDropPlacement,
  resolveDraggedId,
  SUBTASK_DRAG_MIME,
} from '@/features/tasks/lib/dragReorder'
import {
  getDropInsertPosition,
  getStepMovePosition,
  setDragData,
  type DropPlacement,
} from '@/lib/ordering'
import { getErrorMessage } from '@/lib/errorMessages'

interface SubtaskListProps {
  taskId: string
  accentColor: string
}

export function SubtaskList({ taskId, accentColor }: SubtaskListProps) {
  const { subtasks, isLoading, addSubtask, updateSubtask, deleteSubtask, reorderSubtask } =
    useSubtasks(taskId)

  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [completingSubtaskId, setCompletingSubtaskId] = useState<string | null>(null)
  const [draggedSubtaskId, setDraggedSubtaskId] = useState<string | null>(null)
  const [reorderError, setReorderError] = useState<string | null>(null)

  const [dropTarget, setDropTarget] = useState<{ id: string; placement: DropPlacement } | null>(
    null
  )

  const inputRef = useRef<HTMLInputElement>(null)
  const dragIntentSubtaskIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (editingSubtaskId) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editingSubtaskId])

  const clearDragState = () => {
    dragIntentSubtaskIdRef.current = null
    setDraggedSubtaskId(null)
    setDropTarget(null)
  }

  const setSubtaskReorderError = (error: unknown) => {
    setReorderError(getErrorMessage(error, 'Unable to reorder subtask right now.'))
  }

  const handleSaveEdit = async (subtaskId: string) => {
    const trimmed = draftName.trim()
    const original = subtasks.find((subtask) => subtask.id === subtaskId)

    if (!original) {
      setEditingSubtaskId(null)
      setDraftName('')
      return
    }

    if (!trimmed || trimmed === original.name) {
      setEditingSubtaskId(null)
      setDraftName('')
      return
    }

    await updateSubtask.mutateAsync({ id: subtaskId, name: trimmed })
    setEditingSubtaskId(null)
    setDraftName('')
  }

  const handleDrop = async (
    draggedSubtaskId: string,
    targetSubtaskId: string,
    placement: DropPlacement
  ) => {
    if (!draggedSubtaskId || draggedSubtaskId === targetSubtaskId) {
      clearDragState()
      return
    }

    const newPosition = getDropInsertPosition(
      subtasks,
      draggedSubtaskId,
      targetSubtaskId,
      placement
    )
    if (newPosition === null) {
      clearDragState()
      return
    }

    try {
      await reorderSubtask.mutateAsync({ id: draggedSubtaskId, newPosition })
      setReorderError(null)
      clearDragState()
    } catch (error) {
      setSubtaskReorderError(error)
      clearDragState()
    }
  }

  const moveSubtaskByStep = async (subtaskId: string, direction: -1 | 1) => {
    const newPosition = getStepMovePosition(subtasks, subtaskId, direction)
    if (newPosition === null) return

    try {
      await reorderSubtask.mutateAsync({ id: subtaskId, newPosition })
      setReorderError(null)
    } catch (error) {
      setSubtaskReorderError(error)
    }
  }

  return (
    <div className="space-y-2 p-1">
      {isLoading && subtasks.length === 0 ? (
        <p className="text-sm text-ink-tertiary">Loading subtasks...</p>
      ) : null}

      {subtasks.map((subtask) => {
        const isEditing = editingSubtaskId === subtask.id
        const isCompleting = completingSubtaskId === subtask.id

        return (
          <div className="relative" key={subtask.id}>
            {dropTarget?.id === subtask.id && dropTarget.placement === 'before' ? (
              <span className="absolute -top-1 left-0 right-0 h-0.5 bg-ink-primary" />
            ) : null}

            <div
              className={`border-b border-surface-border-subtle transition-all duration-300 transform-gpu ${
                isCompleting
                  ? 'max-h-0 -translate-x-2 overflow-hidden opacity-0'
                  : 'max-h-20 translate-x-0 opacity-100'
              }`}
              draggable
              onDragEnd={clearDragState}
              onDragOver={(event) => {
                event.preventDefault()

                const activeDraggedId = resolveDraggedId(event, SUBTASK_DRAG_MIME, draggedSubtaskId)
                if (!activeDraggedId || activeDraggedId === subtask.id) return
                if (!subtasks.some((item) => item.id === activeDraggedId)) return

                const placement = getVerticalDropPlacement(event)
                setDropTarget({ id: subtask.id, placement })
              }}
              onDragStart={(event) => {
                if (dragIntentSubtaskIdRef.current !== subtask.id) {
                  event.preventDefault()
                  return
                }

                setDraggedSubtaskId(subtask.id)
                setDragData(event.dataTransfer, SUBTASK_DRAG_MIME, subtask.id)
              }}
              onDrop={(event) => {
                event.preventDefault()
                const draggedId = resolveDraggedId(event, SUBTASK_DRAG_MIME, draggedSubtaskId)
                if (!draggedId) return

                const fallbackPlacement: DropPlacement = getVerticalDropPlacement(event)
                const placement =
                  dropTarget?.id === subtask.id ? dropTarget.placement : fallbackPlacement

                void handleDrop(draggedId, subtask.id, placement)
              }}
            >
              <div
                className="flex items-center gap-2 border-l-2 px-2 py-2"
                style={{ borderLeftColor: accentColor }}
              >
                <Button
                  aria-label={`Reorder subtask ${subtask.name}`}
                  className="cursor-grab p-0 text-ink-tertiary transition hover:text-ink-secondary"
                  onPointerCancel={() => {
                    dragIntentSubtaskIdRef.current = null
                  }}
                  onPointerDown={() => {
                    dragIntentSubtaskIdRef.current = subtask.id
                  }}
                  onPointerUp={() => {
                    dragIntentSubtaskIdRef.current = null
                  }}
                  size="icon"
                  variant="ghost"
                >
                  <GripVertical className="h-4 w-4" />
                </Button>

                <Button
                  aria-label={`Move ${subtask.name} up`}
                  className="p-0 text-ink-tertiary transition hover:text-ink-secondary"
                  disabled={getStepMovePosition(subtasks, subtask.id, -1) === null}
                  onClick={() => {
                    void moveSubtaskByStep(subtask.id, -1)
                  }}
                  size="icon"
                  variant="ghost"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </Button>

                <Button
                  aria-label={`Move ${subtask.name} down`}
                  className="p-0 text-ink-tertiary transition hover:text-ink-secondary"
                  disabled={getStepMovePosition(subtasks, subtask.id, 1) === null}
                  onClick={() => {
                    void moveSubtaskByStep(subtask.id, 1)
                  }}
                  size="icon"
                  variant="ghost"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>

                <Button
                  aria-label={`Complete ${subtask.name}`}
                  className="h-5 w-5 rounded-full p-0 text-ink-tertiary transition hover:text-ink-primary"
                  onClick={() => {
                    setCompletingSubtaskId(subtask.id)
                    window.setTimeout(() => {
                      void updateSubtask.mutateAsync({
                        id: subtask.id,
                        completedAt: new Date().toISOString(),
                      })
                    }, 300)
                  }}
                  size="icon"
                  variant="outlined"
                >
                  <Check className="h-3 w-3" />
                </Button>

                {isEditing ? (
                  <Input
                    className="w-full px-2 py-1 text-sm"
                    onBlur={() => {
                      void handleSaveEdit(subtask.id)
                    }}
                    onChange={(event) => setDraftName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        void handleSaveEdit(subtask.id)
                      }

                      if (event.key === 'Escape') {
                        event.preventDefault()
                        setEditingSubtaskId(null)
                        setDraftName('')
                      }
                    }}
                    ref={inputRef}
                    value={draftName}
                  />
                ) : (
                  <Button
                    className="h-auto flex-1 justify-start p-0 text-left text-sm text-ink-primary"
                    onDoubleClick={() => {
                      setEditingSubtaskId(subtask.id)
                      setDraftName(subtask.name)
                    }}
                    size="sm"
                    variant="ghost"
                  >
                    {subtask.name}
                  </Button>
                )}

                <Button
                  aria-label={`Delete ${subtask.name}`}
                  className="p-0 text-ink-tertiary transition hover:text-red-300"
                  onClick={() => {
                    void deleteSubtask.mutateAsync(subtask.id)
                  }}
                  size="icon"
                  variant="ghost"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {dropTarget?.id === subtask.id && dropTarget.placement === 'after' ? (
              <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-ink-primary" />
            ) : null}
          </div>
        )
      })}

      <AddTaskForm label="Add subtask" onAdd={addSubtask.mutateAsync} />

      {reorderError ? <p className="text-xs text-red-300">{reorderError}</p> : null}
    </div>
  )
}
