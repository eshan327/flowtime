import { useState } from 'react'
import { ListTodo } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { AddTaskForm } from '@/features/tasks/components/AddTaskForm'
import { TaskItem } from '@/features/tasks/components/TaskItem'
import { DEFAULT_TASK_COLOR } from '@/features/tasks/constants'
import type { Category, TaskWithCategory } from '@/types'

interface TaskListProps {
  tasks: TaskWithCategory[]
  categories: Category[]
  archivedCategories: Category[]
  activeTab: string
  onAddTask: (payload: { name: string; categoryId: string | null }) => Promise<void> | void
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

function sortByPosition<T extends { position: number; created_at: string }>(items: T[]) {
  return [...items].sort(
    (a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at)
  )
}

function buildSections(
  tasks: TaskWithCategory[],
  categories: Category[],
  activeTab: string
): TaskSection[] {
  const sortedCategories = sortByPosition(categories)
  const sortedTasks = sortByPosition(tasks)
  const activeCategoryIds = new Set(sortedCategories.map((category) => category.id))

  if (activeTab !== 'all') {
    const activeCategory = sortedCategories.find((category) => category.id === activeTab) ?? null
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

  const sections: TaskSection[] = []

  for (const category of sortedCategories) {
    const categoryTasks = sortedTasks.filter((task) => task.category_id === category.id)
    if (categoryTasks.length === 0) continue

    sections.push({
      key: category.id,
      title: category.name,
      categoryId: category.id,
      color: category.color,
      tasks: categoryTasks,
      isArchivedCategory: false,
    })
  }

  const archivedSectionsByCategoryId = new Map<string, TaskSection>()
  for (const task of sortedTasks) {
    if (!task.category_id) continue
    if (activeCategoryIds.has(task.category_id)) continue

    const existingSection = archivedSectionsByCategoryId.get(task.category_id)
    if (existingSection) {
      existingSection.tasks.push(task)
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

  sections.push(...archivedSectionsByCategoryId.values())

  const uncategorizedTasks = sortedTasks.filter((task) => task.category_id === null)
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
  const sections = buildSections(tasks, categories, activeTab)
  const hasAnyTasks = tasks.length > 0
  const [archivedMoveTargets, setArchivedMoveTargets] = useState<Record<string, string>>({})

  return (
    <div className="space-y-5">
      {!hasAnyTasks ? (
        <EmptyState
          description="Add your first task below to start logging focused work."
          icon={<ListTodo className="h-5 w-5" />}
          title="No active tasks"
        />
      ) : null}

      {sections.map((section) => (
        <section className="space-y-3" key={section.key}>
          <header>
            <Badge color={section.color} label={section.title} />
          </header>

          <div className="space-y-2">
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
            <div className="space-y-2 rounded-lg border border-surface-border/70 bg-surface-base/40 p-3">
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
                  className="h-8 rounded-lg border border-surface-border bg-surface-overlay px-2 text-sm text-ink-primary"
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
              onAdd={async (name) => {
                await onAddTask({
                  name,
                  categoryId: section.categoryId,
                })
              }}
            />
          )}
        </section>
      ))}
    </div>
  )
}
