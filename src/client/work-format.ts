/**
 * Localized work-time text shared by the board, the stage and both reports.
 *
 * `task-timer.ts` owns the arithmetic and the duration templates; this module
 * only maps the active dictionary onto those templates, so every surface shows
 * the same number in the same language.
 */

import {
  elapsedWorkMs,
  formatWorkDuration,
  hasWorkRecord,
  isWorkTiming,
  type TimerSnapshot,
  type WorkDurationUnits,
} from '../task-timer'

/** Duration templates for one locale dictionary; missing keys read as the key. */
export function workDurationUnits(t: Record<string, any>): WorkDurationUnits {
  return {
    underMinute: String(t.taskWorkUnderMinute),
    minutes: String(t.taskWorkMinutes),
    hours: String(t.taskWorkHours),
    hoursMinutes: String(t.taskWorkHoursMinutes),
    days: String(t.taskWorkDays),
    daysHours: String(t.taskWorkDaysHours),
  }
}

/** Accumulated duration, or the dictionary's word for "never timed". */
export function workTotalText(t: Record<string, any>, task: TimerSnapshot, now?: number): string {
  return hasWorkRecord(task)
    ? formatWorkDuration(elapsedWorkMs(task, now), workDurationUnits(t))
    : String(t.taskWorkEmpty)
}

/** The total plus a localized "(timing)" marker while the clock still runs. */
export function workTimingText(t: Record<string, any>, task: TimerSnapshot, now?: number): string {
  const total = workTotalText(t, task, now)
  return isWorkTiming(task) ? total + String(t.taskWorkTimingSuffix) : total
}
