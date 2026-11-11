export function formatTaskDueDate(value: string, now = new Date()) {
  // Parse as a local calendar date so UTC offsets never move the deadline a day.
  const date = new Date(`${value}T00:00:00`)
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const isOverdue = date < today
  const isToday = date.getTime() === today.getTime()
  const shortDate = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
  })

  return {
    label: isOverdue
      ? `Overdue · ${shortDate}`
      : isToday
        ? 'Due today'
        : date.getTime() === tomorrow.getTime()
          ? 'Due tomorrow'
          : `Due ${shortDate}`,
    fullDate: date.toLocaleDateString(undefined, { dateStyle: 'full' }),
    isOverdue,
    isToday,
  }
}
