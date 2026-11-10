import test from 'node:test'
import assert from 'node:assert/strict'
import {
  RECOVERY_UI_READY,
  categoryKey,
  computeFilterCounts,
  deriveTaskAttention,
  filterViewsByAttention,
  quickActionKey,
  summarizeAttention,
} from '../src/client/task-attention.js'

function snap(over: any = {}) {
  return Object.assign(
    {
      status: 'review',
      worktree: { exists: true, branch: 'b', dirtyCount: 0, ahead: 0, commits: [], lastCommitAt: null },
      repo: { exists: true, currentBranch: 'main', dirtyCount: 0 },
      branchExists: true,
      merged: false,
    },
    over,
  )
}
function view(id: string, snapshot: any, task: any = {}) {
  return { task: Object.assign({ id, sessionId: 's1' }, task), snapshot }
}

test('pending: any interaction kind marks the category once', () => {
  const a = deriveTaskAttention({ task: view('t', snap()).task, snapshot: snap(), pendingKind: 'approval' })
  assert.ok(a.categories.has('pending'))
  assert.equal(a.categories.size, 1)
  assert.equal(a.primaryAlert, 'pending')
  assert.equal(deriveTaskAttention({ task: {}, snapshot: snap() }).categories.has('pending'), false)
})

test('review: commits ahead or post-merge patches, never only dirty, never while reviewing', () => {
  assert.ok(deriveTaskAttention({ task: {}, snapshot: snap({ worktree: { ahead: 2 } }) }).categories.has('review'))
  assert.ok(deriveTaskAttention({ task: {}, snapshot: snap({ postMergeAhead: 1 }) }).categories.has('review'))
  // only uncommitted changes -> not review
  assert.equal(deriveTaskAttention({ task: {}, snapshot: snap({ worktree: { ahead: 0, dirtyCount: 3 } }) }).categories.has('review'), false)
  // currently reviewing -> not review
  assert.equal(deriveTaskAttention({ task: {}, snapshot: snap({ status: 'reviewing', worktree: { ahead: 2 } }) }).categories.has('review'), false)
})

test('recovery: pendingOp journal triggers it; a plain stash reminder does not', () => {
  assert.equal(RECOVERY_UI_READY, true)
  const op = view('t', snap(), { pendingOp: { recoveryStatus: 'needs-manual' }, sessionId: 's' })
  const a = deriveTaskAttention({ task: op.task, snapshot: op.snapshot })
  assert.ok(a.categories.has('recovery'))
  assert.equal(a.primaryAlert, 'recovery')
  assert.equal(a.quickAction, 'recover')
  // In-flight merge (repo locked) is not a stuck recovery.
  assert.equal(deriveTaskAttention({ task: op.task, snapshot: op.snapshot, repoLockLabel: '合并' }).categories.has('recovery'), false)
  // A normal saved stash is only a reminder, not a recovery category.
  const st = view('s', snap(), { pendingStashes: [{ sha: 'x', ref: 'msg' }], sessionId: 's' })
  assert.equal(deriveTaskAttention({ task: st.task, snapshot: st.snapshot }).categories.has('recovery'), false)
})

test('broken covers read failure / missing branch / status broken but not stale', () => {
  assert.ok(deriveTaskAttention({ task: {}, snapshot: snap({ status: 'broken' }) }).categories.has('broken'))
  assert.ok(deriveTaskAttention({ task: {}, snapshot: snap({ error: 'boom', status: 'developing' }) }).categories.has('broken'))
  assert.ok(deriveTaskAttention({ task: {}, snapshot: snap({ branchExists: false, status: 'review', worktree: { ahead: 1 } }) }).categories.has('broken'))
  // cleaned with missing branch is fine
  assert.equal(deriveTaskAttention({ task: {}, snapshot: snap({ status: 'cleaned', branchExists: false }) }).categories.has('broken'), false)
  // stale is not broken
  const stale = deriveTaskAttention({ task: {}, snapshot: snap(), stale: true })
  assert.equal(stale.categories.has('broken'), false)
  assert.equal(stale.stale, true)
})

