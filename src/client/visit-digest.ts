/**
 * "Since your last visit" digest.
 *
 * Pure derivation over the task views plus one stored timestamp: nothing here
 * reads the clock, storage or the network. The board passes a fixed `now` (and
 * the timestamp it read from `visit-storage`), so the same input always yields
 * the same digest and the tests never depend on the real time.
 *
 * The digest is intentionally window-based for events (`since < at <= now`) but
 * current-state for review/overdue/stalled: those read "what needs attention
 * now", not "what became overdue while I was away".
 */

import type { TaskSnapshot, TaskStatus, TaskView, WorktreeTask } from '../models'
import { dueStateOf } from '../task-meta'
import { elapsedWorkMs } from '../task-timer'
import { stalledDays } from './staleness'

/** Recent events kept for the digest; the rest only survive in the counts. */
export const VISIT_EVENT_LIMIT = 8

export type VisitEventKind = 'created' | 'merged' | 'cleaned' | 'archived'

export interface VisitEvent {
  taskId: string
  title: string
  kind: VisitEventKind
  at: number
}

export interface VisitDigest {
  /** Previous visit timestamp used for the diff. */
  since: number
  now: number
  created: number
  merged: number
  cleaned: number
  archived: number
  /** Current tasks waiting for acceptance (status review / reviewing). */
  review: number
  /** Current open tasks past their due date. */
  overdue: number
  /** Current open tasks considered stalled by the shared threshold. */
  stalled: number
  /** Work accumulated between `since` and `now` across all tasks (ms). */
  workMs: number
  /** Distinct tasks with at least one event since `since`. */
  changed: number
  events: VisitEvent[]
  truncated: boolean
}

/** Open statuses; merged/cleaned/broken rows never count as needing attention. */
const OPEN_STATUSES = ['ready', 'developing', 'review', 'reviewing'] as const

/** Fixed tie-breaker order, so equal timestamps sort deterministically. */
const KIND_ORDER: Record<VisitEventKind, number> = {
  created: 0,
  merged: 1,
  cleaned: 2,
  archived: 3,
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** Finite positive timestamps only; `0`, negative, NaN and strings are invalid. */
function isTimestamp(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0
}

function eventAt(value: unknown): number | null {
  const at = Number(value)
  return isFiniteNumber(at) && at > 0 ? at : null
}

function isOpen(task: WorktreeTask, snapshot: TaskSnapshot): boolean {
  if (!task || task.archivedAt || task.cleanedAt) return false
  const status = snapshot && snapshot.status
  return (OPEN_STATUSES as readonly string[]).indexOf(String(status)) >= 0
}

function taskTitle(task: WorktreeTask): string {
  return String(task.title || task.id || '')
}

function collectEvents(
  views: TaskView[],
  since: number,
  now: number,
): { events: VisitEvent[]; counts: Record<VisitEventKind, number>; changed: number } {
  const events: VisitEvent[] = []
  const counts: Record<VisitEventKind, number> = { created: 0, merged: 0, cleaned: 0, archived: 0 }
  const seen = new Set<string>()
  for (const tv of views) {
    const task = tv && tv.task
    if (!task) continue
    const sources: Array<[VisitEventKind, unknown]> = [
      ['created', task.createdAt],
      ['merged', task.mergedAt],
      ['cleaned', task.cleanedAt],
      ['archived', task.archivedAt],
    ]
    for (const [kind, raw] of sources) {
      const at = eventAt(raw)
      // `since` itself is already seen; `now` is still "just happened".
      if (at == null || at <= since || at > now) continue
      counts[kind] += 1
      seen.add(String(task.id))
      events.push({ taskId: String(task.id), title: taskTitle(task), kind, at })
    }
  }
  return { events, counts, changed: seen.size }
}

/**
 * Diff the board against the previous visit.
 *
 * Returns `null` when there is no usable baseline (missing/illegal `since`, or
 * a timestamp at/after `now`). Callers then show no digest at all; an object
 * with all-zero counters is still returned for an empty project, and the caller
 * decides whether that is worth a row.
 */
export function buildVisitDigest(
  views: TaskView[],
  since: unknown,
  now?: number,
): VisitDigest | null {
  const current = typeof now === 'number' && Number.isFinite(now) ? now : Date.now()
  if (!isTimestamp(since)) return null
  if (since >= current) return null

  const list = Array.isArray(views) ? views : []
  const { events, counts, changed } = collectEvents(list, since, current)

  let review = 0
  let overdue = 0
  let stalled = 0
  let workMs = 0
  for (const tv of list) {
    const task = tv && tv.task
    const snapshot = tv && tv.snapshot
    if (!task || !snapshot) continue
    const status = snapshot.status as TaskStatus
    if (!task.archivedAt && (status === 'review' || status === 'reviewing')) review += 1
    if (isOpen(task, snapshot)) {
      const due = dueStateOf(task.dueAt, current)
      if (due && due.kind === 'overdue') overdue += 1
      if (stalledDays(task, snapshot, current) != null) stalled += 1
    }
    // Elapsed work is cumulative: the difference counts exactly the part of a
    // running interval that falls inside the window, and never goes negative
    // when the clock is adjusted backwards.
    const delta = elapsedWorkMs(task, current) - elapsedWorkMs(task, since)
    if (delta > 0) workMs += delta
  }

  events.sort((a, b) => {
    if (b.at !== a.at) return b.at - a.at
    const byTitle = a.title.localeCompare(b.title)
    if (byTitle) return byTitle
    if (a.taskId !== b.taskId) return a.taskId < b.taskId ? -1 : 1
    return KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
  })

  return {
    since,
    now: current,
    created: counts.created,
    merged: counts.merged,
    cleaned: counts.cleaned,
    archived: counts.archived,
    review,
    overdue,
    stalled,
    workMs,
    changed,
    events: events.slice(0, VISIT_EVENT_LIMIT),
    truncated: events.length > VISIT_EVENT_LIMIT,
  }
}
