import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!isOpen || !dialog) return
    if (!dialog.open) dialog.showModal()

    return () => {
      if (dialog.open) dialog.close()
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <dialog
      aria-labelledby={title ? titleId : undefined}
      className={cn(
        'animate-modal-in m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-surface-border bg-surface-overlay p-5 text-ink-primary shadow-2xl backdrop:bg-black/50',
        className
      )}
      onCancel={onClose}
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        ) {
          onClose()
        }
      }}
      ref={dialogRef}
    >
      {title ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium text-ink-primary" id={titleId}>
            {title}
          </h2>
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
    </dialog>
  )
}
