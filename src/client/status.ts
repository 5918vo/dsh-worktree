export const STATUS_TONE: Record<string, string> = {
  ready: 'neutral',
  cleaned: 'neutral',
  developing: 'brand',
  reviewing: 'brand',
  review: 'warn',
  merged: 'success',
  broken: 'error',
}

/**
 * Blend the host's Git-derived status with the live session state.
 *
 * The host derives `review` ("waiting for acceptance") purely from Git: a
 * worktree with commits ahead of base or uncommitted changes. That flips the
 * moment a developing agent makes its first commit or writes a file, even while
 * its session is still running — so the board showed "待验收" for a task that is
 * very much still in progress. Session activity is only visible on the client,
 * so resolve it here: a Git-derived `review` means `developing` while the bound
 * session is actively running. Every other state (including terminal states and
 * `reviewing`, which the user starts by checking the branch out) is untouched.
 */
export function resolveStatus(status: string, running?: boolean | null): string {
  if (running === true && status === 'review') return 'developing'
  return status
}

export function pendingLabel(t: any, kind: string | null | undefined): string {
  if (!kind) return ''
  if (kind === 'approval') return t.pendingApproval
  if (kind === 'plan-review') return t.pendingPlanReview
  if (kind === 'question') return t.pendingQuestion
  return t.pendingApproval
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
