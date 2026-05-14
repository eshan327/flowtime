import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
}

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => !element.hasAttribute('disabled'))
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen || !panelRef.current) return

    const activeElement = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const focusable = getFocusableElements(panel)
    const first = focusable[0]

    ;(first ?? panel).focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab') return

      const elements = getFocusableElements(panel)
      if (elements.length === 0) {
        event.preventDefault()
        panel.focus()
        return
      }

      const firstElement = elements[0]
      const lastElement = elements[elements.length - 1]

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      }

      if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      activeElement?.focus()
    }
  }, [isOpen, onClose])

  if (!isOpen || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
      role="presentation"
    >
      <div
        aria-modal="true"
        className={cn(
          'animate-modal-in w-full max-w-md rounded-xl border border-surface-border bg-surface-overlay p-5 shadow-2xl',
          className
        )}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        {title ? (
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-medium text-ink-primary">{title}</h2>
            <button
              aria-label="Close modal"
              className="rounded p-1 text-ink-tertiary transition hover:text-ink-primary"
              onClick={onClose}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </div>,
    document.body
  )
}
