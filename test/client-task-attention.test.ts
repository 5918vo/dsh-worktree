import test from 'node:test'
import assert from 'node:assert/strict'
import {
  RECOVERY_UI_READY,
  categoryKey,
  computeFilterCounts,
  deriveTaskAttention,
  filterViewsByAttention,
  parseTurnEndHealth,
  quickActionKey,
  summarizeAttention,
} from '../src/client/task-attention.js'
import { matchesSearch } from '../src/client/model.js'

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

test('pending: approval, question and plan review all land in the same category', () => {
  for (const kind of ['approval', 'question', 'plan-review', 'permission']) {
    const a = deriveTaskAttention({ task: { sessionId: 's' }, snapshot: snap(), pendingKind: kind })
    assert.ok(a.categories.has('pending'), kind)
    assert.equal(a.primaryAlert, 'pending', kind)
  }
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

test('session health is an alert only: idle interruptions flag the row, running ones do not', () => {
  const running = deriveTaskAttention({ task: { sessionId: 's' }, snapshot: snap({ status: 'developing' }), running: true, health: { kind: 'interrupted' } })
  assert.equal(running.primaryAlert, null)
  assert.deepEqual(running.extraAlerts, [])
  assert.equal(running.categories.size, 0)
  const idle = deriveTaskAttention({ task: { sessionId: 's' }, snapshot: snap({ status: 'developing' }), running: false, health: { kind: 'interrupted' } })
  assert.equal(idle.primaryAlert, 'session')
  assert.equal(idle.categories.size, 0)
  const errored = deriveTaskAttention({ task: { sessionId: 's' }, snapshot: snap({ status: 'developing' }), health: { kind: 'error', message: 'boom' } })
  assert.equal(errored.primaryAlert, 'session')
})

test('quick action priority: handle > review > open-session; none without a session', () => {
  assert.equal(deriveTaskAttention({ task: { sessionId: 's' }, snapshot: snap({ worktree: { ahead: 1 } }), pendingKind: 'approval' }).quickAction, 'handle')
  assert.equal(deriveTaskAttention({ task: { sessionId: null }, snapshot: snap({ worktree: { ahead: 1 } }), pendingKind: 'approval' }).quickAction, 'review')
  assert.equal(deriveTaskAttention({ task: { sessionId: 's' }, snapshot: snap({ status: 'developing', worktree: { ahead: 0 } }) }).quickAction, 'open-session')
  assert.equal(deriveTaskAttention({ task: { sessionId: null }, snapshot: snap({ status: 'developing', worktree: { ahead: 0 } }) }).quickAction, null)
})

test('quick action: a stuck recovery outranks handling a pending prompt', () => {
  const a = deriveTaskAttention({
    task: { sessionId: 's', pendingOp: { recoveryStatus: 'needs-manual' } },
    snapshot: snap({ worktree: { ahead: 1 } }),
    pendingKind: 'approval',
  })
  assert.equal(a.quickAction, 'recover')
  assert.deepEqual(a.extraAlerts, ['pending'])
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

test('summarizeAttention is empty for a calm board', () => {
  const views = [view('a', snap({ status: 'developing', worktree: { ahead: 0 } }))]
  const s = summarizeAttention(views, (v) => deriveTaskAttention({ task: v.task, snapshot: v.snapshot }))
  assert.equal(s.total, 0)
  assert.equal(s.maxSeverity, 0)
  assert.deepEqual(s.counts, { pending: 0, review: 0, recovery: 0, broken: 0 })
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

test('computeFilterCounts keeps a task counted once even across categories', () => {
  const view0 = { task: { id: 'x' }, snapshot: {} }
  const get = (): any => ({
    categories: new Set(['pending', 'review']),
    primaryAlert: 'pending',
    extraAlerts: [],
    quickAction: null,
    stale: false,
  })
  const counts = computeFilterCounts([view0], [view0], get, true)
  assert.equal(counts.pending, 1)
  assert.equal(counts.review, 1)
  assert.equal(counts.total, 1)
})

test('parseTurnEndHealth reads the reason from event.data', () => {
  assert.deepEqual(
    parseTurnEndHealth([{ event: { type: 'turn/end', data: { turn: 1, reason: { kind: 'interrupted' } } } }]),
    { kind: 'interrupted' },
  )
  assert.deepEqual(
    parseTurnEndHealth([{ event: { type: 'turn/end', data: { reason: { kind: 'error', error: { message: 'boom' } } } } }]),
    { kind: 'error', message: 'boom' },
  )
  // A completed turn clears any earlier failure.
  assert.equal(parseTurnEndHealth([
    { event: { type: 'turn/end', data: { reason: { kind: 'error', message: 'old' } } } },
    { event: { type: 'turn/end', data: { reason: { kind: 'completed' } } } },
  ]), null)
  assert.equal(parseTurnEndHealth([]), null)
  assert.equal(parseTurnEndHealth(undefined as any), null)
})

test('matchesSearch remembers every searchable field', () => {
  assert.equal(matchesSearch('', ['anything']), true)
  assert.equal(matchesSearch('log', ['fix-login', 'feat/x']), true)
  assert.equal(matchesSearch('FIX', ['fix-login']), true)
  assert.equal(matchesSearch('nope', ['fix-login', null, undefined]), false)
})
