/**
 * Work budget for a task: an optional cap on hand-timed hours.
 *
 * The budget is a planning hint on top of the existing manual timer, never a
 * second source of truth: the spent side is always `elapsedWorkMs` from
 * `task-timer.ts`, so the stage, the rail, the risk radar and both reports all
 * compare the same two numbers. Legacy records simply have no
 * `workBudgetHours` field, which reads as "no budget" — nothing to migrate.
 *
 * Pure functions only, with an injectable clock, so no test depends on the real
 * time and the server can validate the same input the board validates.
 */

import { elapsedWorkMs } from './task-timer.js'

/** Smallest accepted budget: a quarter hour is still a meaningful cap. */
export const BUDGET_MIN_HOURS = 0.25

/** Largest accepted budget: a thousand hours is a guard against typos. */
export const BUDGET_MAX_HOURS = 1000

const HOUR_MS = 60 * 60 * 1000

export type BudgetParse = { ok: true; value: number | null } | { ok: false }

/**
 * Parse a budget in hours.
 *
 * `null`/`undefined`/`''` clear the field; a finite number or numeric string is
 * accepted when it lies in `0.25..1000` hours and is then rounded to two
 * decimals. Booleans, objects, arrays, `NaN`, `Infinity`, zero and negative
 * values are rejected instead of being coerced, so a typo can never silently
 * become a budget.
 */
export function parseWorkBudgetHours(value: unknown): BudgetParse {
  if (value === null || value === undefined || value === '') return { ok: true, value: null }
  if (typeof value === 'boolean' || typeof value === 'object') return { ok: false }
  const text = typeof value === 'string' ? value.trim() : value
  if (text === '') return { ok: true, value: null }
  const number = Number(text)
  if (!Number.isFinite(number)) return { ok: false }
  // Range check on the raw value: 0.249 must not round its way into the range.
  if (number < BUDGET_MIN_HOURS || number > BUDGET_MAX_HOURS) return { ok: false }
  return { ok: true, value: Math.round(number * 100) / 100 }
}

/** Budget in milliseconds, or null when the task has no valid budget. */
export function workBudgetMsOf(task: { workBudgetHours?: unknown } | null | undefined): number | null {
  const hours = parseWorkBudgetHours(task && task.workBudgetHours)
  if (!hours.ok || hours.value === null) return null
  const ms = hours.value * HOUR_MS
  return Number.isFinite(ms) && ms > 0 ? ms : null
}

export interface WorkBudgetProgress {
  budgetMs: number
  spentMs: number
  /** Rounded; may exceed 100. */
  percent: number
  state: 'under' | 'near' | 'over'
  remainingMs: number
  overMs: number
}

/**
 * Compare the timed work against the budget.
 *
 * `null` means the task has no budget at all; every other field is then derived
 * from `elapsedWorkMs`, so a running timer counts and a future start stamp
 * (clock skew) simply adds nothing instead of going negative.
 */
export function workBudgetProgress(
  task: { workBudgetHours?: unknown; workMs?: unknown; workStartedAt?: unknown } | null | undefined,
  now?: number,
): WorkBudgetProgress | null {
  const budgetMs = workBudgetMsOf(task)
  if (budgetMs === null) return null
  const spentMs = elapsedWorkMs(task || {}, now)
  const percent = Math.round((spentMs / budgetMs) * 100)
  const state: WorkBudgetProgress['state'] = percent >= 101 || spentMs > budgetMs
    ? 'over'
    : percent >= 80 ? 'near' : 'under'
  return {
    budgetMs,
    spentMs,
    percent,
    state,
    remainingMs: Math.max(0, budgetMs - spentMs),
    overMs: Math.max(0, spentMs - budgetMs),
  }
}

/**
 * Hours without trailing zeros: `4`, `4.5`, `0.25`. Invalid input reads as ''.
 */
export function budgetHoursText(hours: number): string {
  const number = Number(hours)
  if (!Number.isFinite(number) || number <= 0) return ''
  const fixed = number.toFixed(2)
  if (fixed.indexOf('.') < 0) return fixed
  return fixed.replace(/0+$/, '').replace(/\.$/, '')
}
