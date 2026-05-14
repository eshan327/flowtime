import { useEffect, useRef, useState } from 'react'
import { Check, GripVertical, Trash2 } from 'lucide-react'
import { AddTaskForm } from '@/features/tasks/components/AddTaskForm'
import { useSubtasks } from '@/features/tasks/hooks/useSubtasks'
import type { Subtask } from '@/types'

type DropPlacement = 'before' | 'after'

interface SubtaskListProps {
  taskId: string
  accentColor: string
}

function getNewPosition(
  subtasks: Subtask[],
  draggedSubtaskId: string,
  targetSubtaskId: string,
  placement: DropPlacement
) {
  const ordered = [...subtasks].sort((a, b) => a.position - b.position)
  const withoutDragged = ordered.filter((subtask) => subtask.id !== draggedSubtaskId)
  const targetIndex = withoutDragged.findIndex((subtask) => subtask.id === targetSubtaskId)
  if (targetIndex === -1) return null

  const insertIndex = placement === 'before' ? targetIndex : targetIndex + 1
  const previous = withoutDragged[insertIndex - 1]
  const next = withoutDragged[insertIndex]

  if (!previous && !next) return 0
  if (!previous && next) return next.position - 1
  if (previous && !next) return previous.position + 1
  return (previous.position + next.position) / 2
}

export function SubtaskList({ taskId, accentColor }: SubtaskListProps) {
  const {
    subtasks,
    isLoading,
    addSubtask,
    renameSubtask,
    completeSubtask,
    deleteSubtask,
    reorderSubtask,
  } = useSubtasks(taskId)

  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [completingSubtaskId, setCompletingSubtaskId] = useState<string | null>(null)

  const [dragEnabledId, setDragEnabledId] = useState<string | null>(null)
  const [draggedSubtaskId, setDraggedSubtaskId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id: string; placement: DropPlacement } | null>(
    null
  )

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingSubtaskId) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editingSubtaskId])

  const clearDragState = () => {
    setDragEnabledId(null)
    setDraggedSubtaskId(null)
    setDropTarget(null)
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

    await renameSubtask.mutateAsync({ id: subtaskId, name: trimmed })
    setEditingSubtaskId(null)
    setDraftName('')
  }

  const handleDrop = async (targetSubtaskId: string, placement: DropPlacement) => {
    if (!draggedSubtaskId || draggedSubtaskId === targetSubtaskId) {
      clearDragState()
      return
    }

    const newPosition = getNewPosition(subtasks, draggedSubtaskId, targetSubtaskId, placement)
    if (newPosition === null) {
      clearDragState()
      return
    }

    await reorderSubtask.mutateAsync({ id: draggedSubtaskId, newPosition })
    clearDragState()
  }

  return (
    <div className="space-y-2 rounded-lg border border-surface-border bg-surface-base p-3">
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
              className={`rounded-md border border-surface-border transition-all duration-300 transform-gpu ${
                isCompleting
                  ? 'max-h-0 -translate-x-2 overflow-hidden opacity-0'
                  : 'max-h-20 translate-x-0 opacity-100'
              }`}
              draggable={dragEnabledId === subtask.id}
              onDragEnd={clearDragState}
              onDragOver={(event) => {
                const draggedId = event.dataTransfer.getData('application/x-flowtime-subtask-id')
                if (!draggedId || draggedId === subtask.id) return
                if (!subtasks.some((item) => item.id === draggedId)) return

                event.preventDefault()
                const rect = event.currentTarget.getBoundingClientRect()
                const placement = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
                setDropTarget({ id: subtask.id, placement })
              }}
              onDragStart={(event) => {
                if (dragEnabledId !== subtask.id) {
                  event.preventDefault()
                  return
                }

                setDraggedSubtaskId(subtask.id)
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('application/x-flowtime-subtask-id', subtask.id)
              }}
              onDrop={(event) => {
                event.preventDefault()
                if (!dropTarget || dropTarget.id !== subtask.id) return
                void handleDrop(subtask.id, dropTarget.placement)
              }}
            >
              <div
                className="flex items-center gap-2 border-l-2 px-2 py-2"
                style={{ borderLeftColor: accentColor }}
              >
                <button
                  aria-label={`Reorder subtask ${subtask.name}`}
                  className="cursor-grab rounded p-1 text-ink-tertiary transition hover:text-ink-secondary"
                  onMouseDown={() => setDragEnabledId(subtask.id)}
                  onMouseUp={() => setDragEnabledId(null)}
                  type="button"
                >
                  <GripVertical className="h-4 w-4" />
                </button>

                <button
                  aria-label={`Complete ${subtask.name}`}
                  className="flex h-5 w-5 items-center justify-center rounded-full border border-surface-border text-ink-tertiary transition hover:border-ink-secondary hover:text-ink-primary"
                  onClick={() => {
                    setCompletingSubtaskId(subtask.id)
                    window.setTimeout(() => {
                      void completeSubtask.mutateAsync(subtask.id)
                    }, 300)
                  }}
                  type="button"
                >
                  <Check className="h-3 w-3" />
                </button>

                {isEditing ? (
                  <input
                    className="w-full rounded border border-surface-border bg-surface-overlay px-2 py-1 text-sm text-ink-primary outline-none focus:border-ink-secondary"
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
                  <button
                    className="flex-1 text-left text-sm text-ink-primary"
                    onDoubleClick={() => {
                      setEditingSubtaskId(subtask.id)
                      setDraftName(subtask.name)
                    }}
                    type="button"
                  >
                    {subtask.name}
                  </button>
                )}

                <button
                  aria-label={`Delete ${subtask.name}`}
                  className="rounded p-1 text-ink-tertiary transition hover:text-red-300"
                  onClick={() => {
                    void deleteSubtask.mutateAsync(subtask.id)
                  }}
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {dropTarget?.id === subtask.id && dropTarget.placement === 'after' ? (
              <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-ink-primary" />
            ) : null}
          </div>
        )
      })}

      <AddTaskForm
        label="Add subtask"
        onAdd={async (name) => {
          await addSubtask.mutateAsync(name)
        }}
      />
    </div>
  )
}
