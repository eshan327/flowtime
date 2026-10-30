import { timerNow } from '@/features/timer/lib/serverClock'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useUser } from '@/context/UserContext'
import {
  useTimerCommandStatus,
  retryTimerCommands,
  discardTimerConflict,
} from '@/features/timer/hooks/useTimerSync'
import {
  predictTimer,
  type TimerJournalEntry,
  type LocalSegment,
} from '@/features/timer/lib/timerCommands'
import { commandFlowtime, readAllFlowtime, readFlowtime } from '@/lib/flowtimeApi'
import { queryClient } from '@/lib/queryClient'
import { queryKeys } from '@/lib/queryKeys'
import type { Session } from '@/types'

export function TimerRecovery() {
  const { user } = useUser()
  const { pending, conflicts } = useTimerCommandStatus()
  const [review, setReview] = useState<{
    entry: TimerJournalEntry
    segments: LocalSegment[]
    covered: number
    activeOverlap: boolean
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function inspect(entry: TimerJournalEntry) {
    setBusy(true)
    setError(null)
    try {
      let candidates = entry.segments
      if (!candidates.length && entry.after.phase === 'working')
        candidates = predictTimer(
          entry.after,
          { ...entry.input, action: 'stop_work', occurred_at: new Date(timerNow()).toISOString() },
          null,
          { breakDivisor: entry.after.runBreakDivisor ?? 5, focusModeLock: false }
        ).segments
      const serverTimer = await readFlowtime<{
        state: { phase: string; startedAt: string | null; runStartedAt?: string }
      }>('timer')
      let activeOverlap = false
      const remainder: LocalSegment[] = []
      let covered = 0
      for (const candidate of candidates) {
        if (
          serverTimer.state.phase === 'working' &&
          Date.parse(serverTimer.state.runStartedAt ?? serverTimer.state.startedAt ?? '') <
            Date.parse(candidate.ended_at)
        )
          activeOverlap = true
        const existing = await readAllFlowtime<Session>('sessions', {
          from: candidate.started_at,
          to: candidate.ended_at,
          trash: 'include',
        })
        let intervals = [
          { start: Date.parse(candidate.started_at), end: Date.parse(candidate.ended_at) },
        ]
        for (const saved of existing) {
          const a = Date.parse(saved.started_at),
            b = Date.parse(saved.ended_at)
          intervals = intervals.flatMap((part) =>
            b <= part.start || a >= part.end
              ? [part]
              : [
                  { start: part.start, end: Math.min(a, part.end) },
                  { start: Math.max(b, part.start), end: part.end },
                ].filter((p) => p.end > p.start)
          )
        }
        covered +=
          candidate.work_seconds -
          intervals.reduce((sum, p) => sum + Math.floor((p.end - p.start) / 1000), 0)
        remainder.push(
          ...intervals
            .map((p) => ({
              ...candidate,
              id: crypto.randomUUID(),
              started_at: new Date(p.start).toISOString(),
              ended_at: new Date(p.end).toISOString(),
              work_seconds: Math.floor((p.end - p.start) / 1000),
              break_seconds: 0,
            }))
            .filter((p) => p.work_seconds > 0)
        )
      }
      setReview({ entry, segments: remainder, covered, activeOverlap })
    } catch (e) {
      setError(e instanceof Error ? e.message : (e as { message: string }).message)
    } finally {
      setBusy(false)
    }
  }
  async function importWork() {
    if (!review || !user) return
    setBusy(true)
    setError(null)
    try {
      await commandFlowtime(
        'sessions',
        {
          operations: review.segments.map(({ task_name: _taskName, ...s }) => ({
            ...s,
            action: 'create',
            notes: 'Recovered offline work, reviewed and entered manually.',
          })),
        },
        review.entry.id
      )
      discardTimerConflict(review.entry)
      setReview(null)
      await queryClient.invalidateQueries({ queryKey: queryKeys.sessions(user.id) })
    } catch (e) {
      setError((e as { message: string }).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="mt-4 w-full space-y-2 text-sm">
      {pending > 0 ? (
        <p role="status">
          {pending} timer {pending === 1 ? 'action' : 'actions'} saved on this device.{' '}
          <Button size="sm" variant="ghost" onClick={() => void retryTimerCommands()}>
            Retry sync
          </Button>
        </p>
      ) : null}
      {conflicts.map((entry) => (
        <div className="rounded-lg border border-amber-700/50 p-3" key={entry.id}>
          <p>Offline work needs review: {entry.conflict}</p>
          <Button size="sm" loading={busy} onClick={() => void inspect(entry)}>
            Compare with saved history
          </Button>
        </div>
      ))}
      {error ? (
        <p role="alert" className="text-red-300">
          {error}
        </p>
      ) : null}
      <Modal isOpen={!!review} onClose={() => setReview(null)} title="Review offline work">
        {review ? (
          <div className="space-y-4">
            <p>
              The server timer is authoritative. {review.covered} seconds are already represented in
              saved history and will not be imported again.
            </p>
            {review.segments.map((s) => (
              <p key={s.id}>
                {s.task_name ?? 'Work'}: {new Date(s.started_at).toLocaleString()} –{' '}
                {new Date(s.ended_at).toLocaleString()} ({s.work_seconds} seconds).
              </p>
            ))}
            <p>
              Import only work you actually performed. Recovery creates marked manual entries; it
              does not rewrite saved attribution. Use History to correct an existing entry.
            </p>
            {review.activeOverlap ? (
              <p role="alert">
                Stop the server timer before importing overlapping local work, then compare again.
              </p>
            ) : null}
            {review.segments.length && !review.activeOverlap ? (
              <Button loading={busy} onClick={() => void importWork()}>
                Confirm and import listed work
              </Button>
            ) : null}
            <Button
              variant="outlined"
              onClick={() => {
                if (window.confirm('Discard this local action and keep saved server history?')) {
                  discardTimerConflict(review.entry)
                  setReview(null)
                }
              }}
            >
              Keep server history and discard local action
            </Button>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
