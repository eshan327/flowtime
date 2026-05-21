import { useEffect } from 'react'
import type { TimerPhase } from '@/features/timer/stores/timerStore'

interface UseTimerKeyboardShortcutsOptions {
  enabled: boolean
  phase: TimerPhase
  canStartWork: boolean
  canReplaySession: boolean
  overlaysOpen: boolean
  onStartWork: () => void
  onStopWork: () => void
  onSkipBreak: () => void
  onReplaySession: () => void
  onOpenSettings: () => void
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  const tagName = target.tagName.toLowerCase()
  return (
    target.isContentEditable ||
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select'
  )
}

export function useTimerKeyboardShortcuts({
  enabled,
  phase,
  canStartWork,
  canReplaySession,
  overlaysOpen,
  onStartWork,
  onStopWork,
  onSkipBreak,
  onReplaySession,
  onOpenSettings,
}: UseTimerKeyboardShortcutsOptions) {
  useEffect(() => {
    if (!enabled) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isTypingTarget(event.target)) return

      const key = event.key.toLowerCase()

      if (key === ',') {
        event.preventDefault()
        onOpenSettings()
        return
      }

      if (overlaysOpen) {
        return
      }

      if (key === 's' && phase !== 'working' && phase !== 'breaking' && canStartWork) {
        event.preventDefault()
        onStartWork()
        return
      }

      if (key === 'd' && phase === 'working') {
        event.preventDefault()
        onStopWork()
        return
      }

      if (key === 'b' && phase === 'breaking') {
        event.preventDefault()
        onSkipBreak()
        return
      }

      if (key === 'r' && phase === 'done' && canReplaySession) {
        event.preventDefault()
        onReplaySession()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    canReplaySession,
    canStartWork,
    enabled,
    onOpenSettings,
    onReplaySession,
    onSkipBreak,
    onStartWork,
    onStopWork,
    overlaysOpen,
    phase,
  ])
}
