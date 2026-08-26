import { formatDuration } from '@/lib/formatting'

interface SummaryCardsProps {
  totalSessions: number
  totalWorkSeconds: number
  currentStreak: number
  dailyAverageSeconds: number
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-3 py-4 sm:px-5">
      <p className="truncate text-[28px] font-medium leading-none tabular-nums tracking-tight text-ink-primary sm:text-[32px]">
        {value}
      </p>
      <p className="mt-3 text-xs font-medium uppercase tracking-[0.06em] text-ink-tertiary">
        {label}
      </p>
    </div>
  )
}

export function SummaryCards({
  totalSessions,
  totalWorkSeconds,
  currentStreak,
  dailyAverageSeconds,
}: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 divide-x divide-y divide-surface-border overflow-hidden rounded-md border border-surface-border bg-surface-sidebar/35 sm:grid-cols-4 sm:divide-y-0">
      <SummaryCard label="Focus Time" value={formatDuration(totalWorkSeconds)} />
      <SummaryCard label="Daily Average" value={formatDuration(dailyAverageSeconds)} />
      <SummaryCard label="Sessions" value={String(totalSessions)} />
      <SummaryCard
        label="Current Streak"
        value={`${currentStreak} day${currentStreak === 1 ? '' : 's'}`}
      />
    </div>
  )
}
