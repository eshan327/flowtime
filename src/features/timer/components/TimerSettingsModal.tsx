import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { DONE_CHIME_OPTIONS, playDoneChime } from '@/lib/audio'
import {
  DEFAULT_BREAK_DIVISOR,
  DEFAULT_FOCUS_MODE_LOCK,
  DEFAULT_SHORTCUTS_ENABLED,
  sanitizeChimeId,
  useTimerSettingsStore,
} from '@/features/timer/stores/timerSettingsStore'

interface TimerSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

function ToggleRow({
  checked,
  label,
  description,
  onChange,
}: {
  checked: boolean
  label: string
  description: string
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-5 py-3">
      <div>
        <p className="text-sm text-ink-primary">{label}</p>
        <p className="mt-1 text-xs text-ink-secondary">{description}</p>
      </div>

      <input
        checked={checked}
        className="peer sr-only"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-surface-hover transition-colors duration-150 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-ink-secondary after:transition-transform after:duration-150 peer-checked:bg-accent-primary peer-checked:after:translate-x-4 peer-checked:after:bg-surface-sidebar peer-focus-visible:ring-2 peer-focus-visible:ring-accent-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface-panel" />
    </label>
  )
}

export function TimerSettingsModal({ isOpen, onClose }: TimerSettingsModalProps) {
  const breakDivisor = useTimerSettingsStore((state) => state.breakDivisor)
  const notificationsEnabled = useTimerSettingsStore((state) => state.notificationsEnabled)
  const chimeEnabled = useTimerSettingsStore((state) => state.chimeEnabled)
  const chimeId = useTimerSettingsStore((state) => state.chimeId)
  const focusModeLock = useTimerSettingsStore((state) => state.focusModeLock)
  const shortcutsEnabled = useTimerSettingsStore((state) => state.shortcutsEnabled)
  const setBreakDivisor = useTimerSettingsStore((state) => state.setBreakDivisor)
  const setNotificationsEnabled = useTimerSettingsStore((state) => state.setNotificationsEnabled)
  const setChimeEnabled = useTimerSettingsStore((state) => state.setChimeEnabled)
  const setChimeId = useTimerSettingsStore((state) => state.setChimeId)
  const setFocusModeLock = useTimerSettingsStore((state) => state.setFocusModeLock)
  const setShortcutsEnabled = useTimerSettingsStore((state) => state.setShortcutsEnabled)
  const resetSettings = useTimerSettingsStore((state) => state.resetSettings)
  const commitBreakDivisorInput = (rawValue: string) => {
    const trimmed = rawValue.trim()
    if (!trimmed) {
      return
    }

    const parsed = Number(trimmed)
    if (!Number.isInteger(parsed)) {
      return
    }

    setBreakDivisor(parsed)
  }

  const selectedChime =
    DONE_CHIME_OPTIONS.find((option) => option.id === sanitizeChimeId(chimeId)) ??
    DONE_CHIME_OPTIONS[0]

  return (
    <Modal className="max-w-lg" isOpen={isOpen} onClose={onClose} title="Timer Settings">
      <div>
        <div className="flex items-end justify-between gap-4 border-b border-surface-border-subtle pb-4">
          <Input
            containerClassName="max-w-32"
            defaultValue={String(breakDivisor)}
            label="Break divisor"
            inputMode="numeric"
            key={breakDivisor}
            onBlur={(event) => {
              commitBreakDivisorInput(event.target.value)
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              commitBreakDivisorInput(event.currentTarget.value)
              event.currentTarget.blur()
            }}
            step={1}
            type="text"
          />

          <p className="max-w-xs pb-2 text-right text-xs text-ink-secondary">
            Work time ÷ divisor. Default: {DEFAULT_BREAK_DIVISOR}.
          </p>
        </div>

        <div className="divide-y divide-surface-border-subtle">
          <ToggleRow
            checked={focusModeLock}
            description="Lock task switching while actively working."
            label="Focus mode lock"
            onChange={setFocusModeLock}
          />

          <ToggleRow
            checked={shortcutsEnabled}
            description="Enable keyboard shortcuts for timer controls and panel actions."
            label="Keyboard shortcuts"
            onChange={setShortcutsEnabled}
          />

          <ToggleRow
            checked={notificationsEnabled}
            description="Show a desktop notification when your break ends."
            label="Desktop notifications"
            onChange={setNotificationsEnabled}
          />

          <ToggleRow
            checked={chimeEnabled}
            description="Play a short chime when your break ends."
            label="Break completion chime"
            onChange={setChimeEnabled}
          />

          <div className="py-4">
            <label
              className="block text-xs uppercase tracking-[0.1em] text-ink-tertiary"
              htmlFor="chime-sound"
            >
              Chime sound
            </label>

            <div className="mt-2 flex gap-2">
              <select
                className="min-w-0 flex-1 rounded-lg border border-surface-border-subtle bg-surface-sidebar px-3 py-2 text-sm text-ink-primary outline-none transition-colors duration-150 focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/15 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!chimeEnabled}
                id="chime-sound"
                onChange={(event) => setChimeId(sanitizeChimeId(event.target.value))}
                value={selectedChime.id}
              >
                {DONE_CHIME_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>

              <Button
                disabled={!chimeEnabled}
                onClick={() => {
                  playDoneChime(selectedChime.id)
                }}
                size="sm"
                variant="outlined"
              >
                Preview
              </Button>
            </div>

            <p className="mt-2 text-xs text-ink-secondary">{selectedChime.description}</p>
          </div>

          <div className="py-4">
            <p className="text-xs uppercase tracking-[0.1em] text-ink-tertiary">Shortcut map</p>
            <div className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs text-ink-secondary">
              {[
                ['S', 'Start work'],
                ['D', 'Stop work / take break'],
                ['B', 'Skip break'],
                ['R', 'Replay last session'],
                ['T', 'Open task selector'],
                [',', 'Open timer settings'],
              ].map(([key, action]) => (
                <div className="contents" key={key}>
                  <kbd className="min-w-6 rounded bg-surface-sidebar px-1.5 py-0.5 text-center font-mono text-[11px] text-ink-primary">
                    {key}
                  </kbd>
                  <span>{action}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="py-3 text-xs text-ink-tertiary">
            Defaults: focus lock {DEFAULT_FOCUS_MODE_LOCK ? 'on' : 'off'}, shortcuts{' '}
            {DEFAULT_SHORTCUTS_ENABLED ? 'on' : 'off'}.
          </p>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-surface-border-subtle pt-4">
          <Button onClick={resetSettings} variant="ghost">
            Reset defaults
          </Button>

          <Button onClick={onClose} variant="filled">
            Done
          </Button>
        </div>
      </div>
    </Modal>
  )
}
