import { useState } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { AddCategoryForm } from '@/features/tasks/components/AddCategoryForm'
import { CategoryTabs } from '@/features/tasks/components/CategoryTabs'
import { TaskList } from '@/features/tasks/components/TaskList'
import { useCategories } from '@/features/tasks/hooks/useCategories'
import { useTaskPageActions } from '@/features/tasks/hooks/useTaskPageActions'
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
    setCategoryBreakDivisor,
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
    restoreTask,
    deleteTask,
    moveTask,
    reorderTask,
  } = useTasks()

  const {
    resolvedActiveTab,
    mutationError,
    handleCreateCategory,
    handleArchiveCategory,
    handleDeleteCategory,
    handleRestoreArchivedCategory,
    handleMoveArchivedTasks,
    handleAddTask,
    handleUpdateTask,
    handleCompleteTask,
    handleDeleteTask,
    handleMoveTask,
    handleReorderTask,
    handleRenameCategory,
    handleRecolorCategory,
    handleSetCategoryBreakDivisor,
    handleReorderCategory,
  } = useTaskPageActions({
    activeTab,
    setActiveTab,
    categories,
    addCategory,
    renameCategory,
    recolorCategory,
    setCategoryBreakDivisor,
    archiveCategory,
    unarchiveCategory,
    deleteCategory,
    reorderCategory,
    addTask,
    updateTask,
    completeTask,
    restoreTask,
    deleteTask,
    moveTask,
    reorderTask,
  })

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
          {getErrorMessage(error, 'Unable to load tasks right now.')}
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
        onArchiveCategory={handleArchiveCategory}
        onChangeTab={setActiveTab}
        onDeleteCategory={handleDeleteCategory}
        onRecolorCategory={handleRecolorCategory}
        onRenameCategory={handleRenameCategory}
        onSetCategoryBreakDivisor={handleSetCategoryBreakDivisor}
        onReorderCategory={handleReorderCategory}
      />

      <TaskList
        activeTab={resolvedActiveTab}
        archivedCategories={archivedCategories}
        categories={categories}
        onAddTask={handleAddTask}
        onCompleteTask={handleCompleteTask}
        onDeleteTask={handleDeleteTask}
        onMoveTask={handleMoveTask}
        onMoveArchivedTasks={handleMoveArchivedTasks}
        onRestoreCategory={handleRestoreArchivedCategory}
        onReorderTask={handleReorderTask}
        onUpdateTask={handleUpdateTask}
        tasks={activeTasks}
      />

      {mutationError ? (
        <p className="text-sm text-red-300">
          {getErrorMessage(mutationError, 'Task action failed.')}
        </p>
      ) : null}

      <AddCategoryForm
        isOpen={isAddCategoryOpen}
        onClose={() => setIsAddCategoryOpen(false)}
        onCreate={handleCreateCategory}
      />
    </section>
  )
}
