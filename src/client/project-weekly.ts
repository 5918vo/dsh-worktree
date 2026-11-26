/**
 * Project weekly digest: the last seven local calendar days of effort, progress
 * and risk as one Markdown document.
 *
 * Pure functions only — no Git, no writes, no clock reads beyond the injectable
 * `now` — so the clipboard text, the `.md` download and the unit tests all come
 * from the same code. Every factor reuses the helper the rest of the board
 * already trusts: `elapsedWorkMs` (task-timer), `parseEstimate` / `dueDayOffset`
 * and `dueInputValue` (task-meta), `stalledDays` (staleness) and
 * `dependencyStatus` (task-deps). Invalid, missing or future timestamps degrade
 * to "absent" so the digest never shows NaN.
 */

import type { Project, TaskView } from '../models'
import { dependencyStatus } from '../task-deps'
import { dueDayOffset, dueInputValue, parseEstimate } from '../task-meta'
import { elapsedWorkMs, formatWorkDuration } from '../task-timer'
import { pad2 } from './format'
import { fill, mdCell, mdCodeCell, mdInline, reportTimestamp, safeSlug } from './markdown'
import { stalledDays } from './staleness'
import { workDurationUnits } from './work-format'

/** The window is the last seven local calendar days, today included. */
export const WEEKLY_DAYS = 7

/** Task-detail rows in the Markdown body; the digest is a summary, not a dump. */
export const WEEKLY_MAX_TASKS = 30

export interface WeeklyDigestInput {
  project: Project
  views: TaskView[]
  t: Record<string, any>
  /** Localized status for one task view, shared with the project report. */
  statusLabel: (view: TaskView) => string
  now?: number
}

export interface WeeklyStats {
  newTasks: number
  mergedTasks: number
  workMs: number
  completedEstimatePoints: number
  blocked: number
  dueSoon: number
  stale: number
}

export interface WeeklyDigest {
  markdown: string
  filename: string
  /** Local midnight six days ago. */
  rangeStart: number
  /** Local midnight tomorrow, exclusive. */
  rangeEnd: number
  stats: WeeklyStats
  /** Tasks with any created / merged / updated activity inside the range. */
  activeCount: number
}

