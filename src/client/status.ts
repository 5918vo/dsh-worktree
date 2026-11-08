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
