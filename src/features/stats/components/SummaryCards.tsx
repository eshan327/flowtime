import { formatDuration } from '@/lib/formatting'

interface SummaryCardsProps {
  totalSessions: number
  totalWorkSeconds: number
  currentStreak: number
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-3 py-4 sm:px-5">
      <p className="truncate text-[28px] font-medium leading-none tabular-nums tracking-tight text-ink-primary sm:text-[32px]">
        {value}
      </p>
      <p className="mt-3 text-[10px] font-medium uppercase tracking-[0.08em] text-ink-tertiary sm:text-[11px]">
        {label}
      </p>
    </div>
  )
}

export function SummaryCards({
  totalSessions,
  totalWorkSeconds,
  currentStreak,
}: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-3 divide-x divide-surface-border-subtle overflow-hidden rounded-xl bg-surface-panel">
      <SummaryCard label="Sessions" value={String(totalSessions)} />
      <SummaryCard label="Focus Time" value={formatDuration(totalWorkSeconds)} />
      <SummaryCard
        label="Current Streak"
        value={`${currentStreak} day${currentStreak === 1 ? '' : 's'}`}
      />
    </div>
  )
}
