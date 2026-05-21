import { useEffect, useMemo, useRef, useState } from 'react'
import { GripVertical, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
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
import type { Category } from '@/types'

const MIN_BREAK_DIVISOR = 2
const MAX_BREAK_DIVISOR = 10

interface CategoryTabsProps {
  categories: Category[]
  activeTab: string
  onChangeTab: (tab: string) => void
  onAddCategory: () => void
  onRenameCategory: (id: string, name: string) => Promise<void> | void
  onRecolorCategory: (id: string, color: string) => Promise<void> | void
  onSetCategoryBreakDivisor: (id: string, breakDivisor: number | null) => Promise<void> | void
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
  onSetCategoryBreakDivisor,
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

  const menuRef = useRef<HTMLDivElement>(null)
  const dragIntentCategoryIdRef = useRef<string | null>(null)
  const longPressTimeoutRef = useRef<number | null>(null)
  const longPressTriggeredRef = useRef(false)

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

  useEffect(() => {
    if (!contextMenu) {
      longPressTriggeredRef.current = false
    }
  }, [contextMenu])

  useEffect(() => {
    return () => {
      if (longPressTimeoutRef.current !== null) {
        window.clearTimeout(longPressTimeoutRef.current)
      }
    }
  }, [])

  const clearLongPress = () => {
    if (longPressTimeoutRef.current !== null) {
      window.clearTimeout(longPressTimeoutRef.current)
      longPressTimeoutRef.current = null
    }
  }

  const openCategoryMenu = (category: Category, x: number, y: number) => {
    setContextMenu({ category, x, y })
    setShowColorPickerForCategoryId(null)
  }

  const clearDragState = () => {
    clearDragIntentId(dragIntentCategoryIdRef)
    setDraggedCategoryId(null)
    setDropTarget(null)
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
      setReorderError(
        error instanceof Error ? error.message : 'Unable to reorder category. Please try again.'
      )
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
      setReorderError(
        error instanceof Error ? error.message : 'Unable to reorder category. Please try again.'
      )
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
            onContextMenu={(event) => {
              event.preventDefault()
              openCategoryMenu(category, event.clientX, event.clientY)
            }}
            onTouchCancel={clearLongPress}
            onTouchEnd={clearLongPress}
            onTouchMove={clearLongPress}
            onTouchStart={(event) => {
              if (event.touches.length !== 1) return

              const clientX = event.touches[0].clientX
              const clientY = event.touches[0].clientY
              clearLongPress()
              longPressTriggeredRef.current = false

              longPressTimeoutRef.current = window.setTimeout(() => {
                longPressTriggeredRef.current = true
                openCategoryMenu(category, clientX, clientY)
              }, 450)
            }}
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
              onClick={() => {
                if (longPressTriggeredRef.current) {
                  longPressTriggeredRef.current = false
                  return
                }

                onChangeTab(category.id)
              }}
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
          className="fixed z-50 w-56 rounded-lg border border-surface-border bg-surface-overlay p-2 shadow-xl"
          ref={menuRef}
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
            variant="ghost"
          >
            Move later
          </Button>

          <Button
            className="w-full justify-start px-3 py-2 text-left text-sm text-ink-secondary transition hover:bg-surface-raised hover:text-ink-primary"
            onClick={() => {
              const nextName = window.prompt('Rename category', contextMenu.category.name)
              if (!nextName) return

              const trimmed = nextName.trim()
              if (!trimmed) return

              void onRenameCategory(contextMenu.category.id, trimmed)
              setContextMenu(null)
            }}
            size="sm"
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
            variant="ghost"
          >
            Change color
          </Button>

          <Button
            className="w-full justify-start px-3 py-2 text-left text-sm text-ink-secondary transition hover:bg-surface-raised hover:text-ink-primary"
            onClick={() => {
              const existingValue =
                contextMenu.category.break_divisor === null
                  ? ''
                  : String(contextMenu.category.break_divisor)
              const nextValue = window.prompt(
                `Category break divisor (${MIN_BREAK_DIVISOR}-${MAX_BREAK_DIVISOR}). Leave blank to use global setting.`,
                existingValue
              )

              if (nextValue === null) {
                return
              }

              const trimmed = nextValue.trim()
              if (trimmed.length === 0) {
                Promise.resolve(onSetCategoryBreakDivisor(contextMenu.category.id, null))
                  .then(() => {
                    setReorderError(null)
                    setContextMenu(null)
                  })
                  .catch((error) => {
                    setReorderError(
                      error instanceof Error
                        ? error.message
                        : 'Unable to update category break rule.'
                    )
                  })
                return
              }

              const parsed = Number(trimmed)
              if (
                !Number.isInteger(parsed) ||
                parsed < MIN_BREAK_DIVISOR ||
                parsed > MAX_BREAK_DIVISOR
              ) {
                setReorderError(
                  `Break divisor must be an integer between ${MIN_BREAK_DIVISOR} and ${MAX_BREAK_DIVISOR}.`
                )
                return
              }

              Promise.resolve(onSetCategoryBreakDivisor(contextMenu.category.id, parsed))
                .then(() => {
                  setReorderError(null)
                  setContextMenu(null)
                })
                .catch((error) => {
                  setReorderError(
                    error instanceof Error ? error.message : 'Unable to update category break rule.'
                  )
                })
            }}
            size="sm"
            variant="ghost"
          >
            Set break rule
          </Button>

          <Button
            className="w-full justify-start px-3 py-2 text-left text-sm text-amber-200 transition hover:bg-surface-raised"
            onClick={() => {
              void onArchiveCategory(contextMenu.category.id)
              setContextMenu(null)
            }}
            size="sm"
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
              void onDeleteCategory(contextMenu.category.id)
              setContextMenu(null)
            }}
            size="sm"
            variant="ghost"
          >
            Delete permanently
          </Button>
        </div>
      ) : null}

      {reorderError ? <p className="mt-2 text-xs text-red-300">{reorderError}</p> : null}
    </>
  )
}