/** Finite, positive timestamps only; everything else reads as absent (0). */
function stamp(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Injected clock; a missing or broken `now` falls back to the real time. */
function clockMs(now: unknown): number {
  return typeof now === 'number' && Number.isFinite(now) ? now : Date.now()
}

/** `id8` of the project id: a usable fallback when the name has no ASCII. */
function id8(project: Project): string {
  const clean = String((project && project.id) || '').replace(/[^0-9a-zA-Z]/g, '').slice(0, 8).toLowerCase()
  return clean || 'project'
}

/** Local calendar `YYYY-MM-DD` of one timestamp. */
function localDate(value: number): string {
  const date = new Date(value)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/**
 * The digest window: start = local midnight six days ago, end = local midnight
 * tomorrow (exclusive). Built from local Y/M/D so a DST day shifts the clock,
 * never the calendar boundary.
 */
function windowOf(now: number): { rangeStart: number; rangeEnd: number } {
  const today = new Date(now)
  const year = today.getFullYear()
  const month = today.getMonth()
  const day = today.getDate()
  return {
    rangeStart: new Date(year, month, day - (WEEKLY_DAYS - 1)).getTime(),
    rangeEnd: new Date(year, month, day + 1).getTime(),
  }
}

/** Open = not archived, not merged and not cleaned up. */
function isOpen(task: any, status: string): boolean {
  if (!task) return false
  if (stamp(task.archivedAt) || stamp(task.mergedAt) || stamp(task.cleanedAt)) return false
  return status !== 'merged' && status !== 'cleaned'
}

/** Newest of the three activity stamps; the row's sort key and in-range test. */
function activityOf(task: any): number {
  return Math.max(stamp(task && task.createdAt), stamp(task && task.mergedAt), stamp(task && task.updatedAt))
}

function estimateText(t: Record<string, any>, value: unknown): string {
  const estimate = parseEstimate(value)
  return estimate.ok && estimate.value != null
    ? fill(t.calibrationPoints, { n: estimate.value })
    : String(t.taskEstimateEmpty)
}

/**
 * Build the weekly digest for one project. The views are read, never modified;
 * an invalid `now` falls back to the real clock.
 */
export function buildWeeklyDigest(input: WeeklyDigestInput): WeeklyDigest {
  const { project, t, statusLabel } = input
  const list = Array.isArray(input.views) ? input.views : []
  const at = clockMs(input.now)
  const { rangeStart, rangeEnd } = windowOf(at)

  // Dependencies may point at closed tasks (done) or at rows that no longer
  // exist (missing); the lookup covers every row so the helper sees the truth.
  const lookup = new Map<string, any>()
  for (const view of list) {
    const task = view && view.task
    if (task && typeof task.id === 'string' && task.id) lookup.set(task.id, task)
  }

  const stats: WeeklyStats = {
    newTasks: 0,
    mergedTasks: 0,
    workMs: 0,
    completedEstimatePoints: 0,
    blocked: 0,
    dueSoon: 0,
    stale: 0,
  }

  const active: TaskView[] = []
  const inRange = (value: number) => value > 0 && value >= rangeStart && value < rangeEnd

  for (const view of list) {
    const task = (view && view.task) || ({} as any)
    const snapshot = (view && view.snapshot) || ({} as any)
    const status = String(snapshot.status || '')
    const created = stamp(task.createdAt)
    const merged = stamp(task.mergedAt)

    if (inRange(created)) stats.newTasks += 1
    if (inRange(merged)) {
      stats.mergedTasks += 1
      const estimate = parseEstimate(task.estimate)
      if (estimate.ok && estimate.value != null) stats.completedEstimatePoints += estimate.value
    }

    if (inRange(activityOf(task))) {
      active.push(view)
      // Accumulated total including a running interval: the ledger's current word.
      stats.workMs += elapsedWorkMs(task, at)
    }

    if (!isOpen(task, status)) continue
    if (dependencyStatus(task, lookup).blocked) stats.blocked += 1
    const offset = dueDayOffset(stamp(task.dueAt) || null, at)
    if (offset != null && offset >= 0 && offset <= WEEKLY_DAYS) stats.dueSoon += 1
    const stalled = stalledDays(task, snapshot, at)
    if (stalled != null && stalled > 0) stats.stale += 1
  }

  // Newest activity first; ties fall back to the title then the id so two
  // digests of the same data keep one order.
  active.sort((a, b) => {
    const delta = activityOf(b && b.task) - activityOf(a && a.task)
    if (delta) return delta
    const at1 = String((a && a.task && a.task.title) || '')
    const at2 = String((b && b.task && b.task.title) || '')
    if (at1 !== at2) return at1 < at2 ? -1 : 1
    const idA = String((a && a.task && a.task.id) || '')
    const idB = String((b && b.task && b.task.id) || '')
    return idA < idB ? -1 : idA > idB ? 1 : 0
  })

  const rangeText = `${localDate(rangeStart)} ~ ${localDate(rangeEnd - 1)}`
  const units = workDurationUnits(t)
  const lines: string[] = []

  lines.push(`# ${mdInline(t.weeklyReportTitle)}`, '')

  lines.push(`- ${t.projectReportProject}: ${mdInline((project && project.name) || '—')}`)
  lines.push(`- ${t.projectReportRepo}: ${mdCodeCell((project && project.repoPath) || '—')}`)
  lines.push(`- ${t.projectReportBase}: ${mdCodeCell((project && project.baseBranch) || '—')}`)
  lines.push(`- ${t.weeklyRange}: ${mdInline(rangeText)}`)
  lines.push(`- ${t.weeklyGeneratedAt}: ${reportTimestamp(at)}`)
  lines.push('')

  // Summary before the task detail: one line per stat, the numbers the card shows.
  lines.push(`- ${t.weeklyNewTasks}: ${stats.newTasks}`)
  lines.push(`- ${t.weeklyMergedTasks}: ${stats.mergedTasks}`)
  lines.push(`- ${t.weeklyWork}: ${formatWorkDuration(stats.workMs, units)}`)
  lines.push(`- ${t.weeklyEstimatesDone}: ${stats.completedEstimatePoints}`)
  lines.push(`- ${t.weeklyBlocked}: ${stats.blocked}`)
  lines.push(`- ${t.weeklyDueSoon}: ${stats.dueSoon}`)
  lines.push(`- ${t.weeklyStale}: ${stats.stale}`)
  lines.push('')

  lines.push(`## ${t.weeklyTaskList}`)
  if (!active.length) {
    lines.push(String(t.weeklyNoActivity))
    return {
      markdown: lines.join('\n').replace(/\n+$/, '\n'),
      filename: weeklyDigestFilename(project, at),
      rangeStart,
      rangeEnd,
      stats,
      activeCount: 0,
    }
  }

  lines.push(`| ${t.weeklyColTask} | ${t.weeklyColStatus} | ${t.weeklyColWork} | ${t.weeklyColEstimate} | ${t.weeklyColDue} | ${t.weeklyColTags} |`)
  lines.push('| --- | --- | --- | --- | --- | --- |')
  for (const view of active.slice(0, WEEKLY_MAX_TASKS)) {
    const task = view.task || ({} as any)
    const tags = Array.isArray(task.tags) && task.tags.length ? task.tags.join(' ') : '—'
    const cells = [
      mdCell(task.title || '—'),
      mdCell(statusLabel(view) || '—'),
      mdCell(formatWorkDuration(elapsedWorkMs(task, at), units)),
      mdCell(estimateText(t, task.estimate)),
      mdCell(dueInputValue(task.dueAt) || '—'),
      mdCell(tags),
    ]
    lines.push('| ' + cells.join(' | ') + ' |')
  }
  lines.push('')

  return {
    markdown: lines.join('\n').replace(/\n+$/, '\n'),
    filename: weeklyDigestFilename(project, at),
    rangeStart,
    rangeEnd,
    stats,
    activeCount: active.length,
  }
}

/**
 * `project-<slug>-weekly-<YYYYMMDD>-<HHmm>.md` in the browser's local time.
 * `now` is injectable so tests do not depend on the clock.
 */
export function weeklyDigestFilename(project: Project, now?: number): string {
  const date = new Date(clockMs(now))
  const stamp = String(date.getFullYear())
    + pad2(date.getMonth() + 1)
    + pad2(date.getDate())
    + '-'
    + pad2(date.getHours())
    + pad2(date.getMinutes())
  return `project-${safeSlug(project && project.name, id8(project))}-weekly-${stamp}.md`
}
