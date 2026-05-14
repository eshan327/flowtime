import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import {
  DEFAULT_BREAK_DIVISOR,
  MAX_BREAK_DIVISOR,
  MIN_BREAK_DIVISOR,
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
  const setBreakDivisor = useTimerSettingsStore((state) => state.setBreakDivisor)
  const setNotificationsEnabled = useTimerSettingsStore((state) => state.setNotificationsEnabled)
  const setChimeEnabled = useTimerSettingsStore((state) => state.setChimeEnabled)
  const resetSettings = useTimerSettingsStore((state) => state.resetSettings)

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Timer Settings">
      <div className="space-y-4">
        <Input
          label="Break divisor"
          max={MAX_BREAK_DIVISOR}
          min={MIN_BREAK_DIVISOR}
          onChange={(event) => {
            const next = Number(event.target.value)
            setBreakDivisor(next)
          }}
          type="number"
          value={breakDivisor}
        />

        <p className="text-xs text-ink-secondary">
          Break length is calculated as work time / divisor. Default is {DEFAULT_BREAK_DIVISOR}.
        </p>

        <div className="space-y-2">
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
