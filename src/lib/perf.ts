interface PerfSample {
  label: string
  durationMs: number
  timestamp: string
}

interface PerfStore {
  samples: PerfSample[]
}

declare global {
  interface Window {
    __flowtimePerf?: PerfStore
  }
}

const PERF_ENABLED = import.meta.env.DEV || import.meta.env.VITE_PERF_DEBUG === 'true'
const MAX_SAMPLES = 200
const pendingNavigationMarks = new Map<string, number>()

function getPerfStore(): PerfStore | null {
  if (!PERF_ENABLED || typeof window === 'undefined') {
    return null
  }

  if (!window.__flowtimePerf) {
    window.__flowtimePerf = { samples: [] }
  }

  return window.__flowtimePerf
}

function recordSample(label: string, durationMs: number) {
  if (!PERF_ENABLED) {
    return
  }

  const store = getPerfStore()
  if (!store) {
    return
  }

  store.samples.push({
    label,
    durationMs,
    timestamp: new Date().toISOString(),
  })

  if (store.samples.length > MAX_SAMPLES) {
    store.samples.splice(0, store.samples.length - MAX_SAMPLES)
  }

  const rounded = Math.round(durationMs)
  if (rounded >= 450) {
    console.warn(`[perf] ${label}: ${rounded}ms`)
    return
  }

  if (rounded >= 150) {
    console.info(`[perf] ${label}: ${rounded}ms`)
  }
}

export async function measureAsync<T>(label: string, run: () => Promise<T>) {
  const start = performance.now()
  try {
    return await run()
  } finally {
    recordSample(label, performance.now() - start)
  }
}

export function markNavigationStart(route: string) {
  if (!PERF_ENABLED) return
  pendingNavigationMarks.set(route, performance.now())
}

export function markNavigationComplete(route: string) {
  if (!PERF_ENABLED) return

  const startedAt = pendingNavigationMarks.get(route)
  if (startedAt === undefined) {
    return
  }

  pendingNavigationMarks.delete(route)
  recordSample(`navigation:${route}`, performance.now() - startedAt)
}

export function initPerfObservers() {
  if (
    !PERF_ENABLED ||
    typeof window === 'undefined' ||
    typeof PerformanceObserver === 'undefined'
  ) {
    return
  }

  const observePaints = () => {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        recordSample(`paint:${entry.name}`, entry.startTime)
      }
    })

    observer.observe({ type: 'paint', buffered: true })
  }

  const observeLargestContentfulPaint = () => {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const last = entries[entries.length - 1]
      if (last) {
        recordSample('paint:lcp', last.startTime)
      }
    })

    observer.observe({ type: 'largest-contentful-paint', buffered: true })
  }

  observePaints()
  observeLargestContentfulPaint()
}
