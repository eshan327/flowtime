export function startVisiblePolling(refresh: () => void, delay: number) {
  let interval: number | undefined
  const pause = () => {
    window.clearInterval(interval)
    interval = undefined
  }
  const resume = () => {
    pause()
    if (document.visibilityState !== 'visible' || navigator.onLine === false) return
    refresh()
    interval = window.setInterval(refresh, delay)
  }
  document.addEventListener('visibilitychange', resume)
  window.addEventListener('pageshow', resume)
  window.addEventListener('focus', resume)
  window.addEventListener('online', resume)
  window.addEventListener('offline', pause)
  resume()
  return () => {
    pause()
    document.removeEventListener('visibilitychange', resume)
    window.removeEventListener('pageshow', resume)
    window.removeEventListener('focus', resume)
    window.removeEventListener('online', resume)
    window.removeEventListener('offline', pause)
  }
}
