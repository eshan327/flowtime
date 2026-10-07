import type { TimerPhase } from '@/features/timer/stores/timerStore'
import { Coffee } from 'lucide-react'
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
      <Button className="h-14 w-full max-w-sm text-lg" onClick={onStopWork} variant="filled">
        <Coffee className="h-5 w-5" />
        Done, take a break
      </Button>
    )
  }

  if (phase === 'breaking') {
    return (
      <Button className="h-14 w-full max-w-sm text-lg" onClick={onSkipBreak} variant="ghost">
        Skip break
      </Button>
    )
  }

  return (
    <Button
      className="h-14 w-full max-w-sm text-lg"
      disabled={!canStartWork}
      onClick={onStartWork}
      variant={canStartWork ? 'filled' : 'outlined'}
    >
      Start working
    </Button>
  )
}
