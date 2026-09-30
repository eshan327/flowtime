import { useEffect, useState } from 'react'
import { createTimerSync, timerSnapshot } from '@/features/timer/lib/timerSync'
import { createInitialTimerState, useTimerStore } from '@/features/timer/stores/timerStore'
import { queryClient } from '@/lib/queryClient'
import { queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/lib/supabaseClient'
import type { Json } from '@/types/supabase'

function restoreSnapshot(snapshot: string, userId: string) {
  const data: Record<string, unknown> = JSON.parse(snapshot)
  const initial = createInitialTimerState()
  const restored = { ...initial, ownerUserId: userId }
  for (const key of Object.keys(initial) as (keyof typeof initial)[]) {
    if (key === 'ownerUserId' || key === 'syncRevision' || key === 'syncPending') continue
    const value = data[key]
    if (key === 'startedAt' || key === 'breakEndAt') {
      const date = typeof value === 'string' ? new Date(value) : null
      if (date && Number.isNaN(date.getTime())) throw new Error('Invalid timer timestamp')
      restored[key] = date
    } else {
      if (key === 'phase' && !['idle', 'working', 'breaking', 'done'].includes(String(value))) {
        throw new Error('Invalid timer phase')
      }
      if (
        typeof initial[key] === 'number' &&
        (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
      ) {
        throw new Error('Invalid timer duration')
      }
      if (initial[key] === null && value !== null && typeof value !== 'string') {
        throw new Error('Invalid timer task')
      }
      if (typeof initial[key] === 'boolean' && typeof value !== 'boolean') {
        throw new Error('Invalid timer flag')
      }
      Object.assign(restored, { [key]: value })
    }
  }
  if (restored.phase === 'working' && !restored.startedAt) throw new Error('Missing timer start')
  if (restored.phase === 'breaking' && !restored.breakEndAt) throw new Error('Missing break end')
  if (restored.phase === 'working' && restored.startedAt) {
    restored.workSeconds = Math.max(
      0,
      Math.floor((Date.now() - restored.startedAt.getTime()) / 1000)
    )
  }
  return restored
}

export function useTimerSync(userId: string | undefined) {
  const [status, setStatus] = useState<{ userId?: string; ready: boolean; error: unknown }>({
    ready: false,
    error: null,
  })

  useEffect(() => {
    if (!userId) return
    let applying = false
    const controller = createTimerSync({
      getLocal: () => {
        const state = useTimerStore.getState()
        return {
          snapshot: timerSnapshot(state as unknown as Record<string, unknown>),
          revision: state.syncRevision,
          pending: state.syncPending,
        }
      },
      setLocal: (timer) => {
        const taskChanged =
          useTimerStore.getState().selectedTaskId !== JSON.parse(timer.snapshot).selectedTaskId
        const restored = restoreSnapshot(timer.snapshot, userId)
        applying = true
        try {
          useTimerStore.setState({
            ...restored,
            syncRevision: timer.revision,
            syncPending: timer.pending,
          })
        } finally {
          applying = false
        }
        if (taskChanged) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.tasks(userId) })
          void queryClient.invalidateQueries({ queryKey: queryKeys.categories(userId) })
        }
      },
      read: async () => {
        const { data, error } = await supabase
          .from('active_timers')
          .select('state, revision')
          .eq('user_id', userId)
          .maybeSingle()
        if (error) throw error
        return data
          ? { snapshot: JSON.stringify(data.state), revision: data.revision, pending: false }
          : null
      },
      write: async (timer, expectedRevision) => {
        const row = {
          user_id: userId,
          state: JSON.parse(timer.snapshot) as Json,
          revision: timer.revision!,
        }
        const query = expectedRevision
          ? supabase
              .from('active_timers')
              .update(row)
              .eq('user_id', userId)
              .eq('revision', expectedRevision)
          : supabase
              .from('active_timers')
              .upsert(row, { onConflict: 'user_id', ignoreDuplicates: true })
        const { data, error } = await query.select('revision')
        if (error) throw error
        return data.length > 0
      },
      onStatus: (error) => setStatus({ userId, ready: true, error }),
    })
    const unsubscribe = useTimerStore.subscribe((state, previous) => {
      if (applying || state.ownerUserId !== userId) return
      if (
        timerSnapshot(state as unknown as Record<string, unknown>) ===
        timerSnapshot(previous as unknown as Record<string, unknown>)
      )
        return
      useTimerStore.setState({ syncPending: true })
      void controller.sync()
    })
    const resume = () => {
      if (document.visibilityState === 'visible') void controller.sync()
    }
    // ponytail: poll every 3 seconds; use Realtime if instant propagation or traffic warrants it.
    const interval = window.setInterval(resume, 3000)
    window.addEventListener('online', resume)
    window.addEventListener('focus', resume)
    document.addEventListener('visibilitychange', resume)
    void controller.sync()
    return () => {
      controller.stop()
      unsubscribe()
      window.clearInterval(interval)
      window.removeEventListener('online', resume)
      window.removeEventListener('focus', resume)
      document.removeEventListener('visibilitychange', resume)
    }
  }, [userId])

  return {
    timerReady: status.userId === userId && status.ready,
    timerSyncError: status.userId === userId ? status.error : null,
  }
}
