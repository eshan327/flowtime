let epoch = Date.now(),
  wallSample = Date.now(),
  monotonicSample = performance.now(),
  calibrated = false
export function calibrateServerClock(iso: string) {
  const value = Date.parse(iso)
  if (!Number.isFinite(value)) throw new Error('Invalid server clock.')
  epoch = value
  wallSample = Date.now()
  monotonicSample = performance.now()
  calibrated = true
}
export function serverClock() {
  const wall = Date.now() - wallSample,
    monotonic = performance.now() - monotonicSample
  return {
    now: epoch + Math.max(wall, monotonic),
    uncertain: !calibrated || Math.abs(wall - monotonic) > 5000,
  }
}
export function timerNow() {
  return serverClock().now
}
