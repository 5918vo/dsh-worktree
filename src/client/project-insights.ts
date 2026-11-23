/**
 * Project insights: cycle time, 7-day throughput, acceptance coverage and the
 * oldest open task — all derived from the task records already on screen.
 *
 * Pure functions only: no Git calls, no state writes, no clock reads unless
 * `now` is omitted (the caller passes one value so every bucket shares the same
 * local day). Invalid, missing or future timestamps are ignored or clamped to
 * zero so the card never shows NaN / Infinity / negative numbers.
 */

import type { TaskView } from '../models'
import { parseEstimate } from '../task-meta'
import { criteria, criteriaProgress } from './model'

export const INSIGHTS_DAYS = 7

const DAY_MS = 86400000

export interface InsightDay {
  /** Days relative to today: -6 .. 0, where 0 is today. */
  offset: number
  /** Local midnight timestamp, used for the tooltip. */
  start: number
  created: number
  merged: number
}

export interface ProjectInsights {
  total: number
  open: number
  merged: number
  archived: number
  createdLast7: number
  mergedLast7: number
  /** Merged tasks that produced a usable cycle sample. */
  cycleSamples: number
  cycleMedianDays: number | null
  cycleAverageDays: number | null
  acceptanceChecked: number
  acceptanceTotal: number
  /** Integer 0..100; null when no task has acceptance criteria. */
  acceptancePercent: number | null
  oldestOpenDays: number | null
  /** Sum of valid estimates across open tasks, in points. */
  openEstimatePoints: number
  /** Open tasks carrying a valid estimate. */
  estimatedOpen: number
  /** Open tasks with no (or an invalid) estimate. */
  unestimatedOpen: number
  /** Integer 0..100; null when there are no open tasks. */
  estimateCoveragePercent: number | null
  statusCounts: Record<string, number>
  /** The last 7 local calendar days, in ascending order. */
  daily: InsightDay[]
}

/** Finite, positive timestamps only; everything else is treated as absent. */
function stamp(value: any): number | null {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

/** Local midnight of `now` shifted by `offset` days (handles DST and month rolls). */
function localMidnight(now: number, offset: number): number {
  const date = new Date(now)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset).getTime()
}

/**
 * Build the insight figures for a project. `now` is injectable so tests do not
 * depend on the wall clock.
 */
export function buildProjectInsights(views: TaskView[], now: number = Date.now()): ProjectInsights {
  const list = Array.isArray(views) ? views : []
  const at = Number.isFinite(now) ? now : Date.now()

  // Seven local-day buckets; each ends at the next local midnight, so a DST
  // shift never drags a boundary into the neighbouring day.
  const starts: number[] = []
  for (let offset = -(INSIGHTS_DAYS - 1); offset <= 0; offset += 1) starts.push(localMidnight(at, offset))
  const daily: InsightDay[] = starts.map((start, index) => ({
    offset: index - (INSIGHTS_DAYS - 1),
    start,
    created: 0,
    merged: 0,
  }))

  const bucketOf = (value: number): InsightDay | null => {
    for (let i = 0; i < daily.length; i += 1) {
      const end = i + 1 < starts.length ? starts[i + 1] : localMidnight(at, 1)
      if (value >= starts[i] && value < end) return daily[i]
    }
    return null
  }

  let archived = 0
  let merged = 0
  let open = 0
  let createdLast7 = 0
  let mergedLast7 = 0
  let acceptanceChecked = 0
  let acceptanceTotal = 0
  let oldestOpenDays: number | null = null
  let openEstimatePoints = 0
  let estimatedOpen = 0
  let unestimatedOpen = 0
  const cycles: number[] = []
  const statusCounts: Record<string, number> = {}

  for (const view of list) {
    const task = (view && view.task) || ({} as any)
    const snapshot = (view && view.snapshot) || ({} as any)
    const status = String(snapshot.status || 'unknown')
    statusCounts[status] = (statusCounts[status] || 0) + 1

    const created = stamp(task.createdAt)
    const mergedAt = stamp(task.mergedAt)
    const isArchived = stamp(task.archivedAt) != null
    const isMerged = status === 'merged' || mergedAt != null

    if (isArchived) archived += 1
    if (isMerged) merged += 1
    const isOpen = !isArchived && status !== 'merged' && status !== 'cleaned'
    if (isOpen) {
      open += 1
      const estimate = parseEstimate(task.estimate)
      if (estimate.ok && estimate.value != null) {
        openEstimatePoints += estimate.value
        estimatedOpen += 1
      } else {
        unestimatedOpen += 1
      }
    }

    // Cycle: only merged tasks with an ordered, valid pair. A merge recorded
    // before the creation time is corrupt, not a negative duration; a future
    // timestamp is not evidence of a completed cycle either.
    if (isMerged && created != null && mergedAt != null && created <= at && mergedAt <= at && mergedAt >= created) {
      cycles.push((mergedAt - created) / DAY_MS)
    }

    // 7-day throughput: both events are counted independently, so a task
    // created and merged on the same day shows in both bars.
    if (created != null) {
      const bucket = bucketOf(created)
      if (bucket) {
        bucket.created += 1
        createdLast7 += 1
      }
    }
    if (mergedAt != null) {
      const bucket = bucketOf(mergedAt)
      if (bucket) {
        bucket.merged += 1
        mergedLast7 += 1
      }
    }

    // Acceptance coverage counts every task that carries criteria.
    const progress = criteriaProgress(criteria(task, status as any))
    acceptanceChecked += progress.checked
    acceptanceTotal += progress.total

    // Oldest open: archived tasks and merged/cleaned ones never count; a
    // future creation time clamps to 0 days instead of going negative.
    if (!isArchived && status !== 'merged' && status !== 'cleaned' && created != null) {
      const days = Math.max(0, Math.floor((at - created) / DAY_MS))
      oldestOpenDays = oldestOpenDays == null ? days : Math.max(oldestOpenDays, days)
    }
  }

  let cycleAverageDays: number | null = null
  let cycleMedianDays: number | null = null
  if (cycles.length) {
    const sum = cycles.reduce((acc, value) => acc + value, 0)
    cycleAverageDays = round1(sum / cycles.length)
    const sorted = cycles.slice().sort((a, b) => a - b)
    const middle = Math.floor(sorted.length / 2)
    cycleMedianDays = round1(sorted.length % 2
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2)
  }

  return {
    total: list.length,
    open,
    merged,
    archived,
    createdLast7,
    mergedLast7,
    cycleSamples: cycles.length,
    cycleMedianDays,
    cycleAverageDays,
    acceptanceChecked,
    acceptanceTotal,
    acceptancePercent: acceptanceTotal ? Math.round((acceptanceChecked / acceptanceTotal) * 100) : null,
    oldestOpenDays,
    openEstimatePoints,
    estimatedOpen,
    unestimatedOpen,
    estimateCoveragePercent: open ? Math.round((estimatedOpen / open) * 100) : null,
    statusCounts,
    daily,
  }
}
