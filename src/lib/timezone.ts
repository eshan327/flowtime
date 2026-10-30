export function dateKeyInZone(date: Date, timezone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}
export function zonedInput(iso: string, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`
}
export function fromZonedInput(value: string, timezone: string) {
  const parsed = Date.parse(value + 'Z')
  const milliseconds = ((parsed % 1000) + 1000) % 1000
  const target = parsed - milliseconds
  if (!Number.isFinite(target)) throw new Error('Invalid local date/time.')
  let instant = target
  for (let i = 0; i < 4; i++) {
    const rendered = Date.parse(zonedInput(new Date(instant).toISOString(), timezone) + 'Z')
    const next = instant + target - rendered
    if (next === instant) break
    instant = next
  }
  if (zonedInput(new Date(instant).toISOString(), timezone) !== value.slice(0, 19))
    throw new Error(
      'That local time does not exist because of a clock change. Choose another time.'
    )
  return new Date(instant + milliseconds)
}
export function shiftDateKey(key: string, days: number) {
  const d = new Date(key + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
export function midnightInZone(key: string, timezone: string) {
  return fromZonedInput(key + 'T00:00:00', timezone)
}
export function calendarRange(
  range: 'day' | 'week' | 'month' | 'year',
  anchor: Date,
  timezone: string
) {
  let key = dateKeyInZone(anchor, timezone),
    end: string
  if (range === 'week') key = shiftDateKey(key, -new Date(key + 'T12:00:00Z').getUTCDay())
  if (range === 'month') key = key.slice(0, 7) + '-01'
  if (range === 'year') key = key.slice(0, 4) + '-01-01'
  if (range === 'day') end = shiftDateKey(key, 1)
  else if (range === 'week') end = shiftDateKey(key, 7)
  else if (range === 'month') {
    const d = new Date(key + 'T12:00:00Z')
    d.setUTCMonth(d.getUTCMonth() + 1)
    end = d.toISOString().slice(0, 10)
  } else end = String(Number(key.slice(0, 4)) + 1) + '-01-01'
  return { from: midnightInZone(key, timezone), to: midnightInZone(end, timezone) }
}
