import { useMemo, useState } from 'react'
import { Archive, ArrowDown, ArrowUp, Plus, Settings2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { ColorPicker } from '@/features/tasks/components/ColorPicker'
import { getErrorMessage } from '@/lib/errorMessages'
import { getStepMovePosition, sortByPositionAndCreatedAt } from '@/lib/ordering'
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
  const orderedCategories = useMemo(() => sortByPositionAndCreatedAt(categories), [categories])
  const [isManagerOpen, setIsManagerOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const selectedCategory = orderedCategories.find((category) => category.id === selectedId) ?? null

  const openManager = () => {
    const initialCategory =
      orderedCategories.find((category) => category.id === activeTab) ??
      orderedCategories[0] ??
      null
    setSelectedId(initialCategory?.id ?? null)
    setDraftName(initialCategory?.name ?? '')
    setError(null)
    setIsManagerOpen(true)
  }

  const runAction = async (action: () => Promise<void> | void, fallback: string) => {
    setIsSaving(true)
    setError(null)
    try {
      await action()
      return true
    } catch (actionError) {
      setError(getErrorMessage(actionError, fallback))
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const saveName = () => {
    if (!selectedCategory) return
    const name = draftName.trim()
    if (!name) {
      setError('Category name is required.')
      return
    }
    if (name === selectedCategory.name) return
    void runAction(() => onRenameCategory(selectedCategory.id, name), 'Unable to rename category.')
  }

  const moveSelected = (direction: -1 | 1) => {
    if (!selectedCategory) return
    const position = getStepMovePosition(orderedCategories, selectedCategory.id, direction)
    if (position === null) return
    void runAction(
      () => onReorderCategory(selectedCategory.id, position),
      'Unable to reorder category.'
    )
  }

  return (
    <>
      <div className="space-y-6 border-b border-surface-border">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-4xl font-semibold tracking-[-0.045em]">Tasks</h1>

          <div className="flex shrink-0 items-center gap-2">
            <Button onClick={openManager} variant="ghost">
              <Settings2 className="h-4 w-4" />
              Organize
            </Button>
            <Button onClick={onAddCategory} variant="filled">
              <Plus className="h-4 w-4" />
              <span>New category</span>
            </Button>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-7 overflow-x-auto">
          <button
            aria-pressed={activeTab === 'all'}
            className={`shrink-0 border-b-2 px-1 pb-4 pt-1 text-[15px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent-primary/70 ${
              activeTab === 'all'
                ? 'border-accent-primary font-medium text-ink-primary'
                : 'border-transparent text-ink-tertiary hover:text-ink-primary'
            }`}
            onClick={() => onChangeTab('all')}
            type="button"
          >
            All
          </button>

          {orderedCategories.map((category) => {
            const isActive = activeTab === category.id
            return (
              <button
                aria-pressed={isActive}
                className={`flex shrink-0 items-center gap-2 border-b-2 px-1 pb-4 pt-1 text-[15px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent-primary/70 ${
                  isActive
                    ? 'border-accent-primary font-medium text-ink-primary'
                    : 'border-transparent text-ink-tertiary hover:text-ink-primary'
                }`}
                key={category.id}
                onClick={() => onChangeTab(category.id)}
                type="button"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
                {category.name}
              </button>
            )
          })}
        </div>
      </div>

      <Modal
        className="max-w-2xl"
        isOpen={isManagerOpen}
        onClose={() => setIsManagerOpen(false)}
        title="Organize categories"
      >
        {orderedCategories.length === 0 ? (
          <div className="rounded-xl border border-dashed border-surface-border p-6 text-center">
            <p className="text-sm text-ink-secondary">No categories yet.</p>
            <Button
              className="mt-4"
              onClick={() => {
                setIsManagerOpen(false)
                onAddCategory()
              }}
              variant="filled"
            >
              <Plus className="h-4 w-4" />
              Add category
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr] md:divide-x md:divide-surface-border-subtle">
            <div className="space-y-1 p-1 md:pr-4">
              {orderedCategories.map((category) => (
                <button
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                    selectedId === category.id
                      ? 'bg-surface-hover text-ink-primary'
                      : 'text-ink-secondary hover:bg-surface-hover/60 hover:text-ink-primary'
                  }`}
                  key={category.id}
                  onClick={() => {
                    setSelectedId(category.id)
                    setDraftName(category.name)
                    setError(null)
                  }}
                  type="button"
                >
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  <span className="truncate">{category.name}</span>
                </button>
              ))}
            </div>

            {selectedCategory ? (
              <div className="p-1 md:pl-4">
                <Input
                  disabled={isSaving}
                  error={error ?? undefined}
                  label="Name"
                  maxLength={120}
                  onBlur={saveName}
                  onChange={(event) => setDraftName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      saveName()
                    }
                  }}
                  value={draftName}
                />

                <div className="mt-5">
                  <p className="mb-2 text-xs uppercase tracking-[0.12em] text-ink-tertiary">
                    Color
                  </p>
                  <ColorPicker
                    onChange={(color) => {
                      void runAction(
                        () => onRecolorCategory(selectedCategory.id, color),
                        'Unable to update category color.'
                      )
                    }}
                    value={selectedCategory.color}
                  />
                </div>

                <div className="mt-5 flex gap-2">
                  <Button
                    aria-label="Move category up"
                    disabled={
                      isSaving ||
                      getStepMovePosition(orderedCategories, selectedCategory.id, -1) === null
                    }
                    onClick={() => moveSelected(-1)}
                    size="sm"
                    variant="outlined"
                  >
                    <ArrowUp className="h-4 w-4" /> Move up
                  </Button>
                  <Button
                    aria-label="Move category down"
                    disabled={
                      isSaving ||
                      getStepMovePosition(orderedCategories, selectedCategory.id, 1) === null
                    }
                    onClick={() => moveSelected(1)}
                    size="sm"
                    variant="outlined"
                  >
                    <ArrowDown className="h-4 w-4" /> Move down
                  </Button>
                </div>

                <div className="mt-6 border-t border-surface-border-subtle pt-4">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={isSaving}
                      onClick={() => {
                        void runAction(
                          () => onArchiveCategory(selectedCategory.id),
                          'Unable to archive category.'
                        ).then((succeeded) => {
                          if (succeeded) setIsManagerOpen(false)
                        })
                      }}
                      size="sm"
                      variant="ghost"
                    >
                      <Archive className="h-4 w-4" /> Archive
                    </Button>
                    <Button
                      className="text-red-300 hover:text-red-200"
                      disabled={isSaving}
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Delete ${selectedCategory.name} permanently? Its tasks will become uncategorized.`
                          )
                        )
                          return
                        void runAction(
                          () => onDeleteCategory(selectedCategory.id),
                          'Unable to delete category.'
                        ).then((succeeded) => {
                          if (succeeded) setIsManagerOpen(false)
                        })
                      }}
                      size="sm"
                      variant="ghost"
                    >
                      <Trash2 className="h-4 w-4" /> Delete
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </Modal>
    </>
  )
}
