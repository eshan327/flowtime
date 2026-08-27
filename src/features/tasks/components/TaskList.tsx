import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, ListTodo } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { AddTaskForm } from '@/features/tasks/components/AddTaskForm'
import { TaskItem } from '@/features/tasks/components/TaskItem'
import { DEFAULT_TASK_COLOR } from '@/features/tasks/constants'
import { sortByPositionAndCreatedAt } from '@/lib/ordering'
import type { Category, TaskWithCategory } from '@/types'

interface TaskListProps {
  tasks: TaskWithCategory[]
  categories: Category[]
  activeTab: string
  onAddTask: (payload: { name: string; categoryId: string | null }) => Promise<unknown> | void
  onUpdateTask: (payload: { id: string; name?: string; color?: string }) => Promise<void> | void
  onCompleteTask: (taskId: string) => Promise<void> | void
  onDeleteTask: (taskId: string) => Promise<void> | void
  onMoveTask: (payload: { id: string; categoryId: string | null }) => Promise<void> | void
  onReorderTask: (payload: { id: string; newPosition: number }) => Promise<void> | void
}

interface TaskSection {
  key: string
  title: string
  categoryId: string | null
  color: string
  tasks: TaskWithCategory[]
}

function buildSections(
  tasks: TaskWithCategory[],
  categories: Category[],
  activeTab: string
): TaskSection[] {
  const sortedCategories = sortByPositionAndCreatedAt(categories)
  const sortedTasks = sortByPositionAndCreatedAt(tasks)
  const categoriesById = new Map(sortedCategories.map((category) => [category.id, category]))

  if (activeTab !== 'all') {
    const activeCategory = categoriesById.get(activeTab)
    const categoryId = activeCategory?.id ?? null

    return [
      {
        key: categoryId ?? 'uncategorized',
        title: activeCategory?.name ?? 'Uncategorized',
        categoryId,
        color: activeCategory?.color ?? DEFAULT_TASK_COLOR,
        tasks: sortedTasks.filter((task) => task.category_id === categoryId),
      },
    ]
  }

  const activeSectionsByCategoryId = new Map<string, TaskSection>()
  for (const category of sortedCategories) {
    activeSectionsByCategoryId.set(category.id, {
      key: category.id,
      title: category.name,
      categoryId: category.id,
      color: category.color,
      tasks: [],
    })
  }

  const uncategorizedTasks: TaskWithCategory[] = []

  for (const task of sortedTasks) {
    if (!task.category_id) {
      uncategorizedTasks.push(task)
      continue
    }

    const activeSection = activeSectionsByCategoryId.get(task.category_id)
    if (activeSection) {
      activeSection.tasks.push(task)
    }
  }

  const sections: TaskSection[] = []
  for (const category of sortedCategories) {
    const section = activeSectionsByCategoryId.get(category.id)
    if (section && section.tasks.length > 0) {
      sections.push(section)
    }
  }

  if (uncategorizedTasks.length > 0 || sections.length === 0) {
    sections.push({
      key: 'uncategorized',
      title: 'Uncategorized',
      categoryId: null,
      color: DEFAULT_TASK_COLOR,
      tasks: uncategorizedTasks,
    })
  }

  return sections
}

export function TaskList({
  tasks,
  categories,
  activeTab,
  onAddTask,
  onUpdateTask,
  onCompleteTask,
  onDeleteTask,
  onMoveTask,
  onReorderTask,
}: TaskListProps) {
  const sections = useMemo(
    () => buildSections(tasks, categories, activeTab),
    [tasks, categories, activeTab]
  )
  const hasAnyTasks = sections.some((section) => section.tasks.length > 0)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => new Set())

  if (!hasAnyTasks) {
    const emptySection = sections[0]

    return (
      <div className="space-y-5">
        <AddTaskForm
          label="Add a task…"
          onAdd={(name) => onAddTask({ name, categoryId: emptySection?.categoryId ?? null })}
          prominent
        />
        <EmptyState
          className="py-10 sm:py-14"
          icon={<ListTodo className="h-6 w-6" />}
          title="No active tasks"
        />
      </div>
    )
  }

  return (
    <div className="space-y-7">
      <AddTaskForm
        label="Add a task…"
        onAdd={(name) => onAddTask({ name, categoryId: activeTab === 'all' ? null : activeTab })}
        prominent
      />

      {sections.map((section) => (
        <section
          className="min-w-0 overflow-hidden border-t border-surface-border"
          key={section.key}
        >
          <button
            aria-expanded={!collapsedSections.has(section.key)}
            className="relative flex w-full items-center gap-3 border-b border-surface-border-subtle px-5 py-3 text-left outline-none hover:bg-surface-hover/20 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-primary"
            onClick={() =>
              setCollapsedSections((current) => {
                const next = new Set(current)
                if (next.has(section.key)) next.delete(section.key)
                else next.add(section.key)
                return next
              })
            }
            type="button"
          >
            <span
              className="absolute inset-y-0 left-0 w-[3px]"
              style={{ backgroundColor: section.color }}
            />
            {collapsedSections.has(section.key) ? (
              <ChevronRight className="h-4 w-4 text-ink-tertiary" />
            ) : (
              <ChevronDown className="h-4 w-4 text-ink-tertiary" />
            )}
            <h2
              className="text-sm font-medium uppercase tracking-[0.08em]"
              style={{ color: section.color }}
            >
              {section.title}
            </h2>
            <span className="text-sm tabular-nums text-ink-tertiary">{section.tasks.length}</span>
          </button>

          {!collapsedSections.has(section.key) ? (
            <div className="divide-y divide-surface-border-subtle">
              {section.tasks.map((task) => (
                <TaskItem
                  categories={categories}
                  key={task.id}
                  onCompleteTask={onCompleteTask}
                  onDeleteTask={onDeleteTask}
                  onMoveTask={onMoveTask}
                  onReorderTask={onReorderTask}
                  onUpdateTask={onUpdateTask}
                  task={task}
                  tasksInGroup={section.tasks}
                />
              ))}
            </div>
          ) : null}
        </section>
      ))}
    </div>
  )
}
