import { useEffect, useState } from 'react'
import { createTimerSync } from '@/features/timer/lib/timerSync'
import { sanitizeSettings, useTimerSettingsStore } from '@/features/timer/stores/timerSettingsStore'
import { supabase } from '@/lib/supabaseClient'

export function useTimerSettingsSync(userId: string | undefined) {
  const [status, setStatus] = useState<{ userId?: string; ready: boolean; error: unknown }>({
    ready: false,
    error: null,
  })

  useEffect(() => {
    if (!userId) return
    useTimerSettingsStore.getState().initializeForUser(userId)
    let applying = false
    const controller = createTimerSync({
      getLocal: () => {
        const state = useTimerSettingsStore.getState()
        return {
          snapshot: JSON.stringify(sanitizeSettings({ ...state })),
          revision: state.syncRevision,
          pending: state.syncPending,
        }
      },
      setLocal: (settings) => {
        if (useTimerSettingsStore.getState().ownerUserId !== userId) return
        applying = true
        try {
          useTimerSettingsStore.setState({
            ...sanitizeSettings(JSON.parse(settings.snapshot)),
            syncRevision: settings.revision,
            syncPending: settings.pending,
          })
        } finally {
          applying = false
        }
      },
      read: async () => {
        const { data, error } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle()
        if (error) throw error
        return data
          ? {
              snapshot: JSON.stringify(
                sanitizeSettings({
                  timezone: data.timezone,
                  breakDivisor: data.break_divisor,
                  chimeEnabled: data.chime_enabled,
                  chimeId: data.chime_id,
                  focusModeLock: data.focus_mode_lock,
                  shortcutsEnabled: data.shortcuts_enabled,
                })
              ),
              revision: data.revision,
              pending: false,
            }
          : null
      },
      write: async (settings, expectedRevision) => {
        const state = sanitizeSettings(JSON.parse(settings.snapshot))
        const row = {
          user_id: userId,
          timezone: state.timezone,
          break_divisor: state.breakDivisor,
          chime_enabled: state.chimeEnabled,
          chime_id: state.chimeId,
          focus_mode_lock: state.focusModeLock,
          shortcuts_enabled: state.shortcutsEnabled,
          revision: settings.revision!,
        }
        const query = expectedRevision
          ? supabase
              .from('user_settings')
              .update(row)
              .eq('user_id', userId)
              .eq('revision', expectedRevision)
          : supabase
              .from('user_settings')
              .upsert(row, { onConflict: 'user_id', ignoreDuplicates: true })
        const { data, error } = await query.select('revision')
        if (error) throw error
        return data.length > 0
      },
      onStatus: (error) => {
        if (useTimerSettingsStore.getState().ownerUserId === userId) {
          setStatus((previous) =>
            previous.userId === userId && previous.ready && previous.error === error
              ? previous
              : { userId, ready: true, error }
          )
        }
      },
    })
    const unsubscribe = useTimerSettingsStore.subscribe((state, previous) => {
      if (applying || state.ownerUserId !== userId) return
      if (
        JSON.stringify(sanitizeSettings({ ...state })) ===
        JSON.stringify(sanitizeSettings({ ...previous }))
      )
        return
      void controller.sync()
    })
    const resume = () => {
      if (document.visibilityState === 'visible') void controller.sync()
    }
    // ponytail: reuse timer polling; use Realtime if instant propagation is needed.
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
    settingsReady: !!userId && status.userId === userId && status.ready,
    settingsSyncError: status.userId === userId ? status.error : null,
  }
}
