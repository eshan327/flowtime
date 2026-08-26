import { useMemo, useState } from 'react'
import { Archive, ChevronDown, ChevronRight, ListTodo } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { AddTaskForm } from '@/features/tasks/components/AddTaskForm'
import { TaskItem } from '@/features/tasks/components/TaskItem'
import { DEFAULT_TASK_COLOR } from '@/features/tasks/constants'
import { sortByPositionAndCreatedAt } from '@/lib/ordering'
import type { Category, TaskWithCategory } from '@/types'

interface TaskListProps {
  tasks: TaskWithCategory[]
  categories: Category[]
  archivedCategories: Category[]
  completedTasks: TaskWithCategory[]
  activeTab: string
  onAddTask: (payload: { name: string; categoryId: string | null }) => Promise<unknown> | void
  onUpdateTask: (payload: { id: string; name?: string; color?: string }) => Promise<void> | void
  onCompleteTask: (taskId: string) => Promise<void> | void
  onDeleteTask: (taskId: string) => Promise<void> | void
  onMoveTask: (payload: { id: string; categoryId: string | null }) => Promise<void> | void
  onMoveArchivedTasks: (taskIds: string[], targetCategoryId: string | null) => Promise<void> | void
  onRestoreCategory: (categoryId: string) => Promise<void> | void
  onRestoreTask: (taskId: string) => Promise<void> | void
  onReorderTask: (payload: { id: string; newPosition: number }) => Promise<void> | void
}

interface TaskSection {
  key: string
  title: string
  categoryId: string | null
  color: string
  tasks: TaskWithCategory[]
  isArchivedCategory?: boolean
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
        isArchivedCategory: false,
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
      isArchivedCategory: false,
    })
  }

  const archivedSectionsByCategoryId = new Map<string, TaskSection>()
  const uncategorizedTasks: TaskWithCategory[] = []

  for (const task of sortedTasks) {
    if (!task.category_id) {
      uncategorizedTasks.push(task)
      continue
    }

    const activeSection = activeSectionsByCategoryId.get(task.category_id)
    if (activeSection) {
      activeSection.tasks.push(task)
      continue
    }

    const existingArchivedSection = archivedSectionsByCategoryId.get(task.category_id)
    if (existingArchivedSection) {
      existingArchivedSection.tasks.push(task)
      continue
    }

    archivedSectionsByCategoryId.set(task.category_id, {
      key: `archived-${task.category_id}`,
      title: `${task.categories?.name ?? 'Retired category'} (archived)`,
      categoryId: task.category_id,
      color: task.categories?.color ?? task.color ?? DEFAULT_TASK_COLOR,
      tasks: [task],
      isArchivedCategory: true,
    })
  }

  const sections: TaskSection[] = []
  for (const category of sortedCategories) {
    const section = activeSectionsByCategoryId.get(category.id)
    if (section && section.tasks.length > 0) {
      sections.push(section)
    }
  }

  sections.push(...archivedSectionsByCategoryId.values())

  if (uncategorizedTasks.length > 0 || sections.length === 0) {
    sections.push({
      key: 'uncategorized',
      title: 'Uncategorized',
      categoryId: null,
      color: DEFAULT_TASK_COLOR,
      tasks: uncategorizedTasks,
      isArchivedCategory: false,
    })
  }

  return sections
}

