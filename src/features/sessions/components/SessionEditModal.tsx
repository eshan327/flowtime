import { useTimerSettingsStore } from '@/features/timer/stores/timerSettingsStore'
import { zonedInput, fromZonedInput } from '@/lib/timezone'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { snapshotSession } from '@/lib/sessionSnapshot'
import type { SessionWithTask, TaskWithCategory } from '@/types'

export interface SessionEditValues {
  id: string
  taskId: string | null
  taskChanged: boolean
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

function toLocalInputValue(isoString: string, timezone: string) {
  return zonedInput(isoString, timezone)
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
  const [timezone] = useState(() => useTimerSettingsStore.getState().timezone)
  const [taskChanged, setTaskChanged] = useState(false)
  const initialTaskId = session.task_id ?? snapshotSession(session).taskIdSnapshot
  const [taskId, setTaskId] = useState<string>(initialTaskId ?? '')
  const [workMinutes, setWorkMinutes] = useState(
    String(Math.max(0, Number((session.work_seconds / 60).toFixed(2))))
  )
  const [breakMinutes, setBreakMinutes] = useState(
    String(Math.max(0, Number((session.break_seconds / 60).toFixed(2))))
  )
  const [notes, setNotes] = useState(session.notes ?? '')
  const [startedAt, setStartedAt] = useState(toLocalInputValue(session.started_at, timezone))
  const [endedAt, setEndedAt] = useState(toLocalInputValue(session.ended_at, timezone))
  const [validationError, setValidationError] = useState<string | null>(null)

  const currentTaskFallbackOption = useMemo(() => {
    if (!initialTaskId) return null
    if (tasks.some((task) => task.id === initialTaskId)) return null

    const fallbackTaskName = snapshotSession(session).taskNameSnapshot
    if (!fallbackTaskName) return null

    return {
      id: initialTaskId,
      name: `${fallbackTaskName} (not active)`,
    }
  }, [session, tasks, initialTaskId])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit session">
      <div className="space-y-4">
        <p className="text-xs text-ink-secondary">
          Times shown in {timezone}. Unchanged timestamps retain their exact original instant.
        </p>
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.1em] text-ink-tertiary">Task</p>
          <select
            className="h-10 w-full rounded-lg border border-surface-border-subtle bg-surface-sidebar px-3 text-sm text-ink-primary outline-none transition-colors focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/15"
            onChange={(event) => {
              setTaskId(event.target.value)
              setTaskChanged(true)
            }}
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
            step="any"
            onChange={(event) => setWorkMinutes(event.target.value)}
            type="number"
            value={workMinutes}
          />

          <Input
            inputMode="numeric"
            label="Break Minutes"
            min={0}
            step="any"
            onChange={(event) => setBreakMinutes(event.target.value)}
            type="number"
            value={breakMinutes}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Started"
            step="0.001"
            onChange={(event) => setStartedAt(event.target.value)}
            type="datetime-local"
            value={startedAt}
          />

          <Input
            label="Ended"
            step="0.001"
            onChange={(event) => setEndedAt(event.target.value)}
            type="datetime-local"
            value={endedAt}
          />
        </div>

        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.1em] text-ink-tertiary">Notes</p>
          <textarea
            className="min-h-[96px] w-full rounded-lg border border-surface-border-subtle bg-surface-sidebar px-3 py-2 text-sm text-ink-primary outline-none transition-colors focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/15"
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

              let parsedStart: Date, parsedEnd: Date
              try {
                parsedStart =
                  startedAt === toLocalInputValue(session.started_at, timezone)
                    ? new Date(session.started_at)
                    : fromZonedInput(
                        startedAt.length === 16 ? startedAt + ':00' : startedAt,
                        timezone
                      )
                parsedEnd =
                  endedAt === toLocalInputValue(session.ended_at, timezone)
                    ? new Date(session.ended_at)
                    : fromZonedInput(endedAt.length === 16 ? endedAt + ':00' : endedAt, timezone)
              } catch (error) {
                setValidationError((error as Error).message)
                return
              }

              if (Number.isNaN(parsedStart.getTime())) {
                setValidationError('Start time is invalid.')
                return
              }

              if (Number.isNaN(parsedEnd.getTime())) {
                setValidationError('End time is invalid.')
                return
              }

              if (parsedEnd.getTime() <= parsedStart.getTime()) {
                setValidationError('End time must be after start time.')
                return
              }

              setValidationError(null)
              const normalizedNotes = notes.trim().length > 0 ? notes.trim() : null

              void onSave({
                id: session.id,
                taskId: taskId || null,
                taskChanged,
                workSeconds: Math.round(parsedWorkMinutes * 60),
                breakSeconds: Math.round(parsedBreakMinutes * 60),
                startedAt:
                  startedAt === toLocalInputValue(session.started_at, timezone)
                    ? session.started_at
                    : parsedStart.toISOString(),
                endedAt:
                  endedAt === toLocalInputValue(session.ended_at, timezone)
                    ? session.ended_at
                    : parsedEnd.toISOString(),
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
