/**
 * Focus queue: the cross-project "what to do next" list.
 *
 * The queue is an action queue, not a risk list. It reuses the risk radar's
 * per-task score as its base (never a second scoring model), adds weights for
 * things that make a task actionable (waiting on an answer, waiting for
 * acceptance, high priority, pinned, unblocks other tasks) and drops every
 * task that still waits on an unfinished or missing prerequisite. Blocked
 * tasks are counted as `waiting` instead of being ranked, so the first row is
 * always something the user can start now.
 *
 * Pure: no DOM, no network, no writes. Invalid, missing, negative or future
 * activity timestamps read as "absent" so the queue never produces NaN and
 * never invents an age. `now` is injectable for tests.
 */

import type { ProjectView, TaskStatus, TaskView } from '../models'
import { buildProjectRisk } from './project-risk'
import { dependencyStatus } from '../task-deps'
import { dueStateOf } from '../task-meta'
import { stalledDays } from './staleness'

export type FocusReasonCode =
  | 'pending'
  | 'overdue'
  | 'due-today'
  | 'due-soon'
  | 'review'
  | 'high-priority'
  | 'stalled'
  | 'unblocks'
  | 'risk'

export interface FocusReason {
  code: FocusReasonCode
  /** Overdue / stalled days, unlocked task count or risk score; omitted when there is no number. */
  n?: number
}

export interface FocusItem {
  taskId: string
  projectId: string
  projectName: string
  title: string
  score: number
  reasons: FocusReason[]
}

export interface FocusQueue {
  /** Ready tasks, sorted and truncated to FOCUS_LIMIT. */
  items: FocusItem[]
  /** Open tasks without unfinished / missing prerequisites. */
  ready: number
  /** Open tasks with unfinished / missing prerequisites (never in `items`). */
  waiting: number
  /** Every open task. */
  total: number
}

export interface FocusInput {
  views: ProjectView[]
  /** Live board attention; used for the "waiting on an answer" weight. Omitted means no pending weight. */
  attentionOf?: (view: TaskView) => { categories: Set<string> } | null
  now?: number
}

export const FOCUS_LIMIT = 10
export const FOCUS_SCORE_MAX = 12

/** Action weights; documented here and asserted by the tests. */
export const FOCUS_WEIGHTS = {
  pending: 3,
  review: 2,
  highPriority: 2,
  pinned: 1,
  unblocksMax: 2,
} as const

/** Finite, positive timestamps only; everything else reads as absent (0). */
function stamp(value: any): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Open = not archived, not merged and not cleaned up. */
function isOpen(task: any, status: string): boolean {
  if (!task) return false
  if (stamp(task.archivedAt) || stamp(task.mergedAt) || stamp(task.cleanedAt)) return false
  return status !== 'merged' && status !== 'cleaned'
}

/** high > normal > low; anything unknown reads as normal. */
function priorityRank(task: any): number {
  const priority = task && task.priority
  if (priority === 'high') return 2
  if (priority === 'low') return 0
  return 1
}

interface Scored {
  item: FocusItem
  dueAt: number
  createdAt: number
  priority: number
}

/**
 * Score descending, then due date (none last), then priority, then creation
 * (earlier first), then task id — every tie is broken, so the list is stable.
 */
function compareScored(a: Scored, b: Scored): number {
  if (a.item.score !== b.item.score) return b.item.score - a.item.score
  const aDue = a.dueAt > 0 ? a.dueAt : Infinity
  const bDue = b.dueAt > 0 ? b.dueAt : Infinity
  if (aDue !== bDue) return aDue < bDue ? -1 : 1
  if (a.priority !== b.priority) return b.priority - a.priority
  if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt
  return a.item.taskId < b.item.taskId ? -1 : a.item.taskId > b.item.taskId ? 1 : 0
}

/** True when the live attention map puts this task in the `pending` category. */
function isPending(attention: any): boolean {
  const categories = attention && attention.categories
  if (!categories) return false
  return typeof categories.has === 'function' ? !!categories.has('pending') : false
}

/**
 * Build the focus queue from the complete, unfiltered project views.
 * A missing / malformed list behaves as empty instead of throwing.
 */
