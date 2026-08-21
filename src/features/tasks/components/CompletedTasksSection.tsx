import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { TaskWithCategory } from '@/types'

interface CompletedTasksSectionProps {
  tasks: TaskWithCategory[]
  isExpanded: boolean
  onToggle: () => void
  onRestoreTask: (taskId: string) => Promise<void> | void
  onDeleteTask: (taskId: string) => Promise<void> | void
}

export function CompletedTasksSection({
  tasks,
  isExpanded,
  onToggle,
  onRestoreTask,
  onDeleteTask,
}: CompletedTasksSectionProps) {
  return (
    <section className="rounded-xl bg-surface-panel p-4">
      <Button
        aria-expanded={isExpanded}
        className="h-auto w-full justify-between px-1 text-sm"
        onClick={onToggle}
        size="sm"
        variant="ghost"
      >
        <span>Completed tasks ({tasks.length})</span>
        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </Button>

      <div
        aria-hidden={!isExpanded}
        className={`grid transition-[grid-template-rows,opacity,visibility] duration-200 ease-out motion-reduce:transition-none ${
          isExpanded ? 'visible grid-rows-[1fr] opacity-100' : 'invisible grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          {tasks.length === 0 ? (
            <p className="mt-2 text-sm text-ink-tertiary">No completed tasks.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {tasks.map((task) => (
                <div
                  className="flex items-center justify-between gap-2 border-b border-surface-border-subtle px-1 py-3"
                  key={task.id}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink-primary">{task.name}</p>
                    <p className="text-xs text-ink-tertiary">
                      {task.categories?.name ?? 'Uncategorized'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={async () => {
                        await onRestoreTask(task.id)
                      }}
                      size="sm"
                      variant="ghost"
                    >
                      Restore
                    </Button>

                    <Button
                      className="text-red-300 hover:text-red-200"
                      onClick={async () => {
                        const confirmed = window.confirm(
                          `Delete ${task.name} permanently? Its session history will be preserved.`
                        )
                        if (!confirmed) return

                        await onDeleteTask(task.id)
                      }}
                      size="sm"
                      variant="ghost"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
