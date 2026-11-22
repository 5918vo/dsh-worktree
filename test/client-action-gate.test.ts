import test from 'node:test'
import assert from 'node:assert/strict'
import { deriveActionGate } from '../src/client/action-gate.js'

// Only the keys the gate renders; placeholders kept so fill() is exercised.
const T: any = {
  acceptanceHintMerged: 'merged-hint',
  acceptanceHintBroken: 'broken-hint',
  acceptNoCommits: 'no-commits',
  acceptWorktreeDirtyCommit: 'worktree-dirty {n}',
  acceptInProgress: 'in-progress',
  acceptOtherReviewing: 'other-reviewing {task}',
  acceptAgentRunning: 'agent-running',
  acceptAgentPending: 'agent-pending',
  acceptMergeReviewing: 'merge-reviewing',
  acceptNotOnBase: 'not-on-base {branch}',
  acceptanceHintRepoDirtyMerge: 'repo-dirty {n}',
  mergePreviewConflictHint: 'preview-conflict',
  mergePreviewChecking: 'preview-checking',
  mergePrecheckBlocked: 'precheck-blocked',
}

const TASK: any = {
  id: 't1',
  title: 'Task one',
  branch: 'dsh-wt/t1',
  baseBranch: 'main',
  reviewSha: 'review-sha',
}

const READY = {
  phase: 'ready',
  checkedAt: 1,
  tipSha: 'review-sha',
  baseSha: 'repo-head',
  preview: { checked: true, supported: true },
}

function makeSnap(opts: any = {}) {
  const { worktree, repo, ...rest } = opts
  return {
    worktree: {
      exists: true,
      branch: 'dsh-wt/t1',
      dirtyCount: 0,
      ahead: 2,
      commits: [],
      lastCommitAt: null,
      ...(worktree || {}),
    },
    repo: {
      exists: true,
      currentBranch: 'main',
      headSha: 'repo-head',
      dirtyCount: 0,
      inProgress: null,
      ...(repo || {}),
    },
    branchExists: true,
    merged: false,
    postMergeAhead: 0,
    status: 'review',
    ...rest,
  }
}

function gate(over: any = {}) {
  return deriveActionGate({
    t: T,
    task: TASK,
    snapshot: makeSnap(),
    status: 'review',
    running: false,
    previewState: READY,
    otherReviewing: null,
    ...over,
  })
}

// ---- checkout ----

test('checkout: a merged task explains there is nothing to check out', () => {
  const g = gate({ snapshot: makeSnap({ status: 'merged' }), status: 'merged' })
  assert.deepEqual(g.reasons.checkout, ['merged-hint'])
  assert.equal(g.disabled.checkout, 'merged-hint')
})

test('checkout: a broken task shows the snapshot error, else the broken hint', () => {
  const withError = gate({ snapshot: makeSnap({ status: 'broken', error: 'boom' }), status: 'broken' })
  assert.deepEqual(withError.reasons.checkout, ['boom'])
  const withoutError = gate({ snapshot: makeSnap({ status: 'broken' }), status: 'broken' })
  assert.deepEqual(withoutError.reasons.checkout, ['broken-hint'])
})

test('checkout: a task still being developed has no commits to accept', () => {
  const g = gate({ snapshot: makeSnap({ status: 'developing' }), status: 'developing' })
  assert.deepEqual(g.reasons.checkout, ['no-commits'])
})

test('checkout: nothing ahead reports no commits, or the dirty worktree count', () => {
  const clean = gate({ snapshot: makeSnap({ worktree: { ahead: 0 } }) })
  assert.deepEqual(clean.reasons.checkout, ['no-commits'])
  const dirty = gate({ snapshot: makeSnap({ worktree: { ahead: 0, dirtyCount: 3 } }) })
  assert.deepEqual(dirty.reasons.checkout, ['worktree-dirty 3'])
})

test('checkout: an unfinished main-repo operation blocks the switch', () => {
  const g = gate({ snapshot: makeSnap({ repo: { inProgress: 'merge' } }) })
  assert.deepEqual(g.reasons.checkout, ['in-progress'])
})

test('checkout: a sibling task in acceptance blocks the switch', () => {
  const g = gate({ otherReviewing: { task: { id: 't2', title: 'Sibling' } } })
  assert.deepEqual(g.reasons.checkout, ['other-reviewing Sibling'])
})

test('checkout: a running agent blocks the switch', () => {
  const g = gate({ running: true, status: 'running' })
  assert.deepEqual(g.reasons.checkout, ['agent-running'])
})

test('checkout: a pending interaction wins over the running label', () => {
  const g = gate({ pending: true, running: true, status: 'running' })
  assert.deepEqual(g.reasons.checkout, ['agent-pending'])
})

