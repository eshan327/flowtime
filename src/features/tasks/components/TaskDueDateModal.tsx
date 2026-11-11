import { useEffect, useRef, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useTasks } from '@/features/tasks/hooks/useTasks'
import type { TaskWithCategory } from '@/types'
export function TaskDueDateModal({
  task,
  onClose,
}: {
  task: TaskWithCategory
  onClose: () => void
}) {
  const [initialDueDate] = useState(task.due_date ?? '')
  const [due, setDue] = useState(initialDueDate)
  const { updateTask } = useTasks()
  const dueInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    dueInputRef.current?.focus()
  }, [])
  return (
    <Modal isOpen onClose={onClose} title="Due date">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (due === initialDueDate) {
            onClose()
            return
          }
          void updateTask
            .mutateAsync({ id: task.id, due_date: due || null })
            .then(onClose)
            .catch(() => {})
        }}
      >
        <p className="break-words text-sm text-ink-secondary">{task.name}</p>
        <div className="flex items-end gap-2">
          <Input
            ref={dueInputRef}
            disabled={updateTask.isPending}
            label="Due date (optional)"
            max="9999-12-31"
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
          {due ? (
            <Button
              className="shrink-0 text-ink-tertiary"
              disabled={updateTask.isPending}
              onClick={() => setDue('')}
              variant="ghost"
            >
              Remove
            </Button>
          ) : null}
        </div>
        {updateTask.error ? (
          <p role="alert" className="text-red-300">
            {updateTask.error.message}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={updateTask.isPending}>
            Save date
          </Button>
        </div>
      </form>
    </Modal>
  )
}
