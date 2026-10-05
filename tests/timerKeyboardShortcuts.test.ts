import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import test from 'node:test'

let handler: (event: unknown) => void
let dialogOpen = false
class Element {
  isContentEditable = false
  tagName: string
  constructor(tagName: string) {
    this.tagName = tagName
  }
  closest() {
    return ['BUTTON', 'A'].includes(this.tagName) ? this : null
  }
}
Object.assign(globalThis, {
  HTMLElement: Element,
  window: {
    addEventListener: (_: string, fn: typeof handler) => {
      handler = fn
    },
    removeEventListener() {},
  },
  document: { querySelector: () => (dialogOpen ? {} : null) },
  __shortcutEffect: (fn: () => unknown) => fn(),
})
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'react')
      return {
        url: 'data:text/javascript,export const useEffect = globalThis.__shortcutEffect',
        shortCircuit: true,
      }
    return nextResolve(specifier, context)
  },
})
const { useTimerKeyboardShortcuts } =
  await import('../src/features/timer/hooks/useTimerKeyboardShortcuts.ts')
hooks.deregister()

test('Space controls the current phase without stealing typing, native controls, repeated keys or modal interactions', () => {
  const actions: string[] = []
  const press = (key: string, target?: Element, repeat = false) =>
    handler({ key, target, repeat, preventDefault() {}, defaultPrevented: false })
  for (const [phase, legacyKey, expected] of [
    ['idle', 's', 'start'],
    ['working', 'd', 'stop'],
    ['breaking', 'b', 'skip'],
  ] as const) {
    useTimerKeyboardShortcuts({
      enabled: true,
      phase,
      canStartWork: true,
      overlaysOpen: false,
      onStartWork: () => actions.push('start'),
      onStopWork: () => actions.push('stop'),
      onSkipBreak: () => actions.push('skip'),
      onOpenSettings: () => actions.push('settings'),
    })
    press(' ')
    assert.equal(actions.pop(), expected)
    press(legacyKey)
    assert.equal(actions.pop(), expected)
    press(' ', new Element('INPUT'))
    press(' ', new Element('BUTTON'))
    press(' ', undefined, true)
    dialogOpen = true
    press(' ')
    press(',')
    dialogOpen = false
    assert.deepEqual(actions, [])
  }
})
