import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { AddCategoryForm } from '@/features/tasks/components/AddCategoryForm'
import { CategoryTabs } from '@/features/tasks/components/CategoryTabs'
import { TaskList } from '@/features/tasks/components/TaskList'
import { useCategories } from '@/features/tasks/hooks/useCategories'
import { useTasks } from '@/features/tasks/hooks/useTasks'

export function TasksPage() {
  const [activeTab, setActiveTab] = useState('all')
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false)
  const [showArchivedCategories, setShowArchivedCategories] = useState(false)
  const [showCompletedTasks, setShowCompletedTasks] = useState(false)

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
    completedTasks,
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

  const resolvedActiveTab =
    activeTab !== 'all' && !categories.some((category) => category.id === activeTab)
      ? 'all'
      : activeTab

  const isLoading = categoriesLoading || tasksLoading
  const error = categoriesError ?? tasksError
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
    restoreTask.error ??
    deleteTask.error ??
    moveTask.error ??
    reorderTask.error

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
        onArchiveCategory={async (id) => {
          await archiveCategory.mutateAsync(id)
          if (resolvedActiveTab === id) {
            setActiveTab('all')
          }
        }}
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

      {archivedCategories.length > 0 ? (
        <section className="rounded-xl border border-surface-border bg-surface-raised/60 p-3">
          <Button
            className="h-auto w-full justify-between px-1 text-sm"
            onClick={() => setShowArchivedCategories((current) => !current)}
            size="sm"
            variant="ghost"
          >
            <span>Archived categories ({archivedCategories.length})</span>
            {showArchivedCategories ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>

          {showArchivedCategories ? (
            <div className="mt-2 space-y-2">
              {archivedCategories.map((category) => (
                <div
                  className="flex items-center justify-between gap-2 rounded-lg border border-surface-border px-3 py-2"
                  key={category.id}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    <span className="truncate text-sm text-ink-primary">{category.name}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={async () => {
                        await unarchiveCategory.mutateAsync(category.id)
                        setActiveTab(category.id)
                      }}
                      size="sm"
                      variant="ghost"
                    >
                      Restore
                    </Button>

                    <Button
                      className="text-red-300 hover:text-red-200"
                      onClick={async () => {
                        await deleteCategory.mutateAsync(category.id)
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
          ) : null}
        </section>
      ) : null}

      <TaskList
        activeTab={resolvedActiveTab}
        archivedCategories={archivedCategories}
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
        onMoveArchivedTasks={async (taskIds, targetCategoryId) => {
          for (const taskId of taskIds) {
            await moveTask.mutateAsync({ id: taskId, categoryId: targetCategoryId })
          }
        }}
        onRestoreCategory={async (categoryId) => {
          await unarchiveCategory.mutateAsync(categoryId)
          setActiveTab(categoryId)
        }}
        onReorderTask={async ({ id, newPosition }) => {
          await reorderTask.mutateAsync({ id, newPosition })
        }}
        onUpdateTask={async ({ id, name, color }) => {
          await updateTask.mutateAsync({ id, name, color })
        }}
        tasks={activeTasks}
      />

      <section className="rounded-xl border border-surface-border bg-surface-raised/60 p-3">
        <Button
          className="h-auto w-full justify-between px-1 text-sm"
          onClick={() => setShowCompletedTasks((current) => !current)}
          size="sm"
          variant="ghost"
        >
          <span>Completed tasks ({completedTasks.length})</span>
          {showCompletedTasks ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>

        {showCompletedTasks ? (
          completedTasks.length === 0 ? (
            <p className="mt-2 text-sm text-ink-tertiary">No completed tasks yet.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {completedTasks.map((task) => (
                <div
                  className="flex items-center justify-between gap-2 rounded-lg border border-surface-border px-3 py-2"
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
                        await restoreTask.mutateAsync(task.id)
                      }}
                      size="sm"
                      variant="ghost"
                    >
                      Restore
                    </Button>

                    <Button
                      className="text-red-300 hover:text-red-200"
                      onClick={async () => {
                        await deleteTask.mutateAsync(task.id)
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
          )
        ) : null}
      </section>

      {mutationError ? (
        <p className="text-sm text-red-300">
          {mutationError instanceof Error ? mutationError.message : 'Task action failed.'}
        </p>
      ) : null}

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
