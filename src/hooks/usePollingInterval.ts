import { useSyncExternalStore } from 'react'
import { focusManager, onlineManager } from '@tanstack/react-query'

export function usePollingInterval(delay: number) {
  const visible = useSyncExternalStore(focusManager.subscribe, () => focusManager.isFocused())
  const online = useSyncExternalStore(onlineManager.subscribe, () => onlineManager.isOnline())
  return visible && online ? delay : false
}
