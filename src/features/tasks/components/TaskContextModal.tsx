import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useTasks } from '@/features/tasks/hooks/useTasks'
import type { TaskWithCategory } from '@/types'
export function TaskContextModal({
  task,
  onClose,
}: {
  task: TaskWithCategory
  onClose: () => void
}) {
  const [initial] = useState(task)
  const [notes, setNotes] = useState(task.notes ?? ''),
    [due, setDue] = useState(task.due_date ?? ''),
    [priority, setPriority] = useState(task.priority ?? ''),
    [url, setUrl] = useState(task.reference_url ?? '')
  const { updateTask } = useTasks()
  return (
    <Modal isOpen onClose={onClose} title={task.name}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          const changes = {
            ...(notes !== (initial.notes ?? '') ? { notes: notes.trim() || null } : {}),
            ...(due !== (initial.due_date ?? '') ? { due_date: due || null } : {}),
            ...(priority !== (initial.priority ?? '') ? { priority: priority || null } : {}),
            ...(url !== (initial.reference_url ?? '') ? { reference_url: url.trim() || null } : {}),
          }
          if (!Object.keys(changes).length) {
            onClose()
            return
          }
          void updateTask
            .mutateAsync({ id: task.id, ...changes })
            .then(onClose)
            .catch(() => {})
        }}
      >
        <label className="block text-sm">
          Notes
          <textarea
            className="mt-2 min-h-28 w-full rounded-lg border border-surface-border bg-surface-panel p-3"
            maxLength={4000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <Input label="Due date" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        <label className="block text-sm">
          Priority
          <select
            aria-label="Priority"
            className="ml-3 rounded border border-surface-border bg-surface-panel p-2"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="">None</option>
            {['low', 'normal', 'high'].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <Input
          label="Reference URL"
          type="url"
          maxLength={2000}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
        />
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
            Save details
          </Button>
        </div>
      </form>
    </Modal>
  )
}
