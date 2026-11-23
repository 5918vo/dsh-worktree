/**
 * Stalled-task detection: a task with no activity for its status threshold is
 * "stalled". Pure functions only — the rail, the attention summaries and the
 * tests all derive the same number, so the chip and the filter never disagree.
 */

import type { TaskSnapshot, TaskStatus, WorktreeTask } from '../models'

export const STALLED_DAY_MS = 86_400_000

/** Days of silence allowed per open status before the task counts as stalled. */
export const STALLED_THRESHOLDS: Record<'ready' | 'developing' | 'review' | 'reviewing', number> = {
  ready: 3,
  developing: 7,
  review: 3,
  reviewing: 3,
}

/** Newest activity timestamp; missing sources count as 0. */
export function lastActivityAt(
  task: WorktreeTask | null | undefined,
  snapshot: TaskSnapshot | null | undefined,
): number {
  const row: Partial<WorktreeTask> = task || {}
  const worktree = (snapshot && snapshot.worktree) || ({} as TaskSnapshot['worktree'])
  return Math.max(
    Number(row.updatedAt) || 0,
    Number(row.createdAt) || 0,
    Number(worktree.lastCommitAt) || 0,
  )
}

/**
 * Whole days since the last activity when the task is stalled, otherwise null.
 *
 * Closed statuses (merged/cleaned/broken) and archived rows never stall: they
 * are either done or already reported by their own alert, and re-labelling them
 * would bury the tasks that actually need attention.
 */
export function stalledDays(
  task: WorktreeTask | null | undefined,
  snapshot: TaskSnapshot | null | undefined,
  now: number = Date.now(),
): number | null {
  if (!task || task.archivedAt) return null
  const status = (snapshot && snapshot.status) as TaskStatus | undefined
  const threshold = status ? STALLED_THRESHOLDS[status as keyof typeof STALLED_THRESHOLDS] : undefined
  if (!threshold) return null
  const last = lastActivityAt(task, snapshot)
  if (!last || now < last) return null
  const days = Math.floor((now - last) / STALLED_DAY_MS)
  return days >= threshold ? days : null
}
