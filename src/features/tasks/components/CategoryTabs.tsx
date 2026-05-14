import { useEffect, useMemo, useRef, useState } from 'react'
import { GripVertical, Plus } from 'lucide-react'
import { ColorPicker } from '@/features/tasks/components/ColorPicker'
import type { Category } from '@/types'

type DropPlacement = 'before' | 'after'

interface CategoryTabsProps {
  categories: Category[]
  activeTab: string
  onChangeTab: (tab: string) => void
  onAddCategory: () => void
  onRenameCategory: (id: string, name: string) => Promise<void> | void
  onRecolorCategory: (id: string, color: string) => Promise<void> | void
  onDeleteCategory: (id: string) => Promise<void> | void
  onReorderCategory: (id: string, newPosition: number) => Promise<void> | void
}

function getNewPosition(
  categories: Category[],
  draggedCategoryId: string,
  targetCategoryId: string,
  placement: DropPlacement
) {
  const ordered = [...categories].sort((a, b) => a.position - b.position)
  const withoutDragged = ordered.filter((category) => category.id !== draggedCategoryId)
  const targetIndex = withoutDragged.findIndex((category) => category.id === targetCategoryId)
  if (targetIndex === -1) return null

  const insertIndex = placement === 'before' ? targetIndex : targetIndex + 1
  const previous = withoutDragged[insertIndex - 1]
  const next = withoutDragged[insertIndex]

  if (!previous && !next) return 0
  if (!previous && next) return next.position - 1
  if (previous && !next) return previous.position + 1
  return (previous.position + next.position) / 2
}

export function CategoryTabs({
  categories,
  activeTab,
  onChangeTab,
  onAddCategory,
  onRenameCategory,
  onRecolorCategory,
  onDeleteCategory,
  onReorderCategory,
}: CategoryTabsProps) {
  const orderedCategories = useMemo(
    () => [...categories].sort((a, b) => a.position - b.position),
    [categories]
  )

  const [dragEnabledId, setDragEnabledId] = useState<string | null>(null)
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

  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!contextMenu) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (!menuRef.current?.contains(target)) {
        setContextMenu(null)
        setShowColorPickerForCategoryId(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [contextMenu])

  const clearDragState = () => {
    setDragEnabledId(null)
    setDraggedCategoryId(null)
    setDropTarget(null)
  }

  const handleDrop = async (targetCategoryId: string, placement: DropPlacement) => {
    if (!draggedCategoryId || draggedCategoryId === targetCategoryId) {
      clearDragState()
      return
    }

    const newPosition = getNewPosition(
      orderedCategories,
      draggedCategoryId,
      targetCategoryId,
      placement
    )

    if (newPosition === null) {
      clearDragState()
      return
    }

    await onReorderCategory(draggedCategoryId, newPosition)
    clearDragState()
  }

  return (
    <>
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          className={`border-b-2 px-3 py-2 text-sm transition ${
            activeTab === 'all'
              ? 'border-ink-primary text-ink-primary'
              : 'border-transparent text-ink-secondary hover:text-ink-primary'
          }`}
          onClick={() => onChangeTab('all')}
          type="button"
        >
          All
        </button>

        {orderedCategories.map((category) => (
          <div
            className={`relative flex items-center gap-1 border-b-2 px-2 py-1 ${
              activeTab === category.id
                ? 'text-ink-primary'
                : 'text-ink-secondary hover:text-ink-primary'
            }`}
            draggable={dragEnabledId === category.id}
            key={category.id}
            onContextMenu={(event) => {
              event.preventDefault()
              setContextMenu({
                category,
                x: event.clientX,
                y: event.clientY,
              })
              setShowColorPickerForCategoryId(null)
            }}
            onDragEnd={clearDragState}
            onDragOver={(event) => {
              if (!draggedCategoryId || draggedCategoryId === category.id) return

              event.preventDefault()
              const rect = event.currentTarget.getBoundingClientRect()
              const placement = event.clientX < rect.left + rect.width / 2 ? 'before' : 'after'
              setDropTarget({ id: category.id, placement })
            }}
            onDragStart={(event) => {
              if (dragEnabledId !== category.id) {
                event.preventDefault()
                return
              }

              setDraggedCategoryId(category.id)
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('text/plain', category.id)
            }}
            onDrop={(event) => {
              event.preventDefault()
              if (!dropTarget || dropTarget.id !== category.id) return
              void handleDrop(category.id, dropTarget.placement)
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

            <button
              className="flex items-center gap-2 px-1 py-1 text-sm"
              onClick={() => onChangeTab(category.id)}
              type="button"
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: category.color }}
              />
              <span className="whitespace-nowrap">{category.name}</span>
            </button>

            <button
              aria-label={`Reorder ${category.name}`}
              className="cursor-grab rounded p-1 text-ink-tertiary hover:text-ink-secondary"
              onMouseDown={() => setDragEnabledId(category.id)}
              onMouseUp={() => setDragEnabledId(null)}
              type="button"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        <button
          aria-label="Add category"
          className="rounded-lg border border-surface-border p-2 text-ink-secondary transition hover:border-ink-secondary hover:text-ink-primary"
          onClick={onAddCategory}
          type="button"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {contextMenu ? (
        <div
          className="fixed z-50 w-56 rounded-lg border border-surface-border bg-surface-overlay p-2 shadow-xl"
          ref={menuRef}
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="w-full rounded-md px-3 py-2 text-left text-sm text-ink-secondary transition hover:bg-surface-raised hover:text-ink-primary"
            onClick={() => {
              const nextName = window.prompt('Rename category', contextMenu.category.name)
              if (!nextName) return

              const trimmed = nextName.trim()
              if (!trimmed) return

              void onRenameCategory(contextMenu.category.id, trimmed)
              setContextMenu(null)
            }}
            type="button"
          >
            Rename
          </button>

          <button
            className="w-full rounded-md px-3 py-2 text-left text-sm text-ink-secondary transition hover:bg-surface-raised hover:text-ink-primary"
            onClick={() => {
              setShowColorPickerForCategoryId(contextMenu.category.id)
            }}
            type="button"
          >
            Change color
          </button>

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

          <button
            className="w-full rounded-md px-3 py-2 text-left text-sm text-red-300 transition hover:bg-surface-raised"
            onClick={() => {
              void onDeleteCategory(contextMenu.category.id)
              setContextMenu(null)
            }}
            type="button"
          >
            Delete
          </button>
        </div>
      ) : null}
    </>
  )
}
