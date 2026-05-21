import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { getSessionTaskName } from '@/lib/sessionSnapshot'
import type { SessionWithTask, TaskWithCategory } from '@/types'

export interface SessionEditValues {
  id: string
  taskId: string | null
  workSeconds: number
  breakSeconds: number
  startedAt: string
  endedAt: string
  notes: string | null
}

interface SessionEditModalProps {
  session: SessionWithTask | null
  tasks: TaskWithCategory[]
  isOpen: boolean
  isSaving: boolean
  error?: string | null
  onClose: () => void
  onSave: (values: SessionEditValues) => Promise<void> | void
}

function toLocalInputValue(isoString: string) {
  const date = new Date(isoString)
  const offsetMs = date.getTimezoneOffset() * 60 * 1000
  const local = new Date(date.getTime() - offsetMs)
  return local.toISOString().slice(0, 16)
}

function toIsoFromLocalInput(localValue: string) {
  return new Date(localValue).toISOString()
}

export function SessionEditModal({
  session,
  tasks,
  isOpen,
  isSaving,
  error,
  onClose,
  onSave,
}: SessionEditModalProps) {
  if (!session) return null

  const modalKey = `${session.id}:${isOpen ? 'open' : 'closed'}`

  return (
    <SessionEditModalContent
      error={error}
      isOpen={isOpen}
      isSaving={isSaving}
      key={modalKey}
      onClose={onClose}
      onSave={onSave}
      session={session}
      tasks={tasks}
    />
  )
}

interface SessionEditModalContentProps {
  session: SessionWithTask
  tasks: TaskWithCategory[]
  isOpen: boolean
  isSaving: boolean
  error?: string | null
  onClose: () => void
  onSave: (values: SessionEditValues) => Promise<void> | void
}

function SessionEditModalContent({
  session,
  tasks,
  isOpen,
  isSaving,
  error,
  onClose,
  onSave,
}: SessionEditModalContentProps) {
  const [taskId, setTaskId] = useState<string>(session.task_id ?? '')
  const [workMinutes, setWorkMinutes] = useState(
    String(Math.max(0, Math.round(session.work_seconds / 60)))
  )
  const [breakMinutes, setBreakMinutes] = useState(
    String(Math.max(0, Math.round(session.break_seconds / 60)))
  )
  const [notes, setNotes] = useState(session.notes ?? '')
  const [startedAt, setStartedAt] = useState(toLocalInputValue(session.started_at))
  const [endedAt, setEndedAt] = useState(toLocalInputValue(session.ended_at))
  const [validationError, setValidationError] = useState<string | null>(null)

  const currentTaskFallbackOption = useMemo(() => {
    if (!session.task_id) return null
    if (tasks.some((task) => task.id === session.task_id)) return null

    const fallbackTaskName = getSessionTaskName(session)
    if (!fallbackTaskName) return null

    return {
      id: session.task_id,
      name: `${fallbackTaskName} (not active)`,
    }
  }, [session, tasks])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit session">
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.1em] text-ink-tertiary">Task</p>
          <select
            className="h-10 w-full rounded-lg border border-surface-border bg-surface-overlay px-3 text-sm text-ink-primary outline-none transition focus:border-ink-secondary"
            onChange={(event) => setTaskId(event.target.value)}
            value={taskId}
          >
            <option value="">No task</option>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.name}
              </option>
            ))}
            {currentTaskFallbackOption ? (
              <option value={currentTaskFallbackOption.id}>{currentTaskFallbackOption.name}</option>
            ) : null}
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            inputMode="numeric"
            label="Work Minutes"
            min={0}
            onChange={(event) => setWorkMinutes(event.target.value)}
            type="number"
            value={workMinutes}
          />

          <Input
            inputMode="numeric"
            label="Break Minutes"
            min={0}
            onChange={(event) => setBreakMinutes(event.target.value)}
            type="number"
            value={breakMinutes}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Started"
            onChange={(event) => setStartedAt(event.target.value)}
            type="datetime-local"
            value={startedAt}
          />

          <Input
            label="Ended"
            onChange={(event) => setEndedAt(event.target.value)}
            type="datetime-local"
            value={endedAt}
          />
        </div>

        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.1em] text-ink-tertiary">Notes</p>
          <textarea
            className="min-h-[96px] w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-ink-primary outline-none transition focus:border-ink-secondary"
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional session notes"
            value={notes}
          />
        </div>

        {validationError ? <p className="text-sm text-red-300">{validationError}</p> : null}
        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <Button onClick={onClose} variant="ghost">
            Cancel
          </Button>
          <Button
            loading={isSaving}
            onClick={() => {
              const parsedWorkMinutes = Number(workMinutes)
              const parsedBreakMinutes = Number(breakMinutes)

              if (!Number.isFinite(parsedWorkMinutes) || parsedWorkMinutes < 0) {
                setValidationError('Work minutes must be zero or greater.')
                return
              }

              if (!Number.isFinite(parsedBreakMinutes) || parsedBreakMinutes < 0) {
                setValidationError('Break minutes must be zero or greater.')
                return
              }

              const startedIso = toIsoFromLocalInput(startedAt)
              const endedIso = toIsoFromLocalInput(endedAt)

              if (Number.isNaN(new Date(startedIso).getTime())) {
                setValidationError('Start time is invalid.')
                return
              }

              if (Number.isNaN(new Date(endedIso).getTime())) {
                setValidationError('End time is invalid.')
                return
              }

              if (new Date(endedIso).getTime() <= new Date(startedIso).getTime()) {
                setValidationError('End time must be after start time.')
                return
              }

              setValidationError(null)
              const normalizedNotes = notes.trim().length > 0 ? notes.trim() : null

              void onSave({
                id: session.id,
                taskId: taskId || null,
                workSeconds: Math.round(parsedWorkMinutes * 60),
                breakSeconds: Math.round(parsedBreakMinutes * 60),
                startedAt: startedIso,
                endedAt: endedIso,
                notes: normalizedNotes,
              })
            }}
            variant="filled"
          >
            Save changes
          </Button>
        </div>
      </div>
    </Modal>
  )
}
