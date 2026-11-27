/**
 * Cross-project portfolio: one aggregate row per project plus the global
 * totals and the last seven local calendar days of created / merged activity.
 *
 * Pure functions only: no Git calls, no writes, no clock reads unless `now` is
 * omitted. Every figure reuses the helper that the matching surface already
 * trusts — `buildProjectRisk` for risk, `parseEstimate` for points,
 * `dependencyStatus` for blockers and `dueStateOf` for overdue tasks — so the
 * overview never invents a second definition. Invalid, missing or future
 * timestamps degrade to "absent" or zero, never to NaN or a negative number.
 */

import type { ProjectView, TaskView } from '../models'
import { dueStateOf, parseEstimate } from '../task-meta'
import { dependencyStatus } from '../task-deps'
import { buildProjectRisk } from './project-risk'

export const PORTFOLIO_DAYS = 7

const DAY_MS = 86400000

/** Minimal attention shape the overview needs; the board callback supplies it. */
export interface PortfolioAttention {
  categories: Set<string>
}

export interface PortfolioProject {
  projectId: string
  name: string
  repoPath: string
  /** Not archived, and not merged or cleaned. */
  open: number
  /** Tasks the injected `attentionOf` callback flagged with at least one category. */
  attention: number
  /** Open tasks whose due date is before today. */
  overdue: number
  /** Open tasks with at least one unfinished or missing prerequisite. */
  blocked: number
  /** Open tasks waiting for acceptance (status `review` / `reviewing`). */
  review: number
  /** Merges recorded inside the last seven local days. */
  mergedLast7: number
  highRisk: number
  mediumRisk: number
  /** Estimate points summed across open tasks; invalid estimates are skipped. */
  estimatePoints: number
  /** Whole days since the oldest open task was created; null when none is open. */
  oldestOpenDays: number | null
}

export interface PortfolioDay {
  /** Days relative to today: -6 .. 0, where 0 is today. */
  offset: number
  /** Local midnight timestamp, used for the tooltip. */
  start: number
  created: number
  merged: number
}

export interface PortfolioTotals {
  projects: number
  open: number
  attention: number
  overdue: number
  blocked: number
  review: number
  mergedLast7: number
  highRisk: number
  mediumRisk: number
  estimatePoints: number
}

export interface PortfolioSummary {
  /** Every project, in the order given. */
  projects: PortfolioProject[]
  /** Projects sorted for display; the input array is never mutated. */
  ranked: PortfolioProject[]
  totals: PortfolioTotals
  /** The last 7 local calendar days, in ascending order. */
  daily: PortfolioDay[]
}

export interface PortfolioInput {
  views: ProjectView[]
  /** Board attention lookup; omitted means "no attention data", not "compute some". */
  attentionOf?: ((view: TaskView) => PortfolioAttention | null) | null
  now?: number
}

/** Finite, positive timestamps only; everything else is treated as absent. */
function stamp(value: any): number | null {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Local midnight of `now` shifted by `offset` days (handles DST and month rolls). */
function localMidnight(now: number, offset: number): number {
  const date = new Date(now)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset).getTime()
}

function isOpen(task: any, status: string): boolean {
  if (stamp(task && task.archivedAt) != null) return false
  return status !== 'merged' && status !== 'cleaned'
}

function reviewOf(status: string): boolean {
  return status === 'review' || status === 'reviewing'
}

/**
 * Build the portfolio summary. `now` is injectable so tests do not depend on
 * the wall clock; every bucket shares that one value.
 */
