import {
  getSessionCategoryColor,
  getSessionCategoryId,
  getSessionCategoryName,
  getSessionTaskColor,
  getSessionTaskId,
  getSessionTaskName,
} from '@/lib/sessionSnapshot'
import type { SessionWithTask, TimeRange } from '@/types'

export type SessionExportScope = 'range' | 'history'
export type SessionExportFormat = 'csv' | 'json'
export type SessionExportRange = TimeRange | 'all-time' | 'custom'

export interface SessionExportRecord {
  id: string
  startedAt: string
  endedAt: string
  workSeconds: number
  breakSeconds: number
  workMinutes: number
  breakMinutes: number
  taskId: string | null
  taskName: string | null
  taskColor: string | null
  categoryId: string | null
  categoryName: string
  categoryColor: string | null
  notes: string | null
  editedAt: string | null
}

export interface SessionExportPayload {
  content: string
  mimeType: string
  fileName: string
  sessionCount: number
}

interface SessionExportMetadata {
  exportedAt: string
  scope: SessionExportScope
  range: SessionExportRange
  from: string
  to: string
  sessionCount: number
}

interface CreateSessionExportPayloadInput {
  sessions: SessionWithTask[]
  format: SessionExportFormat
  scope: SessionExportScope
  range: SessionExportRange
  from?: Date
  to?: Date
}

function toIsoDayStamp(value: Date) {
  return value.toISOString().slice(0, 10)
}

function parseIsoDate(value: string | null | undefined) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}

function getDefaultExportWindow(sessions: SessionWithTask[]) {
  const candidates = sessions
    .flatMap((session) => [parseIsoDate(session.started_at), parseIsoDate(session.ended_at)])
    .filter((date): date is Date => !!date)

  if (candidates.length === 0) {
    const now = new Date()
    return { from: now, to: now }
  }

  const minTime = Math.min(...candidates.map((date) => date.getTime()))
  const maxTime = Math.max(...candidates.map((date) => date.getTime()))

  return {
    from: new Date(minTime),
    to: new Date(maxTime),
  }
}

function toSessionExportRecord(session: SessionWithTask): SessionExportRecord {
  return {
    id: session.id,
    startedAt: session.started_at,
    endedAt: session.ended_at,
    workSeconds: session.work_seconds,
    breakSeconds: session.break_seconds,
    workMinutes: Number((session.work_seconds / 60).toFixed(2)),
    breakMinutes: Number((session.break_seconds / 60).toFixed(2)),
    taskId: getSessionTaskId(session),
    taskName: getSessionTaskName(session),
    taskColor: getSessionTaskColor(session),
    categoryId: getSessionCategoryId(session),
    categoryName: getSessionCategoryName(session),
    categoryColor: getSessionCategoryColor(session),
    notes: session.notes,
    editedAt: session.edited_at,
  }
}

function toCsvCell(value: unknown) {
  const rawValue = value == null ? '' : String(value)
  const serialized = /^[=+\-@]/.test(rawValue) ? `'${rawValue}` : rawValue
  const escaped = serialized.replace(/"/g, '""')

  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped
}

function buildSessionExportFileName(
  format: SessionExportFormat,
  scope: SessionExportScope,
  range: SessionExportRange,
  from: Date,
  to: Date
) {
  const windowPart = `${toIsoDayStamp(from)}_to_${toIsoDayStamp(to)}`
  const scopePart = scope === 'range' ? `range-${range}` : 'full-history'
  return `flowtime-sessions-${scopePart}-${windowPart}.${format}`
}

export function buildSessionExportRecords(sessions: SessionWithTask[]): SessionExportRecord[] {
  return [...sessions]
    .sort((a, b) => a.started_at.localeCompare(b.started_at))
    .map((session) => toSessionExportRecord(session))
}

export function serializeSessionExportCsv(records: SessionExportRecord[]) {
  const headers = [
    'id',
    'started_at',
    'ended_at',
    'work_seconds',
    'break_seconds',
    'work_minutes',
    'break_minutes',
    'task_id',
    'task_name',
    'task_color',
    'category_id',
    'category_name',
    'category_color',
    'notes',
    'edited_at',
  ]

  const rows = records.map((record) =>
    [
      record.id,
      record.startedAt,
      record.endedAt,
      record.workSeconds,
      record.breakSeconds,
      record.workMinutes,
      record.breakMinutes,
      record.taskId,
      record.taskName,
      record.taskColor,
      record.categoryId,
      record.categoryName,
      record.categoryColor,
      record.notes,
      record.editedAt,
    ]
      .map((value) => toCsvCell(value))
      .join(',')
  )

  return [headers.join(','), ...rows].join('\n')
}

export function serializeSessionExportJson(
  records: SessionExportRecord[],
  metadata: SessionExportMetadata
) {
  return JSON.stringify(
    {
      metadata,
      sessions: records,
    },
    null,
    2
  )
}

export function createSessionExportPayload({
  sessions,
  format,
  scope,
  range,
  from,
  to,
}: CreateSessionExportPayloadInput): SessionExportPayload {
  const records = buildSessionExportRecords(sessions)
  const fallbackWindow = getDefaultExportWindow(sessions)
  const exportFrom = from ?? fallbackWindow.from
  const exportTo = to ?? fallbackWindow.to

  const metadata: SessionExportMetadata = {
    exportedAt: new Date().toISOString(),
    scope,
    range,
    from: exportFrom.toISOString(),
    to: exportTo.toISOString(),
    sessionCount: records.length,
  }

  const content =
    format === 'csv'
      ? serializeSessionExportCsv(records)
      : serializeSessionExportJson(records, metadata)

  return {
    content,
    mimeType: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8',
    fileName: buildSessionExportFileName(format, scope, range, exportFrom, exportTo),
    sessionCount: records.length,
  }
}

export function downloadSessionExportFile(payload: SessionExportPayload) {
  const blob = new Blob([payload.content], { type: payload.mimeType })
  const url = URL.createObjectURL(blob)

  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = payload.fileName
  anchor.rel = 'noopener'
  anchor.style.display = 'none'

  document.body.append(anchor)
  anchor.click()
  anchor.remove()

  URL.revokeObjectURL(url)
}
