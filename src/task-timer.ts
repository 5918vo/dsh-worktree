/**
 * Work-time accounting for a task.
 *
 * Pure functions only: the store, the board and both reports call the same
 * helpers, so a duration is computed and rendered identically everywhere. The
 * clock is injectable so no test depends on the real time.
 *
 * Units are deliberately locale-free (`分` / `小时` / `天`): the label around a
 * duration is translated by the caller, but the number itself must not differ
 * between the interface, the tools and the reports.
 */

export interface TimerSnapshot {
  workMs?: unknown
  workStartedAt?: unknown
}

/** Overflow guard: a broken clock must never push the ledger past this. */
const MAX_MS = Number.MAX_SAFE_INTEGER

const MINUTE = 60 * 1000

/** Recorded milliseconds: finite non-negative numbers only, everything else is 0. */
function recordedMs(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0
  return Math.min(value, MAX_MS)
}

/** A running interval start: finite positive numbers only, everything else means idle. */
function startedAtMs(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return Math.min(value, MAX_MS)
}

/** Injected clock; a missing or broken `now` falls back to the real time. */
function clockMs(now: unknown): number {
  return typeof now === 'number' && Number.isFinite(now) ? now : Date.now()
}

/** One running interval; a start in the future (clock skew) counts as 0, never negative. */
function intervalMs(startedAt: number, now: unknown): number {
  const spent = clockMs(now) - startedAt
  return spent > 0 ? spent : 0
}

/** Recorded time plus the interval that is still running. */
export function elapsedWorkMs(task: TimerSnapshot, now?: number): number {
  const recorded = recordedMs(task && task.workMs)
  const startedAt = startedAtMs(task && task.workStartedAt)
  if (startedAt == null) return recorded
  return Math.min(recorded + intervalMs(startedAt, now), MAX_MS)
}

/**
 * Fields to write when starting: both values are new; the input is untouched.
 * Starting an already running timer keeps the original stamp, so a double click
 * never restarts (or loses) the interval.
 */
export function startWorkTimer(task: TimerSnapshot, now?: number): { workMs: number; workStartedAt: number } {
  const recorded = recordedMs(task && task.workMs)
  const startedAt = startedAtMs(task && task.workStartedAt)
  if (startedAt != null) return { workMs: recorded, workStartedAt: startedAt }
  return { workMs: recorded, workStartedAt: clockMs(now) }
}

/**
 * Fields to write when stopping: the running interval is folded into the total
 * and the start stamp is dropped (the store deletes the key, it never writes
 * `undefined`). Stopping an idle timer is a no-op.
 */
export function stopWorkTimer(task: TimerSnapshot, now?: number): { workMs: number; workStartedAt?: undefined } {
  const recorded = recordedMs(task && task.workMs)
  const startedAt = startedAtMs(task && task.workStartedAt)
  if (startedAt == null) return { workMs: recorded, workStartedAt: undefined }
  return { workMs: Math.min(recorded + intervalMs(startedAt, now), MAX_MS), workStartedAt: undefined }
}

/**
 * Human readable duration: `不足 1 分` / `45 分` / `2 小时 15 分` / `3 天 4 小时`.
 *
 * 0, negative, NaN and Infinity all render as `不足 1 分` — never `NaN`; the
 * caller decides whether "no record" is a better label.
 */
export function formatWorkDuration(ms: unknown): string {
  const total = typeof ms === 'number' && Number.isFinite(ms) && ms > 0 ? Math.min(ms, MAX_MS) : 0
  if (total < MINUTE) return '不足 1 分'
  const minutes = Math.floor(total / MINUTE)
  if (minutes < 60) return `${minutes} 分`
  const hours = Math.floor(minutes / 60)
  const restMinutes = minutes % 60
  if (hours < 24) return restMinutes ? `${hours} 小时 ${restMinutes} 分` : `${hours} 小时`
  const days = Math.floor(hours / 24)
  const restHours = hours % 24
  return restHours ? `${days} 天 ${restHours} 小时` : `${days} 天`
}

/** Whether the task currently has a running timer (shared by the store and the client). */
export function isWorkTiming(task: TimerSnapshot): boolean {
  return startedAtMs(task && task.workStartedAt) != null
}

/** True when the task carries a work-time record at all; otherwise show 「未记录」. */
export function hasWorkRecord(task: TimerSnapshot): boolean {
  return recordedMs(task && task.workMs) > 0 || isWorkTiming(task)
}
