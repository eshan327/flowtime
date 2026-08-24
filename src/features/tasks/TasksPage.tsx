import { useState } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { AddCategoryForm } from '@/features/tasks/components/AddCategoryForm'
import { CategoryTabs } from '@/features/tasks/components/CategoryTabs'
import { TaskList } from '@/features/tasks/components/TaskList'
import { useCategories } from '@/features/tasks/hooks/useCategories'
import { useTasks } from '@/features/tasks/hooks/useTasks'
import { getErrorMessage } from '@/lib/errorMessages'

export function TasksPage() {
  const [activeTab, setActiveTab] = useState('all')
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false)

  const {
    categories,
    archivedCategories,
    isLoading: categoriesLoading,
    error: categoriesError,
    addCategory,
    renameCategory,
    recolorCategory,
    archiveCategory,
    unarchiveCategory,
    deleteCategory,
    reorderCategory,
  } = useCategories()

  const {
    activeTasks,
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

  const mutationError =
    addCategory.error ??
    renameCategory.error ??
    recolorCategory.error ??
    archiveCategory.error ??
    unarchiveCategory.error ??
    deleteCategory.error ??
    reorderCategory.error ??
    addTask.error ??
    updateTask.error ??
    completeTask.error ??
    deleteTask.error ??
    moveTask.error ??
    reorderTask.error

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
      <section className="rounded-xl bg-surface-panel p-6">
        <p className="text-sm text-red-300">
          {getErrorMessage(error, 'Unable to load tasks right now.')}
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-4xl font-medium tracking-tight">Tasks</h1>
      </header>

      <CategoryTabs
        activeTab={resolvedActiveTab}
        categories={categories}
        onAddCategory={() => setIsAddCategoryOpen(true)}
        onArchiveCategory={async (id) => {
          await archiveCategory.mutateAsync(id)
          if (resolvedActiveTab === id) setActiveTab('all')
        }}
        onChangeTab={setActiveTab}
        onDeleteCategory={async (id) => {
          await deleteCategory.mutateAsync(id)
          if (resolvedActiveTab === id) setActiveTab('all')
        }}
        onRecolorCategory={(id, color) => recolorCategory.mutateAsync({ id, color })}
        onRenameCategory={(id, name) => renameCategory.mutateAsync({ id, name })}
        onReorderCategory={(id, newPosition) => reorderCategory.mutateAsync({ id, newPosition })}
      />

      <TaskList
        activeTab={resolvedActiveTab}
        archivedCategories={archivedCategories}
        categories={categories}
        onAddTask={addTask.mutateAsync}
        onCompleteTask={completeTask.mutateAsync}
        onDeleteTask={deleteTask.mutateAsync}
        onMoveTask={moveTask.mutateAsync}
        onMoveArchivedTasks={async (taskIds, categoryId) => {
          for (const id of taskIds) await moveTask.mutateAsync({ id, categoryId })
        }}
        onRestoreCategory={async (id) => {
          await unarchiveCategory.mutateAsync(id)
          setActiveTab(id)
        }}
        onReorderTask={reorderTask.mutateAsync}
        onUpdateTask={updateTask.mutateAsync}
        tasks={activeTasks}
      />

      {mutationError ? (
        <p className="text-sm text-red-300" role="alert">
          {getErrorMessage(mutationError, 'Task action failed.')}
        </p>
      ) : null}

      <AddCategoryForm
        isOpen={isAddCategoryOpen}
        onClose={() => setIsAddCategoryOpen(false)}
        onCreate={async (payload) => {
          const category = await addCategory.mutateAsync(payload)
          setActiveTab(category.id)
        }}
      />
    </section>
  )
}
