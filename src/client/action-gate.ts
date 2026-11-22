/**
 * Acceptance action gates: why checkout / back / merge cannot run right now.
 *
 * Every acceptance action mutates the main repo, so the board decides the
 * button state from three things: the task lifecycle, whether the main repo can
 * safely switch or merge, and whether the agent is still writing. The backend
 * repeats each git-level check; these reasons only explain the state up front.
 *
 * Pure and framework-free so the copy, ordering and block rules can be tested
 * without a DOM.
 */

import type { BoardAction } from './model'

export interface ActionGateInput {
  t: any
  task: any
  snapshot: any
  /** Resolved board status key (`review` reads as `running` while the agent works). */
  status?: string
  running?: boolean
  /** The session is waiting for an approval / plan review / answer. */
  pending?: boolean
  /** `MergePreviewState` from the board data hook. */
  previewState?: any
  /** Another uncleaned task the main repo is currently accepting. */
  otherReviewing?: any
}

export interface ActionGate {
  /** Blocked action → one-line title text (reasons joined with `；`). */
  disabled: Partial<Record<BoardAction, string>>
  /** Blocked action → reasons, in a stable display order. */
  reasons: Partial<Record<BoardAction, string[]>>
}

/** Fill a single `{key}` placeholder; function replacement keeps `$` literal. */
function fill(text: any, key: string, value: string): string {
  return String(text == null ? '' : text).replace('{' + key + '}', () => value)
}

const asNumber = (value: any): number => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** The preview payload a state carries, including the last result while re-checking. */
function previewOf(previewState: any): any {
  if (!previewState) return null
  if (previewState.preview) return previewState.preview
  if (previewState.previous && previewState.previous.preview) return previewState.previous.preview
  return null
}

export function deriveActionGate(input: ActionGateInput): ActionGate {
  const { t, task, snapshot: snap, status = '', running = false, pending = false, previewState, otherReviewing } = input
  const reasons: Partial<Record<BoardAction, string[]>> = {}
  if (!snap) return { disabled: {}, reasons }

  const push = (action: BoardAction, text: any) => {
    const value = String(text == null ? '' : text)
    if (!value) return
    const list = reasons[action] || (reasons[action] = [])
    list.push(value)
  }

  const ahead = asNumber(snap.worktree && snap.worktree.ahead)
  const dirty = asNumber(snap.worktree && snap.worktree.dirtyCount)
  const repoDirty = asNumber(snap.repo && snap.repo.dirtyCount)
  const postMerge = asNumber(snap.postMergeAhead)
  const inProgress = !!(snap.repo && snap.repo.inProgress)
  const currentBranch = (snap.repo && snap.repo.currentBranch) || ''
  const baseBranch = (task && task.baseBranch) || ''
  const onBase = !!baseBranch && currentBranch === baseBranch
  const taskStatus = snap.status || ''

  // ---- checkout: switch the main repo onto the task branch ----
  if (taskStatus === 'merged') {
    push('checkout', t.acceptanceHintMerged)
  } else if (taskStatus === 'broken') {
    push('checkout', snap.error || t.acceptanceHintBroken)
  } else if (taskStatus !== 'review') {
    push('checkout', t.acceptNoCommits)
  } else if (ahead === 0) {
    push('checkout', dirty > 0 ? fill(t.acceptWorktreeDirtyCommit, 'n', String(dirty)) : t.acceptNoCommits)
  } else {
    if (dirty > 0) push('checkout', fill(t.acceptWorktreeDirtyCommit, 'n', String(dirty)))
    if (inProgress) push('checkout', t.acceptInProgress)
    if (otherReviewing) push('checkout', fill(t.acceptOtherReviewing, 'task', otherReviewing.task ? otherReviewing.task.title : ''))
    // A pending approval/question keeps the turn open even when `running` is
    // not reported yet; both states own the worktree.
    if (pending) push('checkout', t.acceptAgentPending)
    else if (running) push('checkout', t.acceptAgentRunning)
  }

  // ---- back: return the main repo to its original branch ----
  if (inProgress) push('back', t.acceptInProgress)

  // ---- merge: merge the task branch into the base branch ----
  // A merged task with post-merge commits keeps the normal overlay rules but
  // uses those commits as the "ahead" count, and is not refused for not being
  // in review any more.
  const remerge = postMerge > 0
  const mergeAhead = remerge ? postMerge : ahead
  if (taskStatus === 'broken') {
    push('merge', snap.error || t.acceptanceHintBroken)
  } else if (status === 'reviewing') {
    push('merge', t.acceptMergeReviewing)
  } else if (!remerge && (taskStatus !== 'review' || mergeAhead === 0)) {
    push('merge', t.acceptNoCommits)
  } else {
    if (dirty > 0) push('merge', fill(t.acceptWorktreeDirtyCommit, 'n', String(dirty)))
    // Being on another branch is fine: the merge switches to the base itself.
    // A detached/unknown HEAD is not, so name the branch we could not resolve.
    if (!onBase && !currentBranch) push('merge', fill(t.acceptNotOnBase, 'branch', currentBranch || '—'))
    if (repoDirty > 0) push('merge', fill(t.acceptanceHintRepoDirtyMerge, 'n', String(repoDirty)))
    if (inProgress) push('merge', t.acceptInProgress)
    if (pending) push('merge', t.acceptAgentPending)
    else if (running) push('merge', t.acceptAgentRunning)

    // Only a real, failed conflict check blocks; an unsupported/old Git does
    // not (the UI shows a risk warning instead).
    const preview = previewOf(previewState)
    const phase = (previewState && previewState.phase) || 'idle'
    if (phase === 'error') {
      push('merge', previewState.message || '')
    } else if (preview && preview.conflict) {
      push('merge', t.mergePreviewConflictHint)
    } else if (phase === 'checking' || !preview) {
      push('merge', t.mergePreviewChecking)
    } else if (preview.checked === false && preview.supported !== false) {
      push('merge', t.mergePrecheckBlocked)
    }
  }

  const disabled: Partial<Record<BoardAction, string>> = {}
  for (const action of Object.keys(reasons) as BoardAction[]) {
    const list = reasons[action]
    if (list && list.length) disabled[action] = list.join('；')
  }
  return { disabled, reasons }
}
