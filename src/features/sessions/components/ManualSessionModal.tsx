import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useUser } from '@/context/UserContext'
import { useTimerSettingsStore } from '@/features/timer/stores/timerSettingsStore'
import { fromZonedInput } from '@/lib/timezone'
import { commandFlowtime } from '@/lib/flowtimeApi'
import { queryKeys } from '@/lib/queryKeys'
import type { TaskWithCategory } from '@/types'
export function ManualSessionModal({
  tasks,
  onClose,
}: {
  tasks: TaskWithCategory[]
  onClose: () => void
}) {
  const { user } = useUser(),
    client = useQueryClient(),
    [timezone] = useState(() => useTimerSettingsStore.getState().timezone)
  const [task, setTask] = useState(''),
    [start, setStart] = useState(''),
    [end, setEnd] = useState(''),
    [work, setWork] = useState(''),
    [notes, setNotes] = useState('')
  const [id] = useState(() => crypto.randomUUID())
  const save = useMutation({
    mutationFn: async () => {
      const started = fromZonedInput(start.length === 16 ? start + ':00' : start, timezone),
        ended = fromZonedInput(end.length === 16 ? end + ':00' : end, timezone)
      await commandFlowtime(
        'sessions',
        {
          operations: [
            {
              action: 'create',
              id,
              task_id: task || null,
              started_at: started.toISOString(),
              ended_at: ended.toISOString(),
              work_seconds: Math.round(Number(work) * 60),
              break_seconds: 0,
              notes: notes.trim() || null,
            },
          ],
        },
        id
      )
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: queryKeys.sessions(user?.id) })
      onClose()
    },
  })
  return (
    <Modal isOpen onClose={onClose} title="Add a manual session">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate()
        }}
      >
        <p className="text-sm text-ink-secondary">
          Record work you actually performed. Times use {timezone}; this entry will be marked
          manual.
        </p>
        <label className="block text-sm">
          Task
          <select
            className="ml-3 rounded border border-surface-border bg-surface-panel p-2"
            value={task}
            onChange={(e) => setTask(e.target.value)}
          >
            <option value="">No task</option>
            {tasks.map((t) => (
              <option value={t.id} key={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <Input
          label="Started"
          type="datetime-local"
          required
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
        <Input
          label="Ended"
          type="datetime-local"
          required
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
        <Input
          label="Work minutes"
          type="number"
          min={0}
          step="any"
          required
          value={work}
          onChange={(e) => setWork(e.target.value)}
        />
        <label className="block text-sm">
          Notes
          <textarea
            className="mt-2 w-full rounded border border-surface-border bg-surface-panel p-2"
            maxLength={4000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        {save.error ? (
          <p className="text-red-300" role="alert">
            {save.error.message}
          </p>
        ) : null}
        <Button type="submit" loading={save.isPending}>
          Record this work
        </Button>
      </form>
    </Modal>
  )
}
