import type { TimerPhase } from '@/features/timer/stores/timerStore'

interface TimerControlsProps {
  phase: TimerPhase
  onStartWork: () => void
  onStopWork: () => void
  onSkipBreak: () => void
}

export function TimerControls({ phase, onStartWork, onStopWork, onSkipBreak }: TimerControlsProps) {
  if (phase === 'working') {
    return (
      <button
        className="rounded-lg border border-surface-border px-5 py-2 text-sm text-ink-primary transition hover:border-ink-secondary"
        onClick={onStopWork}
        type="button"
      >
        Done, take a break
      </button>
    )
  }

  if (phase === 'breaking') {
    return (
      <button
        className="text-sm text-ink-secondary transition hover:text-ink-primary"
        onClick={onSkipBreak}
        type="button"
      >
        Skip break
      </button>
    )
  }

  return (
    <button
      className="rounded-lg border border-ink-primary bg-ink-primary px-5 py-2 text-sm text-surface-base transition hover:opacity-90"
      onClick={onStartWork}
      type="button"
    >
      Start working
    </button>
  )
}
