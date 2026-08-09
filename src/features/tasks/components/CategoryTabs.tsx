import { useEffect, useMemo, useRef, useState } from 'react'
import { GripVertical, MoreHorizontal, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { ColorPicker } from '@/features/tasks/components/ColorPicker'
import {
  canStartDrag,
  CATEGORY_DRAG_MIME,
  clearDragIntentId,
  getHorizontalDropPlacement,
  resolveDraggedId,
  setDragIntentId,
} from '@/features/tasks/lib/dragReorder'
import {
  getDropInsertPosition,
  getStepMovePosition,
  setDragData,
  type DropPlacement,
} from '@/lib/ordering'
import { getErrorMessage } from '@/lib/errorMessages'
import type { Category } from '@/types'

interface CategoryTabsProps {
  categories: Category[]
  activeTab: string
  onChangeTab: (tab: string) => void
  onAddCategory: () => void
  onRenameCategory: (id: string, name: string) => Promise<void> | void
  onRecolorCategory: (id: string, color: string) => Promise<void> | void
  onArchiveCategory: (id: string) => Promise<void> | void
  onDeleteCategory: (id: string) => Promise<void> | void
  onReorderCategory: (id: string, newPosition: number) => Promise<void> | void
}

export function CategoryTabs({
  categories,
  activeTab,
  onChangeTab,
  onAddCategory,
  onRenameCategory,
  onRecolorCategory,
  onArchiveCategory,
  onDeleteCategory,
  onReorderCategory,
}: CategoryTabsProps) {
  const orderedCategories = useMemo(
    () => [...categories].sort((a, b) => a.position - b.position),
    [categories]
  )

  const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id: string; placement: DropPlacement } | null>(
    null
  )

  const [contextMenu, setContextMenu] = useState<{
    category: Category
    x: number
    y: number
  } | null>(null)
  const [showColorPickerForCategoryId, setShowColorPickerForCategoryId] = useState<string | null>(
    null
  )
  const [reorderError, setReorderError] = useState<string | null>(null)
  const [renamingCategory, setRenamingCategory] = useState<Category | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)
  const [isRenaming, setIsRenaming] = useState(false)

  const menuRef = useRef<HTMLDivElement>(null)
  const dragIntentCategoryIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!contextMenu) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (!menuRef.current?.contains(target)) {
        setContextMenu(null)
        setShowColorPickerForCategoryId(null)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null)
        setShowColorPickerForCategoryId(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [contextMenu])

  const openCategoryMenu = (category: Category, x: number, y: number) => {
    const menuWidth = 224
    const estimatedMenuHeight = 360
    const viewportPadding = 8

    setContextMenu({
      category,
      x: Math.max(viewportPadding, Math.min(x, window.innerWidth - menuWidth - viewportPadding)),
      y: Math.max(
        viewportPadding,
        Math.min(y, window.innerHeight - estimatedMenuHeight - viewportPadding)
      ),
    })
    setShowColorPickerForCategoryId(null)
  }

  const clearDragState = () => {
    clearDragIntentId(dragIntentCategoryIdRef)
    setDraggedCategoryId(null)
    setDropTarget(null)
  }

  const setCategoryReorderError = (error: unknown) => {
    setReorderError(getErrorMessage(error, 'Unable to reorder category. Please try again.'))
  }

  const handleDrop = async (
    draggedCategoryId: string,
    targetCategoryId: string,
    placement: DropPlacement
  ) => {
    if (!draggedCategoryId || draggedCategoryId === targetCategoryId) {
      clearDragState()
      return
    }

    const newPosition = getDropInsertPosition(
      orderedCategories,
      draggedCategoryId,
      targetCategoryId,
      placement
    )

    if (newPosition === null) {
      clearDragState()
      return
    }

    try {
      await onReorderCategory(draggedCategoryId, newPosition)
      setReorderError(null)
    } catch (error) {
      setCategoryReorderError(error)
    }
    clearDragState()
  }

  const moveCategory = async (categoryId: string, direction: -1 | 1) => {
    const newPosition = getStepMovePosition(orderedCategories, categoryId, direction)
    if (newPosition === null) return

    try {
      await onReorderCategory(categoryId, newPosition)
      setReorderError(null)
    } catch (error) {
      setCategoryReorderError(error)
    }
  }

  const closeRenameModal = () => {
    if (isRenaming) return
    setRenamingCategory(null)
    setRenameValue('')
    setRenameError(null)
  }

  const saveCategoryName = async () => {
    if (!renamingCategory) return

    const trimmed = renameValue.trim()
    if (!trimmed) {
      setRenameError('Category name is required.')
      return
    }

    if (trimmed === renamingCategory.name) {
      closeRenameModal()
      return
    }

    setIsRenaming(true)
    setRenameError(null)
    try {
      await onRenameCategory(renamingCategory.id, trimmed)
      setRenamingCategory(null)
      setRenameValue('')
    } catch (error) {
      setRenameError(getErrorMessage(error, 'Unable to rename category.'))
    } finally {
      setIsRenaming(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Button
          className={`border-b-2 px-3 py-2 text-sm transition ${
            activeTab === 'all'
              ? 'border-ink-primary text-ink-primary'
              : 'border-transparent text-ink-secondary hover:text-ink-primary'
          }`}
          onClick={() => onChangeTab('all')}
          size="sm"
          variant="ghost"
        >
          All
        </Button>

        {orderedCategories.map((category) => (
          <div
            className={`relative flex items-center gap-1 border-b-2 px-2 py-1 ${
              activeTab === category.id
                ? 'text-ink-primary'
                : 'text-ink-secondary hover:text-ink-primary'
            }`}
            draggable
            key={category.id}
            onDragEnd={clearDragState}
            onDragOver={(event) => {
              event.preventDefault()

              const activeDraggedId = resolveDraggedId(event, CATEGORY_DRAG_MIME, draggedCategoryId)
              if (!activeDraggedId || activeDraggedId === category.id) return
              if (!orderedCategories.some((item) => item.id === activeDraggedId)) return

              const placement = getHorizontalDropPlacement(event)
              setDropTarget({ id: category.id, placement })
            }}
            onDragStart={(event) => {
              if (!canStartDrag(dragIntentCategoryIdRef, category.id)) {
                event.preventDefault()
                return
              }

              setDraggedCategoryId(category.id)
              setDragData(event.dataTransfer, CATEGORY_DRAG_MIME, category.id)
            }}
            onDrop={(event) => {
              event.preventDefault()
              const draggedId = resolveDraggedId(event, CATEGORY_DRAG_MIME, draggedCategoryId)
              if (!draggedId) return

              const fallbackPlacement: DropPlacement = getHorizontalDropPlacement(event)
              const placement =
                dropTarget?.id === category.id ? dropTarget.placement : fallbackPlacement

              void handleDrop(draggedId, category.id, placement)
            }}
            style={{
              borderBottomColor: activeTab === category.id ? category.color : 'transparent',
            }}
          >
            {dropTarget?.id === category.id && dropTarget.placement === 'before' ? (
              <span className="absolute bottom-0 left-0 top-0 w-0.5 bg-ink-primary" />
            ) : null}

            {dropTarget?.id === category.id && dropTarget.placement === 'after' ? (
              <span className="absolute bottom-0 right-0 top-0 w-0.5 bg-ink-primary" />
            ) : null}

            <Button
              className="flex items-center gap-2 px-1 py-1 text-sm"
              onClick={() => onChangeTab(category.id)}
              size="sm"
              variant="ghost"
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: category.color }}
              />
              <span className="whitespace-nowrap">{category.name}</span>
            </Button>

            <Button
              aria-label={`Reorder ${category.name}`}
              className="cursor-grab p-0 text-ink-tertiary hover:text-ink-secondary"
              onPointerCancel={() => {
                clearDragIntentId(dragIntentCategoryIdRef)
              }}
              onPointerDown={() => {
                setDragIntentId(dragIntentCategoryIdRef, category.id)
              }}
              onPointerUp={() => {
                clearDragIntentId(dragIntentCategoryIdRef)
              }}
              size="icon"
              variant="ghost"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </Button>

            <Button
              aria-expanded={contextMenu?.category.id === category.id}
              aria-haspopup="menu"
              aria-label={`Open options for ${category.name}`}
              className="p-0 text-ink-tertiary hover:text-ink-secondary"
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect()
                openCategoryMenu(category, rect.right - 224, rect.bottom + 4)
              }}
              size="icon"
              variant="ghost"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}

        <Button
          aria-label="Add category"
          className="p-0"
          onClick={onAddCategory}
          size="icon"
          variant="outlined"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {contextMenu ? (
        <div
          aria-label={`${contextMenu.category.name} options`}
          className="fixed z-50 w-56 rounded-lg border border-surface-border bg-surface-overlay p-2 shadow-xl"
          ref={menuRef}
          role="menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <Button
            className="w-full justify-start px-3 py-2 text-left text-sm text-ink-secondary transition hover:bg-surface-raised hover:text-ink-primary disabled:opacity-50"
            disabled={getStepMovePosition(orderedCategories, contextMenu.category.id, -1) === null}
            onClick={() => {
              void moveCategory(contextMenu.category.id, -1)
              setContextMenu(null)
            }}
            size="sm"
            role="menuitem"
            variant="ghost"
          >
            Move earlier
          </Button>

          <Button
            className="w-full justify-start px-3 py-2 text-left text-sm text-ink-secondary transition hover:bg-surface-raised hover:text-ink-primary disabled:opacity-50"
            disabled={getStepMovePosition(orderedCategories, contextMenu.category.id, 1) === null}
            onClick={() => {
              void moveCategory(contextMenu.category.id, 1)
              setContextMenu(null)
            }}
            size="sm"
            role="menuitem"
            variant="ghost"
          >
            Move later
          </Button>

          <Button
            className="w-full justify-start px-3 py-2 text-left text-sm text-ink-secondary transition hover:bg-surface-raised hover:text-ink-primary"
            onClick={() => {
              setRenamingCategory(contextMenu.category)
              setRenameValue(contextMenu.category.name)
              setRenameError(null)
              setContextMenu(null)
            }}
            size="sm"
            role="menuitem"
            variant="ghost"
          >
            Rename
          </Button>

          <Button
            className="w-full justify-start px-3 py-2 text-left text-sm text-ink-secondary transition hover:bg-surface-raised hover:text-ink-primary"
            onClick={() => {
              setShowColorPickerForCategoryId(contextMenu.category.id)
            }}
            size="sm"
            role="menuitem"
            variant="ghost"
          >
            Change color
          </Button>

          <Button
            className="w-full justify-start px-3 py-2 text-left text-sm text-amber-200 transition hover:bg-surface-raised"
            onClick={() => {
              void onArchiveCategory(contextMenu.category.id)
              setContextMenu(null)
            }}
            size="sm"
            role="menuitem"
            variant="ghost"
          >
            Archive
          </Button>

          {showColorPickerForCategoryId === contextMenu.category.id ? (
            <div className="px-3 py-2">
              <ColorPicker
                onChange={(color) => {
                  void onRecolorCategory(contextMenu.category.id, color)
                  setContextMenu(null)
                  setShowColorPickerForCategoryId(null)
                }}
                value={contextMenu.category.color}
              />
            </div>
          ) : null}

          <Button
            className="w-full justify-start px-3 py-2 text-left text-sm text-red-300 transition hover:bg-surface-raised"
            onClick={() => {
              const confirmed = window.confirm(
                `Delete ${contextMenu.category.name} permanently? Its tasks will become uncategorized.`
              )
              if (!confirmed) return

              void onDeleteCategory(contextMenu.category.id)
              setContextMenu(null)
            }}
            size="sm"
            role="menuitem"
            variant="ghost"
          >
            Delete permanently
          </Button>
        </div>
      ) : null}

      <Modal isOpen={!!renamingCategory} onClose={closeRenameModal} title="Rename category">
        <div className="space-y-4">
          <Input
            autoFocus
            error={renameError ?? undefined}
            label="Category name"
            maxLength={120}
            onChange={(event) => setRenameValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void saveCategoryName()
              }
            }}
            value={renameValue}
          />

          <div className="flex justify-end gap-2">
            <Button disabled={isRenaming} onClick={closeRenameModal} variant="ghost">
              Cancel
            </Button>
            <Button loading={isRenaming} onClick={saveCategoryName} variant="filled">
              Save
            </Button>
          </div>
        </div>
      </Modal>

      {reorderError ? (
        <p className="mt-2 text-xs text-red-300" role="alert">
          {reorderError}
        </p>
      ) : null}
    </>
  )
}
