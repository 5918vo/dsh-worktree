/**
 * Project activity: a 12-week (84-day) calendar heatmap derived from the task
 * records already on screen.
 *
 * Pure functions only: no Git calls, no state writes, and exactly one clock
 * read unless `now` is injected. Day buckets are **local** calendar days: the
 * grid is built from local Y/M/D arithmetic rather than UTC midnight, so a
 * timestamp near a UTC date boundary still lands on the day the user saw.
 *
 * Invalid, missing, negative or future timestamps are ignored so a cell never
 * shows a negative or impossible count.
 */

import type { TaskView } from '../models'

export const ACTIVITY_WEEKS = 12

/** Seven rows per column; Monday is the first row of every week. */
const DAYS_PER_WEEK = 7
const TOTAL_DAYS = ACTIVITY_WEEKS * DAYS_PER_WEEK

export interface ActivityDay {
  /** Local calendar key YYYY-MM-DD. */
  dateKey: string
  /** Local midnight timestamp. */
  start: number
  /** Days from the grid start (0..83). */
  offset: number
  /** 0 = Monday .. 6 = Sunday. */
  weekday: number
  /** Week column 0..11. */
  week: number
  created: number
  merged: number
  updated: number
  total: number
  /** 0 when total=0, otherwise 1..4 relative to the busiest day. */
  intensity: 0 | 1 | 2 | 3 | 4
  /** After today; always 0 counts, rendered invisible. */
  future: boolean
}

export interface ProjectActivity {
  /** 84 entries, column-major: week 0 Mon..Sun, then week 1... */
  days: ActivityDay[]
  /** 12 */
  weeks: number
  /** All event counts. */
  total: number
  /** Busiest day total. */
  max: number
  /** Local midnight of the Monday 11 weeks before this week. */
  start: number
  /** Local midnight of this week's Sunday. */
  end: number
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

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/** YYYY-MM-DD from the local calendar parts of a local-midnight timestamp. */
function dateKeyOf(start: number): string {
  const date = new Date(start)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** 0 = Monday .. 6 = Sunday for the local calendar day containing `value`. */
function weekdayOf(value: number): number {
  const date = new Date(value)
  return (new Date(date.getFullYear(), date.getMonth(), date.getDate()).getDay() + 6) % 7
}

function intensityOf(total: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (total <= 0 || max <= 0) return 0
  const ratio = total / max
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

/**
 * Build the 12-week heatmap for a project. `now` is injectable so tests do not
 * depend on the wall clock; a non-finite value falls back to the wall clock.
 */
export function buildProjectActivity(views: TaskView[], now: number = Date.now()): ProjectActivity {
  const list = Array.isArray(views) ? views : []
  const at = Number.isFinite(now) ? now : Date.now()

  const today = localMidnight(at, 0)
  const weekday = weekdayOf(at)
  // Monday of the current week, then 11 whole weeks back; 84 days reach Sunday.
  const firstOffset = -weekday - (ACTIVITY_WEEKS - 1) * DAYS_PER_WEEK

  const starts: number[] = []
  for (let i = 0; i <= TOTAL_DAYS; i += 1) starts.push(localMidnight(at, firstOffset + i))

  const days: ActivityDay[] = []
  for (let offset = 0; offset < TOTAL_DAYS; offset += 1) {
    const start = starts[offset]
    const future = start > today
    days.push({
      dateKey: dateKeyOf(start),
      start,
      offset,
      weekday: offset % DAYS_PER_WEEK,
      week: Math.floor(offset / DAYS_PER_WEEK),
      created: 0,
      merged: 0,
      updated: 0,
      total: 0,
      intensity: 0,
      future,
    })
  }

  const bucketOf = (value: number): ActivityDay | null => {
    for (let i = 0; i < TOTAL_DAYS; i += 1) {
      if (value >= starts[i] && value < starts[i + 1]) return days[i]
    }
    return null
  }

  const add = (value: any, field: 'created' | 'merged' | 'updated') => {
    const time = stamp(value)
    if (time == null || time > at) return
    const day = bucketOf(time)
    if (!day || day.future) return
    day[field] += 1
    day.total += 1
  }

  let total = 0
  let max = 0

  for (const view of list) {
    const task = (view && view.task) || ({} as any)
    add(task.createdAt, 'created')
    add(task.mergedAt, 'merged')
    add(task.updatedAt, 'updated')
  }

  for (const day of days) {
    total += day.total
    if (day.total > max) max = day.total
  }
  for (const day of days) day.intensity = intensityOf(day.total, max)

  return {
    days,
    weeks: ACTIVITY_WEEKS,
    total,
    max,
    start: starts[0],
    end: starts[TOTAL_DAYS - 1],
  }
}