export function TaskList({
  tasks,
  categories,
  archivedCategories,
  completedTasks,
  activeTab,
  onAddTask,
  onUpdateTask,
  onCompleteTask,
  onDeleteTask,
  onMoveTask,
  onMoveArchivedTasks,
  onRestoreCategory,
  onRestoreTask,
  onReorderTask,
}: TaskListProps) {
  const sections = useMemo(
    () => buildSections(tasks, categories, activeTab),
    [tasks, categories, activeTab]
  )
  const hasAnyTasks = tasks.length > 0
  const [archivedMoveTargets, setArchivedMoveTargets] = useState<Record<string, string>>({})
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => new Set())
  const [isArchiveOpen, setIsArchiveOpen] = useState(false)

  if (!hasAnyTasks && archivedCategories.length === 0 && completedTasks.length === 0) {
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
    <div className="space-y-5">
      <AddTaskForm
        label="Add a task…"
        onAdd={(name) => onAddTask({ name, categoryId: activeTab === 'all' ? null : activeTab })}
        prominent
      />

      {sections.map((section) => (
        <section
          className="min-w-0 overflow-hidden rounded-sm border border-surface-border bg-surface-sidebar/25"
          key={section.key}
        >
          <button
            aria-expanded={!collapsedSections.has(section.key)}
            className="relative flex w-full items-center gap-3 border-b border-surface-border-subtle px-5 py-4 text-left outline-none hover:bg-surface-hover/25 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-primary"
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
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: section.color }} />
            <h2 className="text-lg font-medium text-ink-primary">{section.title}</h2>
            <span className="text-sm tabular-nums text-ink-tertiary">{section.tasks.length}</span>
          </button>

          {!collapsedSections.has(section.key) ? (
            <div className="divide-y divide-surface-border-subtle px-3">
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

          {!collapsedSections.has(section.key) && section.isArchivedCategory ? (
            <div className="space-y-2 rounded-lg bg-surface-panel p-3">
              <p className="text-xs text-ink-tertiary">
                This category is archived. Restore it or move its active tasks elsewhere.
              </p>

              <div className="flex flex-wrap items-center gap-2">
                {section.categoryId &&
                archivedCategories.some((category) => category.id === section.categoryId) ? (
                  <Button
                    onClick={() => {
                      if (!section.categoryId) return
                      void onRestoreCategory(section.categoryId)
                    }}
                    size="sm"
                    variant="ghost"
                  >
                    Restore category
                  </Button>
                ) : null}

                <select
                  className="h-8 rounded-lg border border-surface-border-subtle bg-surface-sidebar px-2 text-sm text-ink-primary"
                  onChange={(event) => {
                    setArchivedMoveTargets((current) => ({
                      ...current,
                      [section.key]: event.target.value,
                    }))
                  }}
                  value={archivedMoveTargets[section.key] ?? '__uncategorized__'}
                >
                  <option value="__uncategorized__">Move all to uncategorized</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      Move all to {category.name}
                    </option>
                  ))}
                </select>

                <Button
                  onClick={() => {
                    const target = archivedMoveTargets[section.key] ?? '__uncategorized__'
                    const targetCategoryId = target === '__uncategorized__' ? null : target
                    void onMoveArchivedTasks(
                      section.tasks.map((task) => task.id),
                      targetCategoryId
                    )
                  }}
                  size="sm"
                  variant="outlined"
                >
                  Move all tasks
                </Button>
              </div>
            </div>
          ) : null}
        </section>
      ))}

      {archivedCategories.length > 0 || completedTasks.length > 0 ? (
        <section className="overflow-hidden rounded-sm border border-surface-border bg-surface-sidebar/25">
          <button
            aria-expanded={isArchiveOpen}
            className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-surface-hover/25"
            onClick={() => setIsArchiveOpen((current) => !current)}
            type="button"
          >
            {isArchiveOpen ? (
              <ChevronDown className="h-4 w-4 text-ink-tertiary" />
            ) : (
              <ChevronRight className="h-4 w-4 text-ink-tertiary" />
            )}
            <Archive className="h-5 w-5 text-ink-tertiary" />
            <span className="font-medium text-ink-primary">Archive</span>
            <span className="text-sm text-ink-tertiary">
              {archivedCategories.length}{' '}
              {archivedCategories.length === 1 ? 'category' : 'categories'} ·{' '}
              {completedTasks.length} completed {completedTasks.length === 1 ? 'task' : 'tasks'}
            </span>
          </button>

          {isArchiveOpen ? (
            <div className="grid gap-5 border-t border-surface-border-subtle p-5 md:grid-cols-2">
              <div>
                <h3 className="text-xs font-medium uppercase tracking-[0.08em] text-ink-tertiary">
                  Archived categories
                </h3>
                <div className="mt-2 space-y-1">
                  {archivedCategories.map((category) => (
                    <Button
                      className="w-full justify-start"
                      key={category.id}
                      onClick={() => void onRestoreCategory(category.id)}
                      size="sm"
                      variant="ghost"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      Restore {category.name}
                    </Button>
                  ))}
                  {archivedCategories.length === 0 ? (
                    <p className="py-2 text-sm text-ink-tertiary">No archived categories.</p>
                  ) : null}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-medium uppercase tracking-[0.08em] text-ink-tertiary">
                  Completed tasks
                </h3>
                <div className="mt-2 space-y-1">
                  {completedTasks.map((task) => (
                    <Button
                      className="w-full justify-start"
                      key={task.id}
                      onClick={() => void onRestoreTask(task.id)}
                      size="sm"
                      variant="ghost"
                    >
                      Restore {task.name}
                    </Button>
                  ))}
                  {completedTasks.length === 0 ? (
                    <p className="py-2 text-sm text-ink-tertiary">No completed tasks.</p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
