export interface CommandState {
  phase: 'idle' | 'working' | 'breaking' | 'done'
  selectedTaskId: string | null
  selectedTaskName?: string | null
  selectedTaskColor?: string | null
  selectedCategoryId?: string | null
  selectedCategoryName?: string | null
  selectedCategoryColor?: string | null
  startedAt: string | null
  breakEndAt: string | null
  workSeconds: number
  breakTotal: number
  runawayDetected: boolean
  sessionId?: string | null
  runId?: string | null
  runStartedAt?: string | null
  segmentStartedAt?: string | null
  completedWorkSeconds?: number
  runBreakDivisor?: number | null
  updatedAt?: string | null
  protocolVersion?: number
}
export type TimerAction =
  | 'select_task'
  | 'start_work'
  | 'stop_work'
  | 'skip_break'
  | 'finish_break'
  | 'acknowledge_runaway'
export interface TimerCommand {
  action: TimerAction
  expected_revision: string | null
  next_revision: string
  occurred_at: string
  task_id?: string | null
}
export interface LocalSegment {
  id: string
  task_id: string | null
  task_name: string | null
  started_at: string
  ended_at: string
  work_seconds: number
  break_seconds: number
}
export interface TimerJournalEntry {
  id: string
  userId: string
  queuedAt: string
  input: TimerCommand
  before: CommandState
  after: CommandState
  segments: LocalSegment[]
  conflict?: string
}

// Mirrors the authoritative SQL transitions so offline actions retain the same segment IDs and rounding.
export function predictTimer(
  before: CommandState,
  command: TimerCommand,
  task: Partial<CommandState> | null,
  settings: { breakDivisor: number; focusModeLock: boolean }
) {
  const state = { ...before },
    segments: LocalSegment[] = []
  const at = Date.parse(command.occurred_at)
  state.completedWorkSeconds ??= 0
  state.runBreakDivisor ??= settings.breakDivisor
  state.runStartedAt ??= state.startedAt ?? command.occurred_at
  state.segmentStartedAt ??= state.startedAt ?? command.occurred_at
  function save(end: number) {
    const prior = state.completedWorkSeconds ?? 0
    const seconds = Math.max(
      0,
      Math.min(21600 - prior, Math.floor((end - Date.parse(state.runStartedAt!)) / 1000) - prior)
    )
    if (seconds)
      segments.push({
        id: state.sessionId!,
        task_id: state.selectedTaskId,
        task_name: state.selectedTaskName ?? null,
        started_at: state.segmentStartedAt!,
        ended_at: new Date(end).toISOString(),
        work_seconds: seconds,
        break_seconds:
          Math.floor((prior + seconds) / state.runBreakDivisor!) -
          Math.floor(prior / state.runBreakDivisor!),
      })
    state.completedWorkSeconds = prior + seconds
    return state.completedWorkSeconds
  }
  if (state.phase === 'working' && at - Date.parse(state.runStartedAt) >= 21600000) {
    save(Date.parse(state.runStartedAt) + 21600000)
    Object.assign(state, {
      phase: 'done',
      workSeconds: 21600,
      completedWorkSeconds: 21600,
      breakTotal: Math.floor(21600 / state.runBreakDivisor),
      breakEndAt: null,
      runawayDetected: true,
    })
  }
  if (state.phase === 'breaking' && at >= Date.parse(state.breakEndAt!))
    Object.assign(state, { phase: 'done', breakEndAt: null })
  if (command.action === 'select_task' || command.action === 'start_work') {
    if (state.phase === 'working' && settings.focusModeLock)
      throw new Error('Focus lock prevents switching tasks while working.')
    if (command.action === 'start_work') {
      if (!['idle', 'done'].includes(state.phase) || state.runawayDetected)
        throw new Error('Finish or skip the break before starting.')
      if (!(task?.selectedTaskId ?? state.selectedTaskId))
        throw new Error('Select an available task.')
      Object.assign(state, task ?? {}, {
        phase: 'working',
        sessionId: command.next_revision,
        runId: command.next_revision,
        runStartedAt: command.occurred_at,
        startedAt: command.occurred_at,
        segmentStartedAt: command.occurred_at,
        completedWorkSeconds: 0,
        workSeconds: 0,
        runBreakDivisor: settings.breakDivisor,
        breakEndAt: null,
        breakTotal: 0,
        runawayDetected: false,
      })
    } else {
      if (state.phase === 'working' && !task?.selectedTaskId)
        throw new Error('Choose a task while working.')
      if (state.phase === 'working' && state.selectedTaskId !== task?.selectedTaskId) {
        save(at)
        state.sessionId = command.next_revision
        state.segmentStartedAt = command.occurred_at
      }
      Object.assign(
        state,
        task ?? {
          selectedTaskId: null,
          selectedTaskName: null,
          selectedTaskColor: null,
          selectedCategoryId: null,
          selectedCategoryName: null,
          selectedCategoryColor: null,
        }
      )
    }
  } else if (command.action === 'stop_work') {
    if (state.phase === 'working') {
      const total = save(at),
        duration = Math.floor(total / state.runBreakDivisor)
      Object.assign(state, {
        phase: duration ? 'breaking' : 'done',
        workSeconds: total,
        breakTotal: duration,
        breakEndAt: duration ? new Date(at + duration * 1000).toISOString() : null,
      })
    } else if (!state.runawayDetected) throw new Error('The timer is not working.')
  } else if (command.action === 'skip_break') {
    if (state.phase === 'working') throw new Error('Stop work before skipping a break.')
    Object.assign(state, {
      phase: 'idle',
      breakEndAt: null,
      breakTotal: 0,
      workSeconds: 0,
      startedAt: null,
    })
  } else if (command.action === 'acknowledge_runaway') state.runawayDetected = false
  else if (command.action === 'finish_break' && state.phase === 'breaking')
    throw new Error('The break has not ended.')
  state.updatedAt = command.occurred_at
  state.protocolVersion = 2
  return { state, segments }
}
const prefix = 'flowtime-command-v2:'
export function readTimerJournal(userId: string): TimerJournalEntry[] {
  const result: TimerJournalEntry[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(prefix + userId + ':')) result.push(JSON.parse(localStorage.getItem(key)!))
  }
  const sorted = result.sort(
    (a, b) => a.queuedAt.localeCompare(b.queuedAt) || a.id.localeCompare(b.id)
  )
  const ordered: TimerJournalEntry[] = []
  const visit = (entry: TimerJournalEntry, seen = new Set<string>()) => {
    if (ordered.some((e) => e.id === entry.id) || seen.has(entry.id)) return
    seen.add(entry.id)
    const parent = sorted.find((e) => e.input.next_revision === entry.input.expected_revision)
    if (parent) visit(parent, seen)
    ordered.push(entry)
  }
  for (const entry of sorted) visit(entry)
  return ordered
}
export function storeTimerCommand(entry: TimerJournalEntry) {
  localStorage.setItem(prefix + entry.userId + ':' + entry.id, JSON.stringify(entry))
}
export function removeTimerCommand(entry: TimerJournalEntry) {
  localStorage.removeItem(prefix + entry.userId + ':' + entry.id)
}