test('primary/extra alert priority: pending > broken > post-merge > session', () => {
  const a = deriveTaskAttention({
    task: {},
    snapshot: snap({ status: 'broken', postMergeAhead: 2, worktree: { ahead: 2 } }),
    pendingKind: 'question',
    health: { kind: 'error' },
    running: false,
  })
  assert.equal(a.primaryAlert, 'pending')
  assert.deepEqual(a.extraAlerts, ['broken', 'post-merge', 'session'])
})

test('quick action priority: handle > review > open-session; none without a session', () => {
  assert.equal(deriveTaskAttention({ task: { sessionId: 's' }, snapshot: snap({ worktree: { ahead: 1 } }), pendingKind: 'approval' }).quickAction, 'handle')
  assert.equal(deriveTaskAttention({ task: { sessionId: null }, snapshot: snap({ worktree: { ahead: 1 } }), pendingKind: 'approval' }).quickAction, 'review')
  assert.equal(deriveTaskAttention({ task: { sessionId: 's' }, snapshot: snap({ status: 'developing', worktree: { ahead: 0 } }) }).quickAction, 'open-session')
  assert.equal(deriveTaskAttention({ task: { sessionId: null }, snapshot: snap({ status: 'developing', worktree: { ahead: 0 } }) }).quickAction, null)
})

test('summarizeAttention dedupes tasks and allows overlap across categories', () => {
  const views = [
    view('a', snap({ worktree: { ahead: 1 } }), { sessionId: 's' }), // review
    view('b', snap({ status: 'broken' }), { sessionId: 's' }), // broken
    view('c', snap({ worktree: { ahead: 1 }, status: 'broken' })), // review + broken
  ]
  const map = new Map(views.map((v) => [v.task.id, deriveTaskAttention({ task: v.task, snapshot: v.snapshot })]))
  const s = summarizeAttention(views, (v) => map.get(v.task.id) as any)
  assert.equal(s.counts.review, 2)
  assert.equal(s.counts.broken, 2)
  assert.equal(s.total, 3)
  assert.equal(s.maxSeverity, 3)
})

test('filterViewsByAttention keeps matching tasks only', () => {
  const views = [view('a', snap({ worktree: { ahead: 1 } })), view('b', snap({ status: 'developing', worktree: { ahead: 0 } }))]
  const map = new Map(views.map((v) => [v.task.id, deriveTaskAttention({ task: v.task, snapshot: v.snapshot })]))
  const get = (v: any) => map.get(v.task.id) as any
  assert.deepEqual(filterViewsByAttention(views, get, 'review').map((v) => v.task.id), ['a'])
  assert.deepEqual(filterViewsByAttention(views, get, 'all').map((v) => v.task.id), ['a', 'b'])
})

test('locale keys are stable', () => {
  assert.equal(categoryKey('all'), 'attentionAll')
  assert.equal(categoryKey('recovery'), 'attentionRecovery')
  assert.equal(quickActionKey('review'), 'quickReview')
  assert.equal(quickActionKey('open-session'), 'openSessionBtn')
})

test('computeFilterCounts: recovery counts archived tasks only when ready', () => {
  const archived = { task: { id: 'a' }, snapshot: {} }
  const visible = { task: { id: 'v' }, snapshot: {} }
  const get = (v: any): any => ({
    categories: new Set(v === archived ? ['recovery'] : ['review']),
    primaryAlert: null,
    extraAlerts: [],
    quickAction: null,
    stale: false,
  })
  const off = computeFilterCounts([visible], [archived, visible], get, false)
  assert.equal(off.recovery, 0)
  assert.equal(off.review, 1)
  assert.equal(off.all, 1)
  assert.equal(off.total, 1)
  const on = computeFilterCounts([visible], [archived, visible], get, true)
  assert.equal(on.recovery, 1)
  assert.equal(on.total, 2)
})
