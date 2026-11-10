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
 * The recovery backend (pendingOp / pendingStashes) is not populated by the
 * runtime and not exposed in the snapshot yet. Until it is, every recovery-
 * related surface stays hidden so we never show a permanently-zero category.
 * Flip this once the backend writes those fields and the snapshot exposes them.
 */
export const RECOVERY_UI_READY = false

const ALERT_PRIORITY: AlertKind[] = ['recovery', 'pending', 'broken', 'post-merge', 'session']

function isRecovery(task: any): boolean {
  const op = task && task.pendingOp
  if (op && op.recoveryStatus && op.recoveryStatus !== 'recovered') return true
  const stashes: any[] = Array.isArray(task && task.pendingStashes) ? task.pendingStashes : []
  return stashes.some((s) => s && (s.conflict === true || s.state === 'conflict'))
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

  // recovery: gated behind the backend readiness switch.
  if (RECOVERY_UI_READY && isRecovery(task)) {
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
