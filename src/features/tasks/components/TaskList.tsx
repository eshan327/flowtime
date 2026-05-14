import { ListTodo } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { AddTaskForm } from '@/features/tasks/components/AddTaskForm'
import { TaskItem } from '@/features/tasks/components/TaskItem'
import { DEFAULT_TASK_COLOR } from '@/features/tasks/constants'
import type { Category, TaskWithCategory } from '@/types'

interface TaskListProps {
  tasks: TaskWithCategory[]
  categories: Category[]
  activeTab: string
  onAddTask: (payload: { name: string; categoryId: string | null }) => Promise<void> | void
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
    })
  }

  const uncategorizedTasks = sortedTasks.filter((task) => task.category_id === null)
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
  const sections = buildSections(tasks, categories, activeTab)
  const hasAnyTasks = tasks.length > 0

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

          <AddTaskForm
            label="Add task"
            onAdd={async (name) => {
              await onAddTask({
                name,
                categoryId: section.categoryId,
              })
            }}
          />
        </section>
      ))}
    </div>
  )
}
