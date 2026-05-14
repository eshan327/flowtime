import type { TimerPhase } from '@/features/timer/stores/timerStore'
import { Button } from '@/components/ui/Button'

interface TimerControlsProps {
  phase: TimerPhase
  onStartWork: () => void
  onStopWork: () => void
  onSkipBreak: () => void
}

export function TimerControls({ phase, onStartWork, onStopWork, onSkipBreak }: TimerControlsProps) {
  if (phase === 'working') {
    return (
      <Button onClick={onStopWork} variant="outlined">
        Done, take a break
      </Button>
    )
  }

  if (phase === 'breaking') {
    return (
      <Button onClick={onSkipBreak} variant="ghost">
        Skip break
      </Button>
    )
  }

  return (
    <Button onClick={onStartWork} variant="filled">
      Start working
    </Button>
  )
}
