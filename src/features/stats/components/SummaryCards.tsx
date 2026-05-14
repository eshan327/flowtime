import { formatDuration } from '@/lib/utils'

interface SummaryCardsProps {
  totalSessions: number
  totalWorkSeconds: number
  currentStreak: number
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-raised p-4">
      <p className="text-[32px] font-normal leading-none text-ink-primary">{value}</p>
      <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-tertiary">
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
    <div className="grid gap-3 md:grid-cols-3">
      <SummaryCard label="Sessions" value={String(totalSessions)} />
      <SummaryCard label="Focus Time" value={formatDuration(totalWorkSeconds)} />
      <SummaryCard
        label="Current Streak"
        value={`${currentStreak} day${currentStreak === 1 ? '' : 's'}`}
      />
    </div>
  )
}
