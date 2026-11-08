export const STATUS_TONE: Record<string, string> = {
  ready: 'neutral',
  cleaned: 'neutral',
  developing: 'brand',
  reviewing: 'brand',
  review: 'warn',
  merged: 'success',
  broken: 'error',
}

export function pendingLabel(t: any, kind: string | null | undefined): string {
  if (!kind) return ''
  if (kind === 'approval') return t.pendingApproval
  if (kind === 'plan-review') return t.pendingPlanReview
  if (kind === 'question') return t.pendingQuestion
  return t.pendingApproval
}

/**
 * Whether the task has work ready to be inspected/accepted.
 * Acceptance actions (switching the main repo to the task branch) only make
 * sense once the worktree holds commits or changes to review — i.e. `review`
 * and the already-checked-out `reviewing` state. `ready`/`developing` still
 * mean the work is not done, so acceptance must stay disabled.
 */
export function isReviewable(status: string): boolean {
  return status === 'review' || status === 'reviewing'
}

export function statusMeta(t: any, status: string, pendingKind?: string | null) {
  const terminal = status === 'merged' || status === 'cleaned'
  if (pendingKind && !terminal) return { label: pendingLabel(t, pendingKind), tone: 'warn', pending: true }
  return {
    label: (t as any)[status] || status,
    tone: STATUS_TONE[status] || 'neutral',
    // Terminal states keep their lifecycle label; pending is shown as a second chip.
    pending: !!pendingKind,
    note: pendingKind ? pendingLabel(t, pendingKind) : '',
  }
}
