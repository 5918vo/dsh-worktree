/**
 * Estimate calibration: pair each task's relative size estimate with the work
 * time it actually accumulated, so "1 point" can be read back as real effort.
 *
 * Pure functions only: this module never writes an estimate or a timer, never
 * touches Git and never reads a clock unless `now` is omitted. Only tasks that
 * carry both a valid estimate and recorded work become samples; invalid
 * estimates, zero / negative / NaN work and future timer starts are ignored so
 * the card never renders NaN, Infinity or a negative duration.
 *
 * The threshold is fixed at CALIBRATION_MIN_SAMPLES: with fewer samples the
 * averages stay `null` instead of pretending one task is a rate.
 */

import type { TaskView } from '../models'
import { parseEstimate } from '../task-meta'
import { elapsedWorkMs, isWorkTiming } from '../task-timer'

export const CALIBRATION_MIN_SAMPLES = 3
export const CALIBRATION_SAMPLE_LIMIT = 5

export interface CalibrationSample {
  taskId: string
  title: string
  points: number
  workMs: number
  /** workMs / points; always finite and > 0 for a valid sample. */
  msPerPoint: number
  /** True while the task's timer is still running. */
  running: boolean
}

export interface EstimateCalibration {
  /** Tasks with a valid estimate and recorded work. */
  samples: number
  /** Sum of valid estimate points across samples. */
  points: number
  /** Sum of elapsed work across samples. */
  workMs: number
  /** workMs / points; null when samples < CALIBRATION_MIN_SAMPLES or points <= 0. */
  averageMsPerPoint: number | null
  /** Median of per-sample msPerPoint; null under the same threshold. */
  medianMsPerPoint: number | null
  /** Tasks with a valid estimate (denominator for coverage). */
  estimated: number
  /** Tasks with recorded work (denominator for coverage). */
  timed: number
  /** Tasks with both (the sample count, repeated for readability). */
  both: number
  /** Integer 0..100; null when no task has an estimate. */
  estimateCoveragePercent: number | null
  /** Integer 0..100; null when no task has recorded work. */
  timingCoveragePercent: number | null
  /** Newest / largest samples first, capped at CALIBRATION_SAMPLE_LIMIT. */
  recent: CalibrationSample[]
  /** Samples above the cap are still counted in the totals. */
  truncated: boolean
}

/** Finite, positive durations only; 0 means "no recorded work". */
function positiveMs(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

/** Deterministic title order: no locale collation, so a rerun is identical. */
function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Build the calibration figures for a project. `now` is injectable so tests do
 * not depend on the wall clock and running timers use one shared instant.
 */
export function buildEstimateCalibration(
  views: TaskView[],
  now: number = Date.now(),
): EstimateCalibration {
  const list = Array.isArray(views) ? views : []
  const at = Number.isFinite(now) ? now : Date.now()

  let estimated = 0
  let timed = 0
  let points = 0
  let workMs = 0
  const samples: CalibrationSample[] = []

  for (const view of list) {
    const task = (view && view.task) || ({} as any)
    const estimate = parseEstimate(task.estimate)
    const taskPoints = estimate.ok ? estimate.value : null
    const hasEstimate = taskPoints != null && taskPoints > 0
    if (hasEstimate) estimated += 1

    const taskWork = positiveMs(elapsedWorkMs(task, at))
    if (taskWork != null) timed += 1

    // A sample needs both halves; one without the other still contributes to
    // its own coverage numerator but never to the calibration ratio.
    if (!hasEstimate || taskWork == null) continue
    const msPerPoint = taskWork / (taskPoints as number)
    if (!Number.isFinite(msPerPoint) || msPerPoint <= 0) continue

    samples.push({
      taskId: String(task.id == null ? '' : task.id),
      title: String(task.title == null ? '' : task.title),
      points: taskPoints as number,
      workMs: taskWork,
      msPerPoint,
      running: isWorkTiming(task),
    })
    points += taskPoints as number
    workMs += taskWork
  }

  let averageMsPerPoint: number | null = null
  let medianMsPerPoint: number | null = null
  if (samples.length >= CALIBRATION_MIN_SAMPLES && points > 0) {
    averageMsPerPoint = Math.round(workMs / points)
    const sorted = samples.map((sample) => sample.msPerPoint).sort((a, b) => a - b)
    const middle = Math.floor(sorted.length / 2)
    medianMsPerPoint = Math.round(sorted.length % 2
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2)
  }

  // Largest per-point cost first; ties fall back to points, then title, then id
  // so the list is stable for identical inputs.
  const ordered = samples.slice().sort((a, b) =>
    b.msPerPoint - a.msPerPoint
    || b.points - a.points
    || compareText(a.title, b.title)
    || compareText(a.taskId, b.taskId))
  const recent = ordered.slice(0, CALIBRATION_SAMPLE_LIMIT)

  const total = list.length
  return {
    samples: samples.length,
    points,
    workMs,
    averageMsPerPoint,
    medianMsPerPoint,
    estimated,
    timed,
    both: samples.length,
    estimateCoveragePercent: total ? Math.round((estimated / total) * 100) : null,
    timingCoveragePercent: total ? Math.round((timed / total) * 100) : null,
    recent,
    truncated: samples.length > recent.length,
  }
}
