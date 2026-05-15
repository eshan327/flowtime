import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { DEFAULT_TASK_COLOR } from '@/features/tasks/constants'
import type { TaskWithCategory } from '@/types'

interface TaskSelectorProps {
  tasks: TaskWithCategory[]
  selectedTaskId: string | null
  onSelectTask: (taskId: string | null) => void
  onQuickAddTask?: (name: string) => Promise<string | null> | string | null
  disabled?: boolean
  isLoading?: boolean
}

interface GroupedTasks {
  key: string
  label: string
  tasks: TaskWithCategory[]
}

export function TaskSelector({
  tasks,
  selectedTaskId,
  onSelectTask,
  onQuickAddTask,
  disabled = false,
  isLoading = false,
}: TaskSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [quickAddValue, setQuickAddValue] = useState('')
  const [isQuickAdding, setIsQuickAdding] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null

  const groupedTasks = useMemo<GroupedTasks[]>(() => {
    const groups = new Map<string, GroupedTasks>()

    for (const task of tasks) {
      const key = task.category_id ?? 'uncategorized'
      const label = task.categories?.name ?? 'Uncategorized'

      if (!groups.has(key)) {
        groups.set(key, { key, label, tasks: [] })
      }

      groups.get(key)!.tasks.push(task)
    }

    return Array.from(groups.values())
  }, [tasks])

  useEffect(() => {
    if (!isOpen) return

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (!containerRef.current?.contains(target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [isOpen])

  return (
    <div className="relative w-full max-w-md" ref={containerRef}>
      <Button
        className="w-full justify-between px-3"
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        variant="outlined"
      >
        {isLoading ? (
          <span className="flex items-center gap-2 text-ink-secondary">
            <Spinner />
            Loading tasks...
          </span>
        ) : (
          <span className="truncate">{selectedTask ? selectedTask.name : 'Select a task'}</span>
        )}
        <ChevronDown className="h-4 w-4 text-ink-tertiary" />
      </Button>

      {isOpen && !disabled ? (
        <div className="absolute z-20 mt-2 max-h-80 w-full overflow-y-auto rounded-lg border border-surface-border bg-surface-overlay p-1 shadow-xl">
          {onQuickAddTask ? (
            <div className="mb-2 flex items-center gap-2 border-b border-surface-border px-2 pb-2">
              <Input
                className="h-8"
                onChange={(event) => setQuickAddValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return
                  event.preventDefault()

                  const trimmed = quickAddValue.trim()
                  if (!trimmed || isQuickAdding) return

                  setIsQuickAdding(true)
                  Promise.resolve(onQuickAddTask(trimmed))
                    .then((taskId) => {
                      if (taskId) {
                        onSelectTask(taskId)
                        setIsOpen(false)
                      }
                      setQuickAddValue('')
                    })
                    .finally(() => {
                      setIsQuickAdding(false)
                    })
                }}
                placeholder="Quick add task"
                value={quickAddValue}
              />

              <Button
                disabled={isQuickAdding || quickAddValue.trim().length === 0}
                onClick={() => {
                  const trimmed = quickAddValue.trim()
                  if (!trimmed || isQuickAdding) return

                  setIsQuickAdding(true)
                  Promise.resolve(onQuickAddTask(trimmed))
                    .then((taskId) => {
                      if (taskId) {
                        onSelectTask(taskId)
                        setIsOpen(false)
                      }
                      setQuickAddValue('')
                    })
                    .finally(() => {
                      setIsQuickAdding(false)
                    })
                }}
                size="sm"
                variant="filled"
              >
                {isQuickAdding ? 'Adding...' : 'Add'}
              </Button>
            </div>
          ) : null}

          <Button
            className={`flex w-full items-center justify-start gap-2 rounded-md px-3 py-2 text-left text-sm transition ${
              selectedTaskId === null
                ? 'bg-surface-raised text-ink-primary'
                : 'text-ink-secondary hover:bg-surface-raised hover:text-ink-primary'
            }`}
            onClick={() => {
              onSelectTask(null)
              setIsOpen(false)
            }}
            size="sm"
            variant="ghost"
          >
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-ink-tertiary" />
            No task
          </Button>

          {groupedTasks.map((group) => (
            <div className="mt-1" key={group.key}>
              <p className="px-3 py-1 text-[11px] uppercase tracking-[0.08em] text-ink-tertiary">
                {group.label}
              </p>

              {group.tasks.map((task) => {
                const dotColor = task.categories?.color ?? task.color ?? DEFAULT_TASK_COLOR

                return (
                  <Button
                    className={`flex w-full items-center justify-start gap-2 rounded-md px-3 py-2 text-left text-sm transition ${
                      selectedTaskId === task.id
                        ? 'bg-surface-raised text-ink-primary'
                        : 'text-ink-secondary hover:bg-surface-raised hover:text-ink-primary'
                    }`}
                    key={task.id}
                    onClick={() => {
                      onSelectTask(task.id)
                      setIsOpen(false)
                    }}
                    size="sm"
                    variant="ghost"
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: dotColor }}
                    />
                    <span className="truncate">{task.name}</span>
                  </Button>
                )
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
