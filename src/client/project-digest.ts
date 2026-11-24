/**
 * Project digest: a local-calendar window over one project's task changes,
 * plus the Markdown report and file name shared by the copy / download actions.
 *
 * Pure functions only — no DOM, no Git, no writes, and no clock read unless
 * `now` is omitted. Every rule reuses the helper another surface already
 * trusts: `criteria` / `criteriaProgress` (acceptance), `dueStateOf` (overdue),
 * `stalledDays` (stalled), `elapsedWorkMs` (work time), `parseEstimate`
 * (points) and the Markdown helpers.
 *
 * Work time is an accumulated per-task value with no per-window breakdown, so
 * the digest reports "the accumulated work of tasks merged in the window" and
 * never implies a within-window increment.
 */

import type { Project, TaskView } from '../models'
import { elapsedWorkMs, formatWorkDuration } from '../task-timer'
import { dueStateOf, parseEstimate } from '../task-meta'
import { criteria, criteriaProgress } from './model'
import { stalledDays } from './staleness'
import { workDurationUnits } from './work-format'
import { pad2 } from './format'
import { fill, mdCell, mdCodeCell, mdInline, reportTimestamp, safeSlug } from './markdown'

export const DIGEST_WINDOWS = [7, 14, 30] as const
export type DigestWindow = (typeof DIGEST_WINDOWS)[number]
export const DIGEST_WINDOW_DEFAULT: DigestWindow = 7
export const DIGEST_EVENT_LIMIT = 30

export type DigestEventKind = 'created' | 'merged' | 'cleaned' | 'archived'

/** Stable tie-breaker order for events that share a timestamp. */
const EVENT_KIND_ORDER: Record<DigestEventKind, number> = {
  created: 0,
  merged: 1,
  cleaned: 2,
  archived: 3,
}

export interface DigestEvent {
  taskId: string
  title: string
  /** Current snapshot status; the UI maps it with boardStatusLabel. */
  status: string
  kind: DigestEventKind
  at: number
}

export interface ProjectDigest {
  windowDays: DigestWindow
  /** Inclusive local midnight of the first day in the window. */
  start: number
  /** Exclusive local midnight after today. */
  end: number
  created: number
  merged: number
  cleaned: number
  archived: number
  /** Distinct tasks with at least one event in the window. */
  changed: number
  /** Sum of elapsed work on tasks merged in the window (ms). */
  deliveredWorkMs: number
  /** Sum of valid estimates on tasks merged in the window. */
  deliveredPoints: number
  /** Merged-in-window tasks carrying a valid estimate. */
  deliveredEstimated: number
  /** Current open tasks: not archived, status not merged / cleaned. */
  open: number
  overdueOpen: number
  stalledOpen: number
  acceptanceChecked: number
  acceptanceTotal: number
  events: DigestEvent[]
  truncated: boolean
}

export interface ProjectDigestReportInput {
  project: Project
  digest: ProjectDigest
  t: Record<string, any>
  /** Localized status for one task view; the board and the report agree. */
  statusLabel: (view: TaskView) => string
  now?: number
}

/** 7 / 14 / 30 as a number or a numeric string; everything else is not a window. */
export function isDigestWindow(value: unknown): value is DigestWindow {
  const n = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() !== ''
      ? Number(value)
      : NaN
  return (DIGEST_WINDOWS as readonly number[]).includes(n)
}

/** Finite, positive timestamps only; everything else reads as absent. */
function stamp(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Local midnight of `now` shifted by `offset` days (DST and month rolls hold). */
function localMidnight(now: number, offset: number): number {
  const date = new Date(now)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset).getTime()
}

/** Localized name of one event kind, shared by the list and the report. */
function kindText(t: Record<string, any>, kind: DigestEventKind): string {
  switch (kind) {
    case 'created': return String(t.digestCreated)
    case 'merged': return String(t.digestMerged)
    case 'cleaned': return String(t.digestCleaned)
    default: return String(t.digestArchived)
  }
}

/**
 * Window aggregate for one project. `windowDays` falls back to 7 when it is
 * not 7 / 14 / 30, and `now` falls back to the wall clock so a broken caller
 * never produces an empty or negative window.
 */
