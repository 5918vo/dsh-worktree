/**
 * Project risk radar: one sortable score per open task, with the reasons that
 * produced it.
 *
 * The score is a heuristic ordering hint, not an SLA: it never changes a task
 * status, priority or order on the board, and it is derived only from fields
 * already on screen (no Git calls, no writes, no network).
 *
 * Every factor reuses the shared helper that other surfaces already trust:
 * `dueStateOf` (task-meta), `stalledDays` (staleness), `dependencyStatus`
 * (task-deps) and `criteria` / `criteriaProgress` (model). Invalid, missing or
 * future timestamps degrade to "absent" so the card never shows NaN or a
 * negative score.
 */

import type { TaskStatus, TaskView } from '../models'
import { criteria, criteriaProgress } from './model'
import { dueStateOf } from '../task-meta'
import { stalledDays } from './staleness'
import { dependencyStatus } from '../task-deps'

export type RiskLevel = 'high' | 'medium' | 'low' | 'none'

export type RiskReasonCode =
  | 'broken'
  | 'overdue'
  | 'due-soon'
  | 'stalled'
  | 'blocked'
  | 'criteria'

export interface RiskReason {
  code: RiskReasonCode
  /** Overdue days / stalled days / blocked count / unchecked criteria; omitted when there is no number. */
  n?: number
}

export interface RiskItem {
  taskId: string
  title: string
  score: number
  level: RiskLevel
  reasons: RiskReason[]
}

export interface ProjectRisk {
  items: RiskItem[]
  high: number
  medium: number
  low: number
  /** Open tasks (the number of rows that took part in scoring). */
  open: number
  /** Highest-scoring five, in display order. */
  top: RiskItem[]
}

/** Score weights; documented here and asserted by the tests. */
export const RISK_WEIGHTS = {
  broken: 4,
  overdue: 3,
  overdueWeek: 1,
  overdueWeekMax: 2,
  dueSoon: 1,
  stalled: 2,
  blocked: 2,
  criteria: 1,
} as const

export const RISK_SCORE_MAX = 10
export const RISK_TOP_LIMIT = 5

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

/** Bucket one final score; the cut-offs are the card's high / medium / low rows. */
export function riskLevelOf(score: number): RiskLevel {
  const value = Number.isFinite(score) ? score : 0
  if (value >= 5) return 'high'
  if (value >= 3) return 'medium'
  if (value >= 1) return 'low'
  return 'none'
}

interface Scored {
  item: RiskItem
  dueAt: number
  createdAt: number
}

/** Score descending, then due date (none last), then creation, then id. */
function compareScored(a: Scored, b: Scored): number {
  if (a.item.score !== b.item.score) return b.item.score - a.item.score
  const aDue = a.dueAt > 0 ? a.dueAt : Infinity
  const bDue = b.dueAt > 0 ? b.dueAt : Infinity
  if (aDue !== bDue) return aDue < bDue ? -1 : 1
  if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt
  return a.item.taskId < b.item.taskId ? -1 : a.item.taskId > b.item.taskId ? 1 : 0
}

/**
 * Build the risk radar for one project. `now` is injectable so tests do not
 * read the wall clock; an invalid value falls back to the real clock.
 */
export function buildProjectRisk(views: TaskView[], now: number = Date.now()): ProjectRisk {
  const list = Array.isArray(views) ? views : []
  const at = Number.isFinite(now) ? now : Date.now()

  // Dependencies may point at closed tasks (done) or at rows that no longer
  // exist (missing); the lookup covers every row so the helper sees the truth.
  const lookup = new Map<string, any>()
  for (const view of list) {
    const task = view && view.task
    if (task && typeof task.id === 'string' && task.id) lookup.set(task.id, task)
  }

  const scored: Scored[] = []
  let open = 0

  for (const view of list) {
    const task = (view && view.task) || ({} as any)
    const snapshot = (view && view.snapshot) || ({} as any)
    const status = String(snapshot.status || '')
    if (!isOpen(task, status)) continue
    open += 1

    const reasons: RiskReason[] = []
    let score = 0

    // Negative / non-finite stamps must not leak into the shared helpers: a
    // negative due date would otherwise read as "overdue since 1969" and a
    // negative activity stamp as a months-long stall.
    const created = stamp(task.createdAt)
    const dueAt = stamp(task.dueAt)
    const safeTask = { ...task, createdAt: created, updatedAt: stamp(task.updatedAt) }
    const worktree = (snapshot && snapshot.worktree) || {}
    const safeSnapshot = {
      ...snapshot,
      worktree: { ...worktree, lastCommitAt: stamp(worktree.lastCommitAt) || null },
    }

    if (status === 'broken') {
      score += RISK_WEIGHTS.broken
      reasons.push({ code: 'broken' })
    }

    const due = dueStateOf(dueAt || null, at)
    if (due && due.kind === 'overdue') {
      score += RISK_WEIGHTS.overdue
      score += Math.min(RISK_WEIGHTS.overdueWeekMax, Math.floor(due.days / 7) * RISK_WEIGHTS.overdueWeek)
      reasons.push({ code: 'overdue', n: due.days })
    } else if (due && (due.kind === 'today' || due.kind === 'soon')) {
      score += RISK_WEIGHTS.dueSoon
      reasons.push({ code: 'due-soon' })
    }

    const stalled = stalledDays(safeTask, safeSnapshot, at)
    if (stalled != null && stalled > 0) {
      score += RISK_WEIGHTS.stalled
      reasons.push({ code: 'stalled', n: stalled })
    }

    // Unfinished and missing prerequisites both block the task, but several
    // prerequisites still add the weight once.
    const deps = dependencyStatus(task, lookup)
    const blockedCount = deps.open.length + deps.missing.length
    if (blockedCount > 0) {
      score += RISK_WEIGHTS.blocked
      reasons.push({ code: 'blocked', n: blockedCount })
    }

    if (status === 'review' || status === 'reviewing') {
      const progress = criteriaProgress(criteria(task, status as TaskStatus))
      if (progress.missing > 0) {
        score += RISK_WEIGHTS.criteria
        reasons.push({ code: 'criteria', n: progress.missing })
      }
    }

    score = Math.min(RISK_SCORE_MAX, score)
    if (score <= 0) continue

    scored.push({
      // A future creation time is corrupt; clamping it to `now` keeps it from
      // jumping ahead of genuinely older tasks without inventing a negative age.
      createdAt: created && created > at ? at : created,
      dueAt,
      item: {
        taskId: String(task.id == null ? '' : task.id),
        title: String(task.title == null ? '' : task.title),
        score,
        level: riskLevelOf(score),
        reasons,
      },
    })
  }

  scored.sort(compareScored)
  const items = scored.map((row) => row.item)
  const high = items.filter((item) => item.level === 'high').length
  const medium = items.filter((item) => item.level === 'medium').length
  const low = items.filter((item) => item.level === 'low').length

  return { items, high, medium, low, open, top: items.slice(0, RISK_TOP_LIMIT) }
}
