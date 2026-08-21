import type { TimerPhase } from '@/features/timer/stores/timerStore'
import { Button } from '@/components/ui/Button'

interface TimerControlsProps {
  phase: TimerPhase
  canStartWork: boolean
  onStartWork: () => void
  onStopWork: () => void
  onSkipBreak: () => void
}

export function TimerControls({
  phase,
  canStartWork,
  onStartWork,
  onStopWork,
  onSkipBreak,
}: TimerControlsProps) {
  if (phase === 'working') {
    return (
      <Button className="h-11 min-w-44 text-base" onClick={onStopWork} variant="outlined">
        Done, take a break
      </Button>
    )
  }

  if (phase === 'breaking') {
    return (
      <Button className="h-11 min-w-44 text-base" onClick={onSkipBreak} variant="ghost">
        Skip break
      </Button>
    )
  }

  return (
    <Button
      className="h-11 min-w-44 text-base"
      disabled={!canStartWork}
      onClick={onStartWork}
      variant={canStartWork ? 'filled' : 'outlined'}
    >
      Start working
    </Button>
  )
}