export function buildProjectDigest(
  views: TaskView[],
  windowDays: unknown = DIGEST_WINDOW_DEFAULT,
  now: number = Date.now(),
): ProjectDigest {
  const list = Array.isArray(views) ? views : []
  const windowValue: DigestWindow = isDigestWindow(windowDays)
    ? (Number(windowDays) as DigestWindow)
    : DIGEST_WINDOW_DEFAULT
  const at = typeof now === 'number' && Number.isFinite(now) ? now : Date.now()
  const start = localMidnight(at, -(windowValue - 1))
  const end = localMidnight(at, 1)

  let created = 0
  let merged = 0
  let cleaned = 0
  let archived = 0
  let deliveredWorkMs = 0
  let deliveredPoints = 0
  let deliveredEstimated = 0
  let open = 0
  let overdueOpen = 0
  let stalledOpen = 0
  let acceptanceChecked = 0
  let acceptanceTotal = 0
  const changedIds = new Set<string>()
  const events: DigestEvent[] = []

  for (const view of list) {
    if (!view || !view.task) continue
    const task = view.task
    const snapshot: any = view.snapshot || {}
    const status = String(snapshot.status || '')
    const taskId = String(task.id == null ? '' : task.id)
    const title = String(task.title == null ? '' : task.title)

    const push = (kind: DigestEventKind, value: unknown) => {
      const when = stamp(value)
      // Half-open window: today's events are in, the first day's prior
      // millisecond and everything after tomorrow's midnight are out.
      if (when == null || when < start || when >= end) return
      if (kind === 'created') created += 1
      else if (kind === 'merged') merged += 1
      else if (kind === 'cleaned') cleaned += 1
      else archived += 1
      changedIds.add(taskId)
      events.push({ taskId, title, status, kind, at: when })
    }

    push('created', task.createdAt)
    push('merged', task.mergedAt)
    push('cleaned', task.cleanedAt)
    push('archived', task.archivedAt)

    // Delivery figures count only merges inside the window: work time is the
    // task's accumulated total (a running interval included), never split.
    const mergedAt = stamp(task.mergedAt)
    if (mergedAt != null && mergedAt >= start && mergedAt < end) {
      const work = elapsedWorkMs(task, at)
      deliveredWorkMs += Number.isFinite(work) && work > 0 ? work : 0
      const estimate = parseEstimate(task.estimate)
      if (estimate.ok && estimate.value != null) {
        deliveredPoints += estimate.value
        deliveredEstimated += 1
      }
    }

    const isArchived = stamp(task.archivedAt) != null
    const isOpen = !isArchived && status !== 'merged' && status !== 'cleaned'
    if (isOpen) {
      open += 1
      if (dueStateOf(task.dueAt, at)?.kind === 'overdue') overdueOpen += 1
      if (stalledDays(task, snapshot, at) != null) stalledOpen += 1
    }

    // Merged / cleaned tasks read as checked through `criteria`'s own rule.
    const progress = criteriaProgress(criteria(task, status as any))
    acceptanceChecked += progress.checked
    acceptanceTotal += progress.total
  }

  // Newest first, then raw title, then id, then a fixed kind order: the same
  // input always produces the same list, whatever the locale.
  events.sort((a, b) => b.at - a.at
    || (a.title < b.title ? -1 : a.title > b.title ? 1 : 0)
    || (a.taskId < b.taskId ? -1 : a.taskId > b.taskId ? 1 : 0)
    || EVENT_KIND_ORDER[a.kind] - EVENT_KIND_ORDER[b.kind])

  const total = events.length
  const kept = events.slice(0, DIGEST_EVENT_LIMIT)
  const work = Number.isFinite(deliveredWorkMs)
    ? Math.min(Math.max(deliveredWorkMs, 0), Number.MAX_SAFE_INTEGER)
    : 0

  return {
    windowDays: windowValue,
    start,
    end,
    created,
    merged,
    cleaned,
    archived,
    changed: changedIds.size,
    deliveredWorkMs: work,
    deliveredPoints,
    deliveredEstimated,
    open,
    overdueOpen,
    stalledOpen,
    acceptanceChecked,
    acceptanceTotal,
    events: kept,
    truncated: total > kept.length,
  }
}

/**
 * Build the digest Markdown body. Sections keep a fixed order — title, project
 * metadata, window changes, current status, change details, notes — so two
 * digests of the same project stay comparable. Per-task acceptance criteria,
 * notes, diffs and file lists belong to the project report and are never
 * repeated here.
 */