test('checkout: stable order when several facts block at once', () => {
  const g = gate({
    running: true,
    status: 'running',
    otherReviewing: { task: { id: 't2', title: 'Sibling' } },
    snapshot: makeSnap({ worktree: { dirtyCount: 2 }, repo: { inProgress: 'rebase' } }),
  })
  assert.deepEqual(g.reasons.checkout, [
    'worktree-dirty 2',
    'in-progress',
    'other-reviewing Sibling',
    'agent-running',
  ])
  assert.equal(g.disabled.checkout, 'worktree-dirty 2；in-progress；other-reviewing Sibling；agent-running')
})

// ---- back ----

test('back: only an unfinished main-repo operation blocks returning', () => {
  const g = gate({ snapshot: makeSnap({ repo: { inProgress: 'merge' } }) })
  assert.deepEqual(g.reasons.back, ['in-progress'])
  assert.equal(g.disabled.back, 'in-progress')
  const clean = gate()
  assert.equal(clean.reasons.back, undefined)
})

// ---- merge ----

test('merge: a task under review in the main repo cannot be merged again', () => {
  const g = gate({ status: 'reviewing' })
  assert.deepEqual(g.reasons.merge, ['merge-reviewing'])
  assert.equal(g.disabled.merge, 'merge-reviewing')
})

test('merge: an uncommitted worktree blocks the merge', () => {
  const g = gate({ snapshot: makeSnap({ worktree: { dirtyCount: 2 } }) })
  assert.deepEqual(g.reasons.merge, ['worktree-dirty 2'])
})

test('merge: a detached main repo cannot be switched to the base', () => {
  const g = gate({ snapshot: makeSnap({ repo: { currentBranch: '' } }) })
  assert.deepEqual(g.reasons.merge, ['not-on-base —'])
})

test('merge: another checked-out branch is fine (the merge switches itself)', () => {
  const g = gate({ snapshot: makeSnap({ repo: { currentBranch: 'feature-other' } }) })
  assert.equal(g.reasons.merge, undefined)
})

test('merge: uncommitted changes in the main repo block the merge', () => {
  const g = gate({ snapshot: makeSnap({ repo: { dirtyCount: 4 } }) })
  assert.deepEqual(g.reasons.merge, ['repo-dirty 4'])
})

test('merge: an unfinished main-repo operation blocks the merge', () => {
  const g = gate({ snapshot: makeSnap({ repo: { inProgress: 'cherry-pick' } }) })
  assert.deepEqual(g.reasons.merge, ['in-progress'])
})

test('merge: a running agent blocks the merge', () => {
  const g = gate({ running: true, status: 'running' })
  assert.deepEqual(g.reasons.merge, ['agent-running'])
})

test('merge: a pending interaction blocks the merge', () => {
  const g = gate({ pending: true })
  assert.deepEqual(g.reasons.merge, ['agent-pending'])
})

test('merge: a predicted conflict blocks the merge', () => {
  const g = gate({ previewState: { phase: 'ready', checkedAt: 1, preview: { conflict: true, checked: true, supported: true } } })
  assert.deepEqual(g.reasons.merge, ['preview-conflict'])
})

test('merge: a preview still running reports the check in progress', () => {
  const g = gate({ previewState: { phase: 'checking' } })
  assert.deepEqual(g.reasons.merge, ['preview-checking'])
})

test('merge: no preview yet reports the check in progress', () => {
  const g = gate({ previewState: { phase: 'idle' } })
  assert.deepEqual(g.reasons.merge, ['preview-checking'])
})

test('merge: a failed pre-check blocks the merge', () => {
  const g = gate({ previewState: { phase: 'ready', checkedAt: 1, preview: { checked: false, supported: true } } })
  assert.deepEqual(g.reasons.merge, ['precheck-blocked'])
})

test('merge: a Git too old to pre-check does not block the merge', () => {
  const g = gate({ previewState: { phase: 'ready', checkedAt: 1, preview: { checked: false, supported: false } } })
  assert.equal(g.reasons.merge, undefined)
})

test('merge: a clean review task on the base with a passing preview is ready', () => {
  const g = gate()
  assert.equal(g.reasons.merge, undefined)
  assert.equal(g.disabled.merge, undefined)
})

test('merge: post-merge commits allow merging again', () => {
  const g = gate({
    snapshot: makeSnap({ status: 'merged', postMergeAhead: 3, worktree: { ahead: 0 } }),
    status: 'merged',
  })
  assert.equal(g.reasons.merge, undefined)
  assert.equal(g.disabled.merge, undefined)
})

test('merge: a re-merge still reports a dirty worktree', () => {
  const g = gate({
    snapshot: makeSnap({ status: 'merged', postMergeAhead: 2, worktree: { dirtyCount: 1 } }),
    status: 'merged',
  })
  assert.deepEqual(g.reasons.merge, ['worktree-dirty 1'])
})

test('merge: preview errors surface their message', () => {
  const g = gate({ previewState: { phase: 'error', message: 'preview exploded' } })
  assert.deepEqual(g.reasons.merge, ['preview exploded'])
})
