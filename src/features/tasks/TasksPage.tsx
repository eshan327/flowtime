import { useState } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { AddCategoryForm } from '@/features/tasks/components/AddCategoryForm'
import { CategoryTabs } from '@/features/tasks/components/CategoryTabs'
import { TaskList } from '@/features/tasks/components/TaskList'
import { useCategories } from '@/features/tasks/hooks/useCategories'
import { useTasks } from '@/features/tasks/hooks/useTasks'

export function TasksPage() {
  const [activeTab, setActiveTab] = useState('all')
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false)

  const {
    categories,
    isLoading: categoriesLoading,
    error: categoriesError,
    addCategory,
    renameCategory,
    recolorCategory,
    deleteCategory,
    reorderCategory,
  } = useCategories()

  const {
    tasks,
    isLoading: tasksLoading,
    error: tasksError,
    addTask,
    updateTask,
    completeTask,
    deleteTask,
    moveTask,
    reorderTask,
  } = useTasks()

  const resolvedActiveTab =
    activeTab !== 'all' && !categories.some((category) => category.id === activeTab)
      ? 'all'
      : activeTab

  const isLoading = categoriesLoading || tasksLoading
  const error = categoriesError ?? tasksError

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (error) {
    return (
      <section className="mx-auto max-w-3xl rounded-xl border border-surface-border bg-surface-raised p-6">
        <p className="text-sm text-red-300">
          {error instanceof Error ? error.message : 'Unable to load tasks right now.'}
        </p>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <header>
        <p className="text-xs uppercase tracking-[0.14em] text-ink-tertiary">Tasks</p>
        <h1 className="mt-2 text-2xl font-light">Task Manager</h1>
      </header>

      <CategoryTabs
        activeTab={resolvedActiveTab}
        categories={categories}
        onAddCategory={() => setIsAddCategoryOpen(true)}
        onChangeTab={setActiveTab}
        onDeleteCategory={async (id) => {
          await deleteCategory.mutateAsync(id)
          if (resolvedActiveTab === id) {
            setActiveTab('all')
          }
        }}
        onRecolorCategory={async (id, color) => {
          await recolorCategory.mutateAsync({ id, color })
        }}
        onRenameCategory={async (id, name) => {
          await renameCategory.mutateAsync({ id, name })
        }}
        onReorderCategory={async (id, newPosition) => {
          await reorderCategory.mutateAsync({ id, newPosition })
        }}
      />

      <TaskList
        activeTab={resolvedActiveTab}
        categories={categories}
        onAddTask={async ({ name, categoryId }) => {
          await addTask.mutateAsync({ name, categoryId })
        }}
        onCompleteTask={async (taskId) => {
          await completeTask.mutateAsync(taskId)
        }}
        onDeleteTask={async (taskId) => {
          await deleteTask.mutateAsync(taskId)
        }}
        onMoveTask={async ({ id, categoryId }) => {
          await moveTask.mutateAsync({ id, categoryId })
        }}
        onReorderTask={async ({ id, newPosition }) => {
          await reorderTask.mutateAsync({ id, newPosition })
        }}
        onUpdateTask={async ({ id, name, color }) => {
          await updateTask.mutateAsync({ id, name, color })
        }}
        tasks={tasks}
      />

      <AddCategoryForm
        isOpen={isAddCategoryOpen}
        onClose={() => setIsAddCategoryOpen(false)}
        onCreate={async ({ name, color }) => {
          const created = await addCategory.mutateAsync({ name, color })
          setActiveTab(created.id)
        }}
      />
    </section>
  )
}
