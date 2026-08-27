import { formatDuration } from '@/lib/formatting'

interface SummaryCardsProps {
  totalSessions: number
  totalWorkSeconds: number
  currentStreak: number
  dailyAverageSeconds: number
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-3 py-5 sm:px-6">
      <p className="text-xs text-ink-tertiary">{label}</p>
      <p className="mt-2 truncate text-[28px] font-medium leading-none tabular-nums tracking-[-0.04em] text-ink-primary sm:text-[34px]">
        {value}
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
    <div className="grid grid-cols-2 divide-x divide-y divide-surface-border border-y border-surface-border sm:grid-cols-4 sm:divide-y-0">
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
