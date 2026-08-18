import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { Category } from '@/types'

interface ArchivedCategoriesSectionProps {
  categories: Category[]
  isExpanded: boolean
  onToggle: () => void
  onRestoreCategory: (id: string) => Promise<void> | void
  onDeleteCategory: (id: string) => Promise<void> | void
}

export function ArchivedCategoriesSection({
  categories,
  isExpanded,
  onToggle,
  onRestoreCategory,
  onDeleteCategory,
}: ArchivedCategoriesSectionProps) {
  return (
    <section
      className={
        isExpanded
          ? 'rounded-xl bg-surface-panel p-4'
          : 'border-t border-surface-border-subtle pt-3'
      }
    >
      <Button
        className="h-auto w-full justify-between px-1 text-sm"
        onClick={onToggle}
        size="sm"
        variant="ghost"
      >
        <span>Archived categories ({categories.length})</span>
        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </Button>

      {isExpanded ? (
        categories.length === 0 ? (
          <p className="mt-2 text-sm text-ink-tertiary">No archived categories in this range.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {categories.map((category) => (
              <div
                className="flex items-center justify-between gap-2 border-b border-surface-border-subtle px-1 py-3"
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
                      await onRestoreCategory(category.id)
                    }}
                    size="sm"
                    variant="ghost"
                  >
                    Restore
                  </Button>

                  <Button
                    className="text-red-300 hover:text-red-200"
                    onClick={async () => {
                      const confirmed = window.confirm(
                        `Delete ${category.name} permanently? Its tasks will become uncategorized.`
                      )
                      if (!confirmed) return

                      await onDeleteCategory(category.id)
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
  )
}
