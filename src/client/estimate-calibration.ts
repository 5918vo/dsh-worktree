/**
 * Estimate calibration: derive actual hours per estimate point from tasks that
 * carry both a size estimate and recorded work.
 *
 * Pure derivation only: no Git calls, no state writes, no clock reads unless
 * `now` is omitted (the caller passes one value so every sample shares the same
 * instant, including a running timer). Invalid, missing, future or corrupt
 * fields degrade to "absent" or 0 so the card never shows NaN / Infinity or a
 * negative duration.
 *
 * The ratio is deliberately a pooled average (`totalWorkMs / totalPoints`),
 * not a per-task weighted mean: the question the card answers is "when I plan
 * an unestimated task, how many hours should one point cost?", and the pooled
 * ratio is exactly that budget multiplier.
 */

import type { TaskView } from '../models'
import { parseEstimate } from '../task-meta'
import { elapsedWorkMs } from '../task-timer'

const HOUR_MS = 3600000

/** Overflow guard: a broken record must never push a sum past this. */
const MAX_MS = Number.MAX_SAFE_INTEGER

export interface CalibrationSample {
  taskId: string
  title: string
  /** Size estimate in points (one of 1/2/3/5/8). */
  estimate: number
  /** Elapsed work, including a running timer. */
  workMs: number
  /** `workMs` in hours. */
  hours: number
  /** `estimate * hoursPerPoint`. */
  expectedHours: number
  /** Rounded `((hours - expectedHours) / expectedHours) * 100`; 0 when expectedHours <= 0. */
  variancePercent: number
}

export interface EstimateCalibration {
  /** Sorted by |variancePercent| desc, then hours desc, then taskId. */
  samples: CalibrationSample[]
  sampleCount: number
  totalPoints: number
  totalWorkMs: number
  /** `totalWorkMs / totalPoints / 3600000`; null when there is no sample. */
  hoursPerPoint: number | null
  /** >=6 high, >=3 medium, else low. */
  confidence: 'low' | 'medium' | 'high'
  /** Tasks carrying a valid estimate, with or without recorded work. */
  estimatedTasks: number
  totalTasks: number
  /** `estimatedTasks / totalTasks * 100`, rounded; null when totalTasks=0. */
  coveragePercent: number | null
}

/** Injected clock; a missing or broken `now` falls back to the real time. */
function clockMs(now: unknown): number {
  return typeof now === 'number' && Number.isFinite(now) ? now : Date.now()
}

/** One usable task entry: a view object with a task object inside. */
function usableViews(views: unknown): TaskView[] {
  if (!Array.isArray(views)) return []
  return views.filter((view: any) =>
    view != null && typeof view === 'object' && view.task != null && typeof view.task === 'object') as TaskView[]
}

/** Percent of the expectation, rounded; 0 when there is nothing to compare against. */
function varianceOf(hours: number, expectedHours: number): number {
  if (!(expectedHours > 0) || !Number.isFinite(expectedHours)) return 0
  const percent = Math.round(((hours - expectedHours) / expectedHours) * 100)
  return Number.isFinite(percent) ? percent : 0
}

/**
 * Build the calibration view model for the retro tab. The input is never
 * mutated; `now` is injectable so tests do not depend on the wall clock.
 */
export function buildEstimateCalibration(views: TaskView[], now?: number): EstimateCalibration {
  const list = usableViews(views)
  const at = clockMs(now)

  let estimatedTasks = 0
  let totalPoints = 0
  let totalWorkMs = 0
  const seeds: Array<{ taskId: string; title: string; estimate: number; workMs: number; hours: number }> = []

  for (const view of list) {
    const task: any = (view as any).task
    const estimate = parseEstimate(task.estimate)
    const points = estimate.ok && estimate.value != null ? estimate.value : null

    // Coverage counts every valid estimate, whether work exists or not.
    if (points != null) estimatedTasks += 1
    if (points == null) continue

    // elapsedWorkMs already clamps negatives, future starts and non-numbers.
    const rawWorkMs = elapsedWorkMs(task, at)
    const workMs = Number.isFinite(rawWorkMs) && rawWorkMs > 0 ? Math.min(rawWorkMs, MAX_MS) : 0
    if (workMs <= 0) continue

    const taskId = String(task.id == null ? '' : task.id)
    const title = String(task.title == null ? '' : task.title)
    seeds.push({ taskId, title, estimate: points, workMs, hours: workMs / HOUR_MS })
    totalPoints += points
    totalWorkMs += workMs
    if (!Number.isFinite(totalWorkMs)) totalWorkMs = MAX_MS
  }

  const hoursPerPoint = totalPoints > 0 && totalWorkMs > 0
    ? totalWorkMs / totalPoints / HOUR_MS
    : null

  const perPoint = hoursPerPoint != null && Number.isFinite(hoursPerPoint) && hoursPerPoint > 0
    ? hoursPerPoint
    : 0

  const samples: CalibrationSample[] = seeds.map((seed) => {
    const expectedHours = perPoint > 0 ? seed.estimate * perPoint : 0
    return {
      taskId: seed.taskId,
      title: seed.title,
      estimate: seed.estimate,
      workMs: seed.workMs,
      hours: seed.hours,
      expectedHours,
      variancePercent: varianceOf(seed.hours, expectedHours),
    }
  })

  samples.sort((a, b) => {
    const varianceDiff = Math.abs(b.variancePercent) - Math.abs(a.variancePercent)
    if (varianceDiff !== 0) return varianceDiff
    if (b.hours !== a.hours) return b.hours - a.hours
    return a.taskId < b.taskId ? -1 : a.taskId > b.taskId ? 1 : 0
  })

  const sampleCount = samples.length
  const confidence: EstimateCalibration['confidence'] =
    sampleCount >= 6 ? 'high' : sampleCount >= 3 ? 'medium' : 'low'

  return {
    samples,
    sampleCount,
    totalPoints,
    totalWorkMs,
    hoursPerPoint,
    confidence,
    estimatedTasks,
    totalTasks: list.length,
    coveragePercent: list.length ? Math.round((estimatedTasks / list.length) * 100) : null,
  }
}
