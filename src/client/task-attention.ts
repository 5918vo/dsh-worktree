/**
 * Unified "what needs attention" derivation for the worktree board.
 *
 * Pure module (no React / DOM / network). The same output powers the filter
 * counts, the top summary bar and each task row, so the three can never drift.
 * Every input comes from the existing task snapshot plus the board's live
 * session state — no new Git commands or polling.
 */

export type AttentionCategory = 'pending' | 'review' | 'recovery' | 'broken'
export type AlertKind = 'recovery' | 'pending' | 'broken' | 'post-merge' | 'session'
export type QuickAction = 'recover' | 'handle' | 'review' | 'open-session'

export interface TaskAttention {
  /** A task may belong to several categories. */
  categories: Set<AttentionCategory>
  /** The single highlighted alert shown in the row. */
  primaryAlert: AlertKind | null
  /** Remaining alerts, shown in the "more states" popover. */
  extraAlerts: AlertKind[]
  /** The one quick action allowed at the row tail (navigation only). */
  quickAction: QuickAction | null
  /** Snapshot is stale (offline / refresh failed) — not broken. */
  stale: boolean
}

export interface AttentionInput {
  task: any
  snapshot: any
  pendingKind?: string | null
  running?: boolean | null
  health?: { kind: string } | null
  repoLockLabel?: string
  stale?: boolean
}

/**
 * Recovery is backed by the durable merge journal (`task.pendingOp`) and the
 * pending-stash list, both populated by the runtime and exposed on the task, so
 * the recovery surfaces are enabled. Ordinary saved stashes are reminders only.
 */
export const RECOVERY_UI_READY = true

const ALERT_PRIORITY: AlertKind[] = ['recovery', 'pending', 'broken', 'post-merge', 'session']

function isRecovery(task: any, repoLockLabel?: string): boolean {
  // While a Git action holds the repo the journal is "in flight", not stuck.
  if (repoLockLabel) return false
  const op = task && task.pendingOp
  if (!op) return false
  if (op.recoveryStatus === 'recovered') return false
  return true
}

export function deriveTaskAttention(input: AttentionInput): TaskAttention {
  const { task, snapshot, pendingKind, running, health } = input
  const categories = new Set<AttentionCategory>()
  const alerts: AlertKind[] = []
  const status = snapshot && snapshot.status

  // pending: any approval / plan-review / question, counted once.
  if (pendingKind) {
    categories.add('pending')
    alerts.push('pending')
  }

  // review: commits ahead of base (or post-merge patches) and not under review.
  const ahead = Number((snapshot && snapshot.worktree && snapshot.worktree.ahead) || 0)
  const postMerge = Number((snapshot && snapshot.postMergeAhead) || 0)
  if ((ahead > 0 || postMerge > 0) && status !== 'reviewing') {
    categories.add('review')
    if (postMerge > 0) alerts.push('post-merge')
  }

  // recovery: a stuck/incomplete merge journal (stashes alone are reminders).
  if (RECOVERY_UI_READY && isRecovery(task, input.repoLockLabel)) {
    categories.add('recovery')
    alerts.push('recovery')
  }

  // broken: explicit read failure / worktree branch missing. Stale is NOT broken.
  const branchMissing =
    snapshot && snapshot.branchExists === false && status !== 'cleaned' && status !== 'merged'
  if (status === 'broken' || (snapshot && snapshot.error) || branchMissing) {
    categories.add('broken')
    alerts.push('broken')
  }

  // session interrupted/error is an extra row alert, not a filter category.
  const healthActive = !!health && !running
  if (healthActive) alerts.push('session')

  // Deduplicate while preserving priority order.
  const uniq: AlertKind[] = []
  for (const kind of ALERT_PRIORITY) if (alerts.includes(kind)) uniq.push(kind)

  const primaryAlert = uniq[0] || null
  const extraAlerts = uniq.slice(1)

  return {
    categories,
    primaryAlert,
    extraAlerts,
    quickAction: quickActionFor(categories, !!(task && task.sessionId)),
    stale: !!input.stale,
  }
}

