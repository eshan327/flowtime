export function playDoneChime(): void {
  if (typeof window === 'undefined') return

  type WindowWithWebkitAudio = Window & {
    webkitAudioContext?: typeof AudioContext
  }

  const AudioContextClass =
    window.AudioContext || (window as WindowWithWebkitAudio).webkitAudioContext

  if (!AudioContextClass) return

  const ctx = new AudioContextClass()
  const oscillator = ctx.createOscillator()
  const gainNode = ctx.createGain()

  oscillator.connect(gainNode)
  gainNode.connect(ctx.destination)

  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(528, ctx.currentTime)
  oscillator.frequency.setValueAtTime(660, ctx.currentTime + 0.15)
  oscillator.frequency.setValueAtTime(792, ctx.currentTime + 0.3)

  gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2)

  oscillator.start(ctx.currentTime)
  oscillator.stop(ctx.currentTime + 1.2)

  oscillator.onended = () => {
    void ctx.close()
  }
}
