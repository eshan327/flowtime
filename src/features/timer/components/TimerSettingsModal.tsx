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
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-surface-border bg-surface-base p-3">
      <div>
        <p className="text-sm text-ink-primary">{label}</p>
        <p className="mt-1 text-xs text-ink-secondary">{description}</p>
      </div>

      <input
        checked={checked}
        className="mt-1 h-4 w-4 accent-ink-primary"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
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
    <Modal isOpen={isOpen} onClose={onClose} title="Timer Settings">
      <div className="space-y-4">
        <Input
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
          placeholder={String(DEFAULT_BREAK_DIVISOR)}
          step={1}
          type="text"
        />

        <p className="text-xs text-ink-secondary">
          Break length is calculated as work time / divisor. Use any whole number of 1 or more.
          Default is {DEFAULT_BREAK_DIVISOR}.
        </p>

        <div className="space-y-2">
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

          <div className="rounded-lg border border-surface-border bg-surface-base p-3">
            <label
              className="block text-xs uppercase tracking-[0.1em] text-ink-tertiary"
              htmlFor="chime-sound"
            >
              Chime sound
            </label>

            <select
              className="mt-2 w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-ink-primary outline-none transition focus:border-ink-secondary disabled:cursor-not-allowed disabled:opacity-60"
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

            <p className="mt-2 text-xs text-ink-secondary">{selectedChime.description}</p>

            <div className="mt-3 flex justify-end">
              <Button
                onClick={() => {
                  playDoneChime(selectedChime.id)
                }}
                size="sm"
                variant="outlined"
              >
                Preview sound
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-surface-border bg-surface-base p-3">
            <p className="text-xs uppercase tracking-[0.1em] text-ink-tertiary">Shortcut map</p>
            <p className="mt-2 text-xs text-ink-secondary">S: Start work</p>
            <p className="text-xs text-ink-secondary">D: Stop work / take break</p>
            <p className="text-xs text-ink-secondary">B: Skip break</p>
            <p className="text-xs text-ink-secondary">R: Replay last session</p>
            <p className="text-xs text-ink-secondary">T: Open task selector</p>
            <p className="text-xs text-ink-secondary">,: Open timer settings</p>
          </div>

          <p className="text-xs text-ink-secondary">
            Defaults: focus lock {DEFAULT_FOCUS_MODE_LOCK ? 'on' : 'off'}, shortcuts{' '}
            {DEFAULT_SHORTCUTS_ENABLED ? 'on' : 'off'}.
          </p>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
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
