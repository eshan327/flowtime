import type { Category } from '@/types'

interface AsyncMutation<TVariables, TResult = unknown> {
  mutateAsync: (variables: TVariables) => Promise<TResult>
  error: unknown
}

interface UseTaskPageActionsOptions {
  activeTab: string
  setActiveTab: (tab: string) => void
  categories: Category[]
  addCategory: AsyncMutation<{ name: string; color: string }, Category>
  renameCategory: AsyncMutation<{ id: string; name: string }>
  recolorCategory: AsyncMutation<{ id: string; color: string }>
  archiveCategory: AsyncMutation<string>
  unarchiveCategory: AsyncMutation<string>
  deleteCategory: AsyncMutation<string>
  reorderCategory: AsyncMutation<{ id: string; newPosition: number }>
  addTask: AsyncMutation<{ name: string; categoryId: string | null }>
  updateTask: AsyncMutation<{ id: string; name?: string; color?: string }>
  completeTask: AsyncMutation<string>
  restoreTask: AsyncMutation<string>
  deleteTask: AsyncMutation<string>
  moveTask: AsyncMutation<{ id: string; categoryId: string | null }>
  reorderTask: AsyncMutation<{ id: string; newPosition: number }>
}

export function useTaskPageActions({
  activeTab,
  setActiveTab,
  categories,
  addCategory,
  renameCategory,
  recolorCategory,
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
}: UseTaskPageActionsOptions) {
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
    restoreTask.error ??
    deleteTask.error ??
    moveTask.error ??
    reorderTask.error

  const runMutation = async <TVars>(mutation: AsyncMutation<TVars>, variables: TVars) => {
    await mutation.mutateAsync(variables)
  }

  return {
    resolvedActiveTab,
    mutationError,
    handleCreateCategory: async (payload: { name: string; color: string }) => {
      const created = await addCategory.mutateAsync(payload)
      setActiveTab(created.id)
    },
    handleArchiveCategory: async (id: string) => {
      await archiveCategory.mutateAsync(id)
      if (resolvedActiveTab === id) {
        setActiveTab('all')
      }
    },
    handleDeleteCategory: async (id: string) => {
      await deleteCategory.mutateAsync(id)
      if (resolvedActiveTab === id) {
        setActiveTab('all')
      }
    },
    handleRestoreArchivedCategory: async (id: string) => {
      await unarchiveCategory.mutateAsync(id)
      setActiveTab(id)
    },
    handleMoveArchivedTasks: async (taskIds: string[], targetCategoryId: string | null) => {
      for (const taskId of taskIds) {
        await moveTask.mutateAsync({ id: taskId, categoryId: targetCategoryId })
      }
    },
    handleAddTask: (payload: { name: string; categoryId: string | null }) =>
      runMutation(addTask, payload),
    handleUpdateTask: (payload: { id: string; name?: string; color?: string }) =>
      runMutation(updateTask, payload),
    handleCompleteTask: (taskId: string) => runMutation(completeTask, taskId),
    handleRestoreTask: (taskId: string) => runMutation(restoreTask, taskId),
    handleDeleteTask: (taskId: string) => runMutation(deleteTask, taskId),
    handleMoveTask: (payload: { id: string; categoryId: string | null }) =>
      runMutation(moveTask, payload),
    handleReorderTask: (payload: { id: string; newPosition: number }) =>
      runMutation(reorderTask, payload),
    handleRenameCategory: (id: string, name: string) => runMutation(renameCategory, { id, name }),
    handleRecolorCategory: (id: string, color: string) =>
      runMutation(recolorCategory, { id, color }),
    handleReorderCategory: (id: string, newPosition: number) =>
      runMutation(reorderCategory, { id, newPosition }),
  }
}
