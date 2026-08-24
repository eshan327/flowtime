import { useMemo, useState } from 'react'
import { ListTodo } from 'lucide-react'
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
  activeTab: string
  onAddTask: (payload: { name: string; categoryId: string | null }) => Promise<unknown> | void
  onUpdateTask: (payload: { id: string; name?: string; color?: string }) => Promise<void> | void
  onCompleteTask: (taskId: string) => Promise<void> | void
  onDeleteTask: (taskId: string) => Promise<void> | void
  onMoveTask: (payload: { id: string; categoryId: string | null }) => Promise<void> | void
  onMoveArchivedTasks: (taskIds: string[], targetCategoryId: string | null) => Promise<void> | void
  onRestoreCategory: (categoryId: string) => Promise<void> | void
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
  activeTab,
  onAddTask,
  onUpdateTask,
  onCompleteTask,
  onDeleteTask,
  onMoveTask,
  onMoveArchivedTasks,
  onRestoreCategory,
  onReorderTask,
}: TaskListProps) {
  const sections = useMemo(
    () => buildSections(tasks, categories, activeTab),
    [tasks, categories, activeTab]
  )
  const hasAnyTasks = tasks.length > 0
  const [archivedMoveTargets, setArchivedMoveTargets] = useState<Record<string, string>>({})

  if (!hasAnyTasks) {
    const emptySection = sections[0]

    return (
      <EmptyState
        action={
          <div className="mx-auto w-full max-w-xl">
            <AddTaskForm
              label="Add task"
              onAdd={(name) => onAddTask({ name, categoryId: emptySection?.categoryId ?? null })}
            />
          </div>
        }
        className="py-10 sm:py-14"
        icon={<ListTodo className="h-6 w-6" />}
        title="No active tasks"
      />
    )
  }

  return (
    <div
      className={
        activeTab === 'all' && sections.length > 1
          ? 'grid items-start gap-x-10 gap-y-10 lg:grid-cols-2'
          : 'space-y-10'
      }
    >
      {sections.map((section) => (
        <section className="min-w-0 space-y-3" key={section.key}>
          <header className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: section.color }} />
            <h2 className="text-lg font-medium text-ink-primary">{section.title}</h2>
            <span className="text-sm tabular-nums text-ink-tertiary">{section.tasks.length}</span>
          </header>

          <div className="space-y-1">
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

          {section.isArchivedCategory ? (
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
          ) : (
            <AddTaskForm
              label="Add task"
              onAdd={(name) =>
                onAddTask({
                  name,
                  categoryId: section.categoryId,
                })
              }
            />
          )}
        </section>
      ))}
    </div>
  )
}