export function buildFocusQueue(input: FocusInput): FocusQueue {
  const source = input && Array.isArray(input.views) ? input.views : []
  const at = input && Number.isFinite(input.now) ? (input.now as number) : Date.now()
  const attentionOf = input && typeof input.attentionOf === 'function' ? input.attentionOf : null

  // Dependencies resolve against every task (archived included) so a finished
  // prerequisite is recognised as done instead of as a missing row.
  const lookup = new Map<string, any>()
  const openRows: Array<{ view: TaskView; project: any }> = []
  const statusOf = new Map<string, string>()
  for (const view of source) {
    if (!view) continue
    const tasks = Array.isArray(view.tasks) ? view.tasks : []
    for (const tv of tasks) {
      const task = tv && tv.task
      if (!task || typeof task.id !== 'string' || !task.id) continue
      lookup.set(task.id, task)
      const status = String((tv.snapshot && tv.snapshot.status) || '')
      statusOf.set(task.id, status)
      if (isOpen(task, status)) openRows.push({ view: tv, project: (view as any).project })
    }
  }

  // How many open tasks would become startable once a given task is done:
  // count only dependents whose every other prerequisite is already finished.
  const unblocks = new Map<string, number>()
  for (const row of openRows) {
    const tv = row.view
    const deps = dependencyStatus(tv.task, lookup)
    if (deps.missing.length > 0) continue
    if (deps.open.length !== 1) continue
    const id = deps.open[0].id
    unblocks.set(id, (unblocks.get(id) || 0) + 1)
  }

  // Base score reuses the risk radar, one call per project.
  const baseScore = new Map<string, number>()
  for (const view of source) {
    if (!view) continue
    const risk = buildProjectRisk(Array.isArray(view.tasks) ? view.tasks : [], at)
    for (const item of risk.items) baseScore.set(item.taskId, item.score)
  }

  const scored: Scored[] = []
  let total = 0
  let waiting = 0

  for (const row of openRows) {
    const view = row.view
    const project = row.project || {}
    const task = view.task || ({} as any)
    const snapshot = view.snapshot || ({} as any)
    const status = String(statusOf.get(task.id) || '')
    total += 1

    const deps = dependencyStatus(task, lookup)
    if (deps.open.length + deps.missing.length > 0) {
      waiting += 1
      continue
    }

    const base = baseScore.get(task.id) || 0
    const pending = attentionOf ? isPending(attentionOf(view)) : false
    const review = status === 'review' || status === 'reviewing'
    const high = task.priority === 'high'
    const pinned = stamp(task.pinnedAt) > 0
    const unlocks = unblocks.get(task.id) || 0

    let score = base
    if (pending) score += FOCUS_WEIGHTS.pending
    if (review) score += FOCUS_WEIGHTS.review
    if (high) score += FOCUS_WEIGHTS.highPriority
    if (pinned) score += FOCUS_WEIGHTS.pinned
    score += Math.min(FOCUS_WEIGHTS.unblocksMax, unlocks)
    score = Math.min(FOCUS_SCORE_MAX, score)

    const dueAt = stamp(task.dueAt)
    const due = dueStateOf(dueAt || null, at)
    // Activity stamps feed stalled detection; negative / future values are
    // absent, never a months-long stall or an age below zero.
    const created = stamp(task.createdAt)
    const safeTask = { ...task, createdAt: created, updatedAt: stamp(task.updatedAt) }
    const worktree = (snapshot && snapshot.worktree) || {}
    const safeSnapshot = {
      ...snapshot,
      worktree: { ...worktree, lastCommitAt: stamp(worktree.lastCommitAt) || null },
    }
    const stalled = stalledDays(safeTask as any, safeSnapshot as any, at)

    const reasons: FocusReason[] = []
    if (pending) reasons.push({ code: 'pending' })
    if (due && due.kind === 'overdue') reasons.push({ code: 'overdue', n: due.days })
    else if (due && due.kind === 'today') reasons.push({ code: 'due-today' })
    else if (due && due.kind === 'soon') reasons.push({ code: 'due-soon' })
    if (review) reasons.push({ code: 'review' })
    if (high) reasons.push({ code: 'high-priority' })
    if (stalled != null && stalled > 0) reasons.push({ code: 'stalled', n: stalled })
    if (unlocks > 0) reasons.push({ code: 'unblocks', n: unlocks })
    // Risk explains a ranking only when nothing more specific does.
    if (reasons.length === 0 && base > 0) reasons.push({ code: 'risk', n: base })

    scored.push({
      // A future creation time is corrupt; clamping it to `now` keeps it from
      // jumping ahead of genuinely older tasks without inventing a negative age.
      createdAt: created && created > at ? at : created,
      dueAt,
      priority: priorityRank(task),
      item: {
        taskId: String(task.id),
        projectId: String((project && project.id) || task.projectId || ''),
        projectName: String((project && project.name) || (project && project.id) || ''),
        title: String(task.title == null ? '' : task.title),
        score,
        reasons: reasons.slice(0, 3),
      },
    })
  }

  scored.sort(compareScored)
  return {
    items: scored.slice(0, FOCUS_LIMIT).map((row) => row.item),
    ready: total - waiting,
    waiting,
    total,
  }
}
