import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
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
      aria-labelledby={titleId}
      className={cn(
        'animate-modal-in m-auto max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-[6px] border border-surface-border bg-surface-panel p-5 text-ink-primary shadow-2xl backdrop:bg-black/65',
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
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-lg font-medium text-ink-primary" id={titleId}>
          {title}
        </h2>
        <button
          aria-label="Close modal"
          className="rounded-lg p-1.5 text-ink-tertiary transition-colors duration-150 hover:bg-surface-hover hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
          onClick={onClose}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {children}
    </dialog>
  )
}