function quickActionFor(categories: Set<AttentionCategory>, hasSession: boolean): QuickAction | null {
  if (RECOVERY_UI_READY && categories.has('recovery')) return 'recover'
  if (categories.has('pending') && hasSession) return 'handle'
  if (categories.has('review')) return 'review'
  if (hasSession) return 'open-session'
  return null
}

/** locale key for each quick action label. */
export function quickActionKey(action: QuickAction): string {
  switch (action) {
    case 'recover': return 'quickRecover'
    case 'handle': return 'quickHandle'
    case 'review': return 'quickReview'
    case 'open-session': return 'openSessionBtn'
  }
}

/** locale key for each filter/category label. */
export function categoryKey(category: AttentionCategory | 'all'): string {
  switch (category) {
    case 'all': return 'attentionAll'
    case 'pending': return 'attentionPending'
    case 'review': return 'attentionReview'
    case 'recovery': return 'attentionRecovery'
    case 'broken': return 'attentionBroken'
  }
}

const SEVERITY: Record<AttentionCategory, number> = { recovery: 4, broken: 3, pending: 2, review: 1 }

export interface AttentionSummary {
  counts: Record<AttentionCategory, number>
  /** Tasks with at least one category, de-duplicated across categories. */
  total: number
  /** Highest severity present (0 = none). */
  maxSeverity: number
}

export function summarizeAttention(views: any[], get: (v: any) => TaskAttention): AttentionSummary {
  const counts: Record<AttentionCategory, number> = { pending: 0, review: 0, recovery: 0, broken: 0 }
  const hurting = new Set<string>()
  let maxSeverity = 0
  for (const view of views || []) {
    const attention = get(view)
    const id = view && view.task && view.task.id
    if (!attention || !attention.categories || attention.categories.size === 0) continue
    if (id) hurting.add(String(id))
    for (const category of attention.categories) {
      counts[category] += 1
      if (SEVERITY[category] > maxSeverity) maxSeverity = SEVERITY[category]
    }
  }
  return { counts, total: hurting.size, maxSeverity }
}

/** Tasks matching a filter category; `all` returns everything unchanged. */
export function filterViewsByAttention(views: any[], get: (v: any) => TaskAttention, category: AttentionCategory | 'all'): any[] {
  if (category === 'all') return views
  return (views || []).filter((view) => {
    const attention = get(view)
    return !!attention && attention.categories.has(category)
  })
}

/**
 * Counts for the filter panel + the filter-button badge. `visibleViews` drive
 * every ordinary list; `allViews` additionally feed the recovery count so
 * archived affected tasks are still counted there when the backend is ready.
 */
export function computeFilterCounts(
  visibleViews: any[],
  allViews: any[],
  get: (v: any) => TaskAttention,
  recoveryReady: boolean = RECOVERY_UI_READY,
): Record<string, number> {
  const visible = summarizeAttention(visibleViews, get)
  const all = summarizeAttention(allViews, get)
  const counts: Record<string, number> = {
    all: (visibleViews || []).length,
    pending: visible.counts.pending,
    review: visible.counts.review,
    broken: visible.counts.broken,
    recovery: recoveryReady ? all.counts.recovery : 0,
    total: 0,
  }
  const ids = new Set<string>()
  for (const view of visibleViews || []) {
    const attention = get(view)
    if (attention && (attention.categories.has('pending') || attention.categories.has('review') || attention.categories.has('broken'))) {
      if (view && view.task && view.task.id) ids.add(String(view.task.id))
    }
  }
  if (recoveryReady) {
    for (const view of allViews || []) {
      const attention = get(view)
      if (attention && attention.categories.has('recovery') && view && view.task && view.task.id) ids.add(String(view.task.id))
    }
  }
  counts.total = ids.size
  return counts
}

