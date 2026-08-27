function pad(value: number) {
  return String(value).padStart(2, '0')
}

export function formatClock(totalSeconds: number) {
  const safeSeconds = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60

  return hours > 0
    ? `${pad(hours)}:${pad(minutes % 60)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`
}

export function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`
  }

  if (hours > 0) {
    return `${hours}h`
  }

  return `${minutes}m`
}

export function getTimeAxis(maxSeconds: number) {
  const steps = [60, 300, 600, 900, 1800, 3600, 7200, 14_400]
  const step = steps.find((candidate) => Math.ceil(maxSeconds / candidate) <= 4) ?? 28_800
  const top = Math.max(step, Math.ceil(maxSeconds / step) * step)

  return {
    domain: [0, top] as [number, number],
    ticks: Array.from({ length: top / step + 1 }, (_, index) => index * step),
  }
}

export function formatTimeAxisTick(totalSeconds: number) {
  if (totalSeconds < 3600) return `${Math.round(totalSeconds / 60)}m`

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.round((totalSeconds % 3600) / 60)
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`
}