export function buildProjectDigestReport(input: ProjectDigestReportInput): string {
  const { project, digest, t, statusLabel } = input
  const now = input.now == null ? Date.now() : input.now
  const lines: string[] = []

  // The last inclusive day is the local day before the exclusive `end`.
  const endDate = new Date(digest.end)
  const lastDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() - 1).getTime()
  const day = (value: number) => reportTimestamp(value).slice(0, 10)

  lines.push(`# ${mdInline(t.digestReportTitle)}`, '')

  lines.push(`- ${t.digestReportProject}: ${mdInline(project && project.name ? project.name : '—')}`)
  lines.push(`- ${t.digestReportRepo}: ${mdCodeCell(project && project.repoPath ? project.repoPath : '—')}`)
  lines.push(`- ${t.digestReportBase}: ${mdCodeCell(project && project.baseBranch ? project.baseBranch : '—')}`)
  lines.push(`- ${t.digestReportWindow}: ${mdInline(fill(t.digestWindowDays, { n: digest.windowDays }))}`)
  lines.push(`- ${t.digestReportRange}: ${day(digest.start)} ~ ${day(lastDay)}`)
  lines.push(`- ${t.digestReportGeneratedAt}: ${reportTimestamp(now)}`)
  lines.push('')

  lines.push(`## ${t.digestReportChanges}`)
  lines.push(`- ${fill(t.digestReportCount, { label: t.digestCreated, n: digest.created })}`)
  lines.push(`- ${fill(t.digestReportCount, { label: t.digestMerged, n: digest.merged })}`)
  lines.push(`- ${fill(t.digestReportCount, { label: t.digestCleaned, n: digest.cleaned })}`)
  lines.push(`- ${fill(t.digestReportCount, { label: t.digestArchived, n: digest.archived })}`)
  lines.push(`- ${fill(t.digestReportChanged, { n: digest.changed })}`)
  const workText = digest.deliveredWorkMs > 0
    ? formatWorkDuration(digest.deliveredWorkMs, workDurationUnits(t))
    : String(t.digestReportNoWork)
  lines.push(`- ${fill(t.digestReportDeliveredWork, { value: workText })}`)
  lines.push(`- ${fill(t.digestReportPoints, {
    points: digest.deliveredPoints,
    estimated: digest.deliveredEstimated,
    merged: digest.merged,
  })}`)
  lines.push('')

  lines.push(`## ${t.digestReportCurrent}`)
  lines.push(`- ${fill(t.digestReportOpen, { n: digest.open })}`)
  lines.push(`- ${fill(t.digestReportOverdue, { n: digest.overdueOpen })}`)
  lines.push(`- ${fill(t.digestReportStalled, { n: digest.stalledOpen })}`)
  lines.push(`- ${fill(t.digestReportAcceptance, { checked: digest.acceptanceChecked, total: digest.acceptanceTotal })}`)
  lines.push('')

  lines.push(`## ${t.digestReportEvents}`)
  if (!digest.events.length) {
    lines.push(String(t.digestReportEmpty))
  } else {
    for (const event of digest.events) {
      const status = statusLabel({ task: { id: event.taskId }, snapshot: { status: event.status } } as unknown as TaskView)
      lines.push(`- ${fill(t.digestEventLabel, {
        date: day(event.at),
        kind: kindText(t, event.kind),
        title: mdCell(event.title || '—'),
        status: mdCell(status || '—'),
      })}`)
    }
    if (digest.truncated) lines.push(`- ${fill(t.digestReportTruncated, { n: digest.events.length })}`)
  }
  lines.push('')

  lines.push(`## ${t.digestReportNotes}`)
  lines.push(String(t.digestReportNotesBody))

  return lines.join('\n').replace(/\n+$/, '\n')
}

/**
 * `digest-<slug>-<YYYYMMDD>-<HHmm>.md` in the browser's local time. `now` is
 * injectable so tests do not depend on the clock.
 */
export function digestFilename(project: Project, now: number = Date.now()): string {
  const at = typeof now === 'number' && Number.isFinite(now) ? now : Date.now()
  const date = new Date(at)
  const stampText = String(date.getFullYear())
    + pad2(date.getMonth() + 1)
    + pad2(date.getDate())
    + '-'
    + pad2(date.getHours())
    + pad2(date.getMinutes())
  const id8 = String((project && project.id) || '').replace(/[^0-9a-zA-Z]/g, '').slice(0, 8).toLowerCase()
  // `safeSlug` folds a non-ASCII display name away; the id keeps the file usable.
  return `digest-${safeSlug(project && project.name, id8 || 'project')}-${stampText}.md`
}
