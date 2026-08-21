import { useEffect, useId, useMemo, useRef, useState } from 'react'
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
  shortcutsEnabled?: boolean
  shortcutsBlocked?: boolean
}

interface GroupedTasks {
  key: string
  label: string
  tasks: TaskWithCategory[]
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  const tagName = target.tagName.toLowerCase()
  return (
    target.isContentEditable ||
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select'
  )
}

export function TaskSelector({
  tasks,
  selectedTaskId,
  onSelectTask,
  onQuickAddTask,
  disabled = false,
  isLoading = false,
  shortcutsEnabled = true,
  shortcutsBlocked = false,
}: TaskSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [quickAddValue, setQuickAddValue] = useState('')
  const [isQuickAdding, setIsQuickAdding] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()

  const selectedTask = tasks.find((task) => task.id === selectedTaskId)

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

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  useEffect(() => {
    if (!shortcutsEnabled) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isTypingTarget(event.target)) return
      if (event.key.toLowerCase() !== 't') return
      if (disabled || shortcutsBlocked) return

      event.preventDefault()
      setIsOpen(true)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [disabled, shortcutsBlocked, shortcutsEnabled])

  const submitQuickAdd = async () => {
    if (!onQuickAddTask) return

    const trimmed = quickAddValue.trim()
    if (!trimmed || isQuickAdding) return

    setIsQuickAdding(true)
    try {
      const taskId = await Promise.resolve(onQuickAddTask(trimmed))
      if (taskId) {
        onSelectTask(taskId)
        setIsOpen(false)
      }
      setQuickAddValue('')
    } finally {
      setIsQuickAdding(false)
    }
  }

  const selectAndClose = (taskId: string | null) => {
    onSelectTask(taskId)
    setIsOpen(false)
  }

  return (
    <div className="relative w-full" ref={containerRef}>
      <Button
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="h-11 w-full justify-between px-3 text-base"
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setIsOpen(true)
          }
        }}
        role="combobox"
        variant="outlined"
      >
        {isLoading ? (
          <span className="flex items-center gap-2 text-ink-secondary">
            <Spinner />
            Loading tasks...
          </span>
        ) : (
          <span className="truncate">{selectedTask?.name ?? 'Select a task'}</span>
        )}
        <ChevronDown className="h-4 w-4 text-ink-tertiary" />
      </Button>

      {isOpen && !disabled ? (
        <div className="absolute z-20 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-surface-border-subtle bg-surface-panel p-1 shadow-xl">
          {onQuickAddTask ? (
            <div className="mb-2 flex items-center gap-2 border-b border-surface-border px-2 pb-2">
              <Input
                className="h-8"
                onChange={(event) => setQuickAddValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  void submitQuickAdd()
                }}
                placeholder="Quick add task"
                value={quickAddValue}
              />

              <Button
                disabled={isQuickAdding || quickAddValue.trim().length === 0}
                onClick={() => {
                  void submitQuickAdd()
                }}
                size="sm"
                variant="filled"
              >
                {isQuickAdding ? 'Adding...' : 'Add'}
              </Button>
            </div>
          ) : null}

          <div aria-label="Choose a task" id={listboxId} role="listbox">
            <Button
              aria-selected={selectedTaskId === null}
              className={`flex w-full items-center justify-start gap-2 rounded-md px-3 py-2 text-left text-sm transition ${
                selectedTaskId === null
                  ? 'bg-surface-hover text-ink-primary'
                  : 'text-ink-secondary hover:bg-surface-hover hover:text-ink-primary'
              }`}
              onClick={() => selectAndClose(null)}
              role="option"
              size="sm"
              variant="ghost"
            >
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-ink-tertiary" />
              No task
            </Button>

            {groupedTasks.map((group) => (
              <div aria-label={group.label} className="mt-1" key={group.key} role="group">
                <p className="px-3 py-1 text-[11px] uppercase tracking-[0.08em] text-ink-tertiary">
                  {group.label}
                </p>

                {group.tasks.map((task) => {
                  const dotColor = task.categories?.color ?? task.color ?? DEFAULT_TASK_COLOR

                  return (
                    <Button
                      aria-selected={selectedTaskId === task.id}
                      className={`flex w-full items-center justify-start gap-2 rounded-md px-3 py-2 text-left text-sm transition ${
                        selectedTaskId === task.id
                          ? 'bg-surface-hover text-ink-primary'
                          : 'text-ink-secondary hover:bg-surface-hover hover:text-ink-primary'
                      }`}
                      key={task.id}
                      onClick={() => selectAndClose(task.id)}
                      role="option"
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
        </div>
      ) : null}
    </div>
  )
}