export function buildPortfolio(input: PortfolioInput): PortfolioSummary {
  const source = input || ({} as PortfolioInput)
  const views = Array.isArray(source.views) ? source.views : []
  const attentionOf = typeof source.attentionOf === 'function' ? source.attentionOf : null
  const rawNow = Number(source.now)
  const at = Number.isFinite(rawNow) ? rawNow : Date.now()

  // Seven local-day buckets; each ends at the next local midnight so a DST
  // shift never drags a boundary into the neighbouring day.
  const starts: number[] = []
  for (let offset = -(PORTFOLIO_DAYS - 1); offset <= 0; offset += 1) starts.push(localMidnight(at, offset))
  const daily: PortfolioDay[] = starts.map((start, index) => ({
    offset: index - (PORTFOLIO_DAYS - 1),
    start,
    created: 0,
    merged: 0,
  }))
  const windowStart = starts[0]
  const windowEnd = localMidnight(at, 1)

  const bucketOf = (value: number): PortfolioDay | null => {
    if (!(value >= windowStart && value < windowEnd)) return null
    for (let i = 0; i < starts.length; i += 1) {
      const end = i + 1 < starts.length ? starts[i + 1] : windowEnd
      if (value >= starts[i] && value < end) return daily[i]
    }
    return null
  }

  // Dependencies resolve across projects, so build the lookup from every task
  // before scoring a single project.
  const lookup = new Map<string, any>()
  for (const view of views) {
    const tasks = Array.isArray(view && view.tasks) ? view.tasks : []
    for (const taskView of tasks) {
      const task = taskView && taskView.task
      if (task && typeof task.id === 'string' && task.id) lookup.set(task.id, task)
    }
  }

  const projects: PortfolioProject[] = []
  const totals: PortfolioTotals = {
    projects: views.length,
    open: 0,
    attention: 0,
    overdue: 0,
    blocked: 0,
    review: 0,
    mergedLast7: 0,
    highRisk: 0,
    mediumRisk: 0,
    estimatePoints: 0,
  }

  for (const view of views) {
    const project = (view && view.project) || ({} as any)
    const tasks = Array.isArray(view && view.tasks) ? view.tasks : []
    const row: PortfolioProject = {
      projectId: String(project.id || ''),
      name: String(project.name || project.repoPath || project.id || ''),
      repoPath: String(project.repoPath || ''),
      open: 0,
      attention: 0,
      overdue: 0,
      blocked: 0,
      review: 0,
      mergedLast7: 0,
      highRisk: 0,
      mediumRisk: 0,
      estimatePoints: 0,
      oldestOpenDays: null,
    }

    for (const taskView of tasks) {
      const task = (taskView && taskView.task) || ({} as any)
      const snapshot = (taskView && taskView.snapshot) || ({} as any)
      const status = String(snapshot.status || '')
      const created = stamp(task.createdAt)
      const mergedAt = stamp(task.mergedAt)

      if (created != null) {
        const bucket = bucketOf(created)
        if (bucket) bucket.created += 1
      }
      if (mergedAt != null) {
        const bucket = bucketOf(mergedAt)
        if (bucket) bucket.merged += 1
        if (mergedAt >= windowStart && mergedAt < windowEnd) row.mergedLast7 += 1
      }

      if (attentionOf) {
        const attention = attentionOf(taskView)
        if (attention && attention.categories && attention.categories.size > 0) row.attention += 1
      }

      if (!isOpen(task, status)) continue
      row.open += 1

      const due = dueStateOf(stamp(task.dueAt), at)
      if (due && due.kind === 'overdue') row.overdue += 1

      const deps = dependencyStatus(task, lookup)
      if (deps.open.length + deps.missing.length > 0) row.blocked += 1

      if (reviewOf(status)) row.review += 1

      const estimate = parseEstimate(task.estimate)
      if (estimate.ok && estimate.value != null) row.estimatePoints += estimate.value

      if (created != null) {
        const days = Math.max(0, Math.floor((at - created) / DAY_MS))
        row.oldestOpenDays = row.oldestOpenDays == null ? days : Math.max(row.oldestOpenDays, days)
      }
    }

    const risk = buildProjectRisk(tasks, at)
    row.highRisk = risk.high
    row.mediumRisk = risk.medium

    totals.open += row.open
    totals.attention += row.attention
    totals.overdue += row.overdue
    totals.blocked += row.blocked
    totals.review += row.review
    totals.mergedLast7 += row.mergedLast7
    totals.highRisk += row.highRisk
    totals.mediumRisk += row.mediumRisk
    totals.estimatePoints += row.estimatePoints

    projects.push(row)
  }

  const ranked = projects.slice().sort((a, b) =>
    b.attention - a.attention ||
    b.overdue - a.overdue ||
    b.blocked - a.blocked ||
    b.open - a.open ||
    a.name.localeCompare(b.name) ||
    a.projectId.localeCompare(b.projectId))

  return { projects, ranked, totals, daily }
}
