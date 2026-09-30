// Keep the clock local: only actions and absolute timestamps travel between devices.
export function timerSnapshot(state: Record<string, unknown>): string {
  return JSON.stringify(
    { ...state, workSeconds: state.phase === 'working' ? 0 : state.workSeconds },
    (key, value) => (key === 'syncRevision' || key === 'syncPending' ? undefined : value)
  )
}

export interface SyncedTimer {
  snapshot: string
  revision: string | null
  pending: boolean
}

interface TimerSyncOptions {
  getLocal: () => SyncedTimer
  setLocal: (timer: SyncedTimer) => void
  read: () => Promise<SyncedTimer | null>
  write: (timer: SyncedTimer, expectedRevision: string | null) => Promise<boolean>
  onStatus: (error: unknown) => void
}

export function createTimerSync({ getLocal, setLocal, read, write, onStatus }: TimerSyncOptions) {
  let stopped = false
  let running = false
  let requested = false

  const sync = async () => {
    if (stopped) return
    requested = true
    if (running) return
    running = true
    try {
      while (requested && !stopped) {
        requested = false
        const remote = await read()
        if (stopped) return
        const local = getLocal()
        const state = JSON.parse(local.snapshot)
        if (!remote && state.phase === 'idle' && !state.selectedTaskId) {
          onStatus(null)
          continue
        }
        if (!remote || (local.pending && local.revision === remote.revision)) {
          const next = { ...local, revision: crypto.randomUUID(), pending: false }
          const saved = await write(next, remote?.revision ?? null)
          if (stopped) return
          if (!saved) {
            requested = true
            continue
          }
          const latest = getLocal()
          setLocal({
            ...latest,
            revision: next.revision,
            pending: latest.snapshot !== next.snapshot,
          })
          requested ||= latest.snapshot !== next.snapshot
        } else if (remote.revision !== local.revision || local.pending) {
          // ponytail: the committed action wins a conflict; merge actions if collaborative editing is needed.
          setLocal({ ...remote, pending: false })
        }
        onStatus(null)
      }
    } catch (error) {
      if (!stopped) onStatus(error)
    } finally {
      running = false
    }
  }

  return {
    sync,
    stop: () => {
      stopped = true
    },
  }
}
