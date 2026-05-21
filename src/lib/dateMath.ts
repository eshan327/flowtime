function toDateOnlyIso(date: Date) {
  return date.toLocaleDateString('en-CA')
}

function padHour(value: number) {
  return String(value).padStart(2, '0')
}

export function toLocalDateKey(date: Date) {
  return toDateOnlyIso(date)
}

export function toHourKey(date: Date) {
  return `${toDateOnlyIso(date)}T${padHour(date.getHours())}`
}

export function toWeekStart(date: Date) {
  const weekStart = new Date(date)
  weekStart.setHours(0, 0, 0, 0)
  const day = weekStart.getDay()
  weekStart.setDate(weekStart.getDate() - day)
  return weekStart
}

export function toStartOfDay(date: Date) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  return start
}

export function toEndOfDay(date: Date) {
  const end = new Date(date)
  end.setHours(23, 59, 59, 999)
  return end
}
