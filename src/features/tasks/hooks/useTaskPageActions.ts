import { useMemo } from 'react'
import type { Category } from '@/types'

interface AsyncMutation<TVariables, TResult = unknown> {
  mutateAsync: (variables: TVariables) => Promise<TResult>
  error: unknown
}

interface UseTaskPageActionsOptions {
  activeTab: string
  setActiveTab: (tab: string) => void
  categories: Category[]
  addCategory: AsyncMutation<{ name: string; color: string; breakDivisor: number | null }, Category>
  renameCategory: AsyncMutation<{ id: string; name: string }>
  recolorCategory: AsyncMutation<{ id: string; color: string }>
  setCategoryBreakDivisor: AsyncMutation<{ id: string; breakDivisor: number | null }>
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
}: UseTaskPageActionsOptions) {
  const resolvedActiveTab =
    activeTab !== 'all' && !categories.some((category) => category.id === activeTab)
      ? 'all'
      : activeTab

  const mutationError = useMemo(
    () =>
      addCategory.error ??
      renameCategory.error ??
      recolorCategory.error ??
      setCategoryBreakDivisor.error ??
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
      reorderTask.error,
    [
      addCategory.error,
      renameCategory.error,
      recolorCategory.error,
      setCategoryBreakDivisor.error,
      archiveCategory.error,
      unarchiveCategory.error,
      deleteCategory.error,
      reorderCategory.error,
      addTask.error,
      updateTask.error,
      completeTask.error,
      restoreTask.error,
      deleteTask.error,
      moveTask.error,
      reorderTask.error,
    ]
  )

  return {
    resolvedActiveTab,
    mutationError,
    handleCreateCategory: async (payload: {
      name: string
      color: string
      breakDivisor: number | null
    }) => {
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
    handleAddTask: async (payload: { name: string; categoryId: string | null }) => {
      await addTask.mutateAsync(payload)
    },
    handleUpdateTask: async (payload: { id: string; name?: string; color?: string }) => {
      await updateTask.mutateAsync(payload)
    },
    handleCompleteTask: async (taskId: string) => {
      await completeTask.mutateAsync(taskId)
    },
    handleRestoreTask: async (taskId: string) => {
      await restoreTask.mutateAsync(taskId)
    },
    handleDeleteTask: async (taskId: string) => {
      await deleteTask.mutateAsync(taskId)
    },
    handleMoveTask: async (payload: { id: string; categoryId: string | null }) => {
      await moveTask.mutateAsync(payload)
    },
    handleReorderTask: async (payload: { id: string; newPosition: number }) => {
      await reorderTask.mutateAsync(payload)
    },
    handleRenameCategory: async (id: string, name: string) => {
      await renameCategory.mutateAsync({ id, name })
    },
    handleRecolorCategory: async (id: string, color: string) => {
      await recolorCategory.mutateAsync({ id, color })
    },
    handleSetCategoryBreakDivisor: async (id: string, breakDivisor: number | null) => {
      await setCategoryBreakDivisor.mutateAsync({ id, breakDivisor })
    },
    handleReorderCategory: async (id: string, newPosition: number) => {
      await reorderCategory.mutateAsync({ id, newPosition })
    },
  }
}
