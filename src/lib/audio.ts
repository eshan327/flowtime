export type ChimeOptionId = 'classic-rise' | 'gentle-bell' | 'bright-glock' | 'zen-gong'

export interface ChimeOption {
  id: ChimeOptionId
  name: string
  description: string
}

export const DEFAULT_DONE_CHIME_ID: ChimeOptionId = 'classic-rise'

export const DONE_CHIME_OPTIONS: ChimeOption[] = [
  {
    id: 'classic-rise',
    name: 'Classic Rise',
    description: 'Original 3-note rising chime. Bright and clear.',
  },
  {
    id: 'gentle-bell',
    name: 'Gentle Bell',
    description: 'Soft two-note bell for a subtler break ending cue.',
  },
  {
    id: 'bright-glock',
    name: 'Bright Glock',
    description: 'Crisp glockenspiel-style ping that cuts through background noise.',
  },
  {
    id: 'zen-gong',
    name: 'Zen Gong',
    description: 'Lower, calmer tone with a longer tail.',
  },
]

interface ChimeNote {
  frequency: number
  startOffset: number
  duration: number
  gain: number
  waveform: OscillatorType
}

const CHIME_NOTE_MAP: Record<ChimeOptionId, ChimeNote[]> = {
  'classic-rise': [
    { frequency: 528, startOffset: 0, duration: 0.35, gain: 0.24, waveform: 'sine' },
    { frequency: 660, startOffset: 0.14, duration: 0.35, gain: 0.22, waveform: 'sine' },
    { frequency: 792, startOffset: 0.28, duration: 0.5, gain: 0.2, waveform: 'sine' },
  ],
  'gentle-bell': [
    { frequency: 493.88, startOffset: 0, duration: 0.45, gain: 0.2, waveform: 'triangle' },
    { frequency: 587.33, startOffset: 0.2, duration: 0.6, gain: 0.17, waveform: 'triangle' },
  ],
  'bright-glock': [
    { frequency: 659.25, startOffset: 0, duration: 0.2, gain: 0.22, waveform: 'square' },
    { frequency: 783.99, startOffset: 0.12, duration: 0.2, gain: 0.2, waveform: 'square' },
    { frequency: 987.77, startOffset: 0.24, duration: 0.28, gain: 0.16, waveform: 'square' },
  ],
  'zen-gong': [
    { frequency: 329.63, startOffset: 0, duration: 0.9, gain: 0.18, waveform: 'sine' },
    { frequency: 392, startOffset: 0.22, duration: 0.8, gain: 0.14, waveform: 'sine' },
  ],
}

export function playDoneChime(chimeId: ChimeOptionId = DEFAULT_DONE_CHIME_ID): void {
  if (typeof window === 'undefined') return

  type WindowWithWebkitAudio = Window & {
    webkitAudioContext?: typeof AudioContext
  }

  const AudioContextClass =
    window.AudioContext || (window as WindowWithWebkitAudio).webkitAudioContext

  if (!AudioContextClass) return

  const ctx = new AudioContextClass()
  const notes = CHIME_NOTE_MAP[chimeId] ?? CHIME_NOTE_MAP[DEFAULT_DONE_CHIME_ID]

  let maxEndOffset = 0

  for (const note of notes) {
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    const noteStart = ctx.currentTime + note.startOffset
    const noteEnd = noteStart + note.duration
    maxEndOffset = Math.max(maxEndOffset, note.startOffset + note.duration)

    oscillator.type = note.waveform
    oscillator.frequency.setValueAtTime(note.frequency, noteStart)

    gainNode.gain.setValueAtTime(note.gain, noteStart)
    gainNode.gain.exponentialRampToValueAtTime(0.001, noteEnd)

    oscillator.start(noteStart)
    oscillator.stop(noteEnd)
  }

  window.setTimeout(
    () => {
      void ctx.close()
    },
    Math.ceil((maxEndOffset + 0.15) * 1000)
  )
}
