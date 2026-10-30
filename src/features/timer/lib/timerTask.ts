import type { TimerState } from '../stores/timerStore'
import type { TaskWithCategory } from '../../../types'

type TaskSnapshot = Pick<
  TimerState,
  'phase' | 'runawayDetected' | 'selectedTaskId' | 'selectedTaskName' | 'selectedTaskColor'
>

export function resolveTimerTask(timer: TaskSnapshot, task: TaskWithCategory | undefined) {
  if (task) {
    return { id: task.id, name: task.name, color: task.categories?.color ?? task.color }
  }
  // Keep attribution visible until running or recovered work has been saved.
  if ((timer.phase === 'working' || timer.runawayDetected) && timer.selectedTaskId) {
    return {
      id: timer.selectedTaskId,
      name: timer.selectedTaskName,
      color: timer.selectedTaskColor,
    }
  }
  return null
}
