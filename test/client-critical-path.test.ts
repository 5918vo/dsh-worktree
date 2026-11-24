import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildCriticalPath,
  CRITICAL_PATH_LIMIT,
  CRITICAL_PATH_MAX_NODES,
} from '../src/client/critical-path.js'
import type { TaskSnapshot, TaskStatus, TaskView, WorktreeTask } from '../src/models.js'

const NOW = new Date(2026, 5, 15, 12, 0, 0, 0).getTime()

function task(over: Partial<WorktreeTask> = {}): WorktreeTask {
  return {
    id: 't1',
    projectId: 'p1',
    title: 'Task',
    description: '',
    repoPath: 'C:/repo',
    baseBranch: 'main',
    branch: 'dsh/t1',
    worktreePath: 'C:/wt',
    sessionId: null,
    firstPrompt: '',
    startOnBind: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  } as WorktreeTask
}

function snapshot(over: Partial<TaskSnapshot> = {}): TaskSnapshot {
  return {
    worktree: { exists: true, branch: 'dsh/t1', dirtyCount: 0, ahead: 0, commits: [], lastCommitAt: null },
    repo: { exists: true, currentBranch: 'main', dirtyCount: 0 },
    branchExists: true,
    merged: false,
    status: 'review',
    ...over,
  } as TaskSnapshot
}

function view(over: Partial<WorktreeTask> = {}, status: TaskStatus = 'review'): TaskView {
  return { task: task(over), snapshot: snapshot({ status }) }
}

function ids(list: Array<{ id: string }>): string[] {
  return list.map((item) => item.id)
}

test('empty input: empty chain, zero counts, not capped', () => {
  const path = buildCriticalPath([])
  assert.deepEqual(path.chain, [])
  assert.equal(path.length, 0)
  assert.deepEqual(path.ready, [])
  assert.equal(path.blocked, 0)
  assert.equal(path.missing, 0)
  assert.equal(path.open, 0)
  assert.equal(path.truncated, false)
  assert.deepEqual(path.cycles, [])
  assert.equal(path.capped, false)
})

test('tasks without dependencies: longest chain is 1, every open task is ready', () => {
  const path = buildCriticalPath([
    view({ id: 'a', title: 'Alpha', createdAt: NOW - 3 }),
    view({ id: 'b', title: 'Beta', createdAt: NOW - 2 }),
    view({ id: 'c', title: 'Gamma', createdAt: NOW - 1 }),
  ])
  assert.equal(path.open, 3)
  assert.equal(path.length, 1)
  assert.equal(path.chain.length, 1)
  assert.equal(path.chain[0].depth, 1)
  assert.deepEqual(ids(path.ready), ['c', 'b', 'a'])
  assert.equal(path.blocked, 0)
  assert.equal(path.missing, 0)
  assert.equal(path.truncated, false)
})

test('linear chain A->B->C: order, depth and a single ready task', () => {
  const path = buildCriticalPath([
    view({ id: 'a', title: 'A', createdAt: NOW - 3 }),
    view({ id: 'b', title: 'B', createdAt: NOW - 2, dependsOn: ['a'] }),
    view({ id: 'c', title: 'C', createdAt: NOW - 1, dependsOn: ['b'] }),
  ])
  assert.deepEqual(ids(path.chain), ['a', 'b', 'c'])
  assert.deepEqual(path.chain.map((node) => node.depth), [1, 2, 3])
  assert.equal(path.length, 3)
  assert.deepEqual(ids(path.ready), ['a'])
  assert.equal(path.blocked, 2)
  assert.equal(path.open, 3)
})

test('diamond A->B, A->C, B->D, C->D: longest chain is 3 and only A is ready', () => {
  const path = buildCriticalPath([
    view({ id: 'a', title: 'A', createdAt: NOW - 4 }),
    view({ id: 'b', title: 'B', createdAt: NOW - 3, priority: 'high', dependsOn: ['a'] }),
    view({ id: 'c', title: 'C', createdAt: NOW - 2, dependsOn: ['a'] }),
    view({ id: 'd', title: 'D', createdAt: NOW - 1, dependsOn: ['b', 'c'] }),
  ])
  assert.equal(path.length, 3)
  assert.deepEqual(ids(path.chain), ['a', 'b', 'd'])
  assert.deepEqual(path.chain.map((node) => node.depth), [1, 2, 3])
  const depthOf = new Map(path.chain.concat(path.ready).map((node) => [node.id, node.depth]))
  assert.equal(depthOf.get('a'), 1)
  assert.deepEqual(ids(path.ready), ['a'])
  assert.equal(path.blocked, 3)
})

test('multiple roots and multiple prerequisites: ties break by compareTaskOrder', () => {
  const path = buildCriticalPath([
    view({ id: 'old', title: 'Old root', createdAt: NOW - 100 }),
    view({ id: 'pinned', title: 'Pinned root', createdAt: NOW - 200, pinnedAt: NOW }),
    view({ id: 'fromOld', title: 'From old', createdAt: NOW - 50, dependsOn: ['old'] }),
    view({ id: 'fromPinned', title: 'From pinned', createdAt: NOW - 60, pinnedAt: NOW, dependsOn: ['pinned'] }),
    view({ id: 'join', title: 'Join', createdAt: NOW - 10, dependsOn: ['fromOld', 'fromPinned'] }),
  ])
  assert.equal(path.length, 3)
  // Both roots have depth 1; the pinned one wins the tie, so every hop prefers it.
  assert.deepEqual(ids(path.chain), ['pinned', 'fromPinned', 'join'])
  assert.deepEqual(path.ready.slice().sort((a, b) => (a.id < b.id ? -1 : 1)).map((node) => node.id), ['old', 'pinned'])
})

test('done prerequisites do not block; unfinished and missing ones do', () => {
  const path = buildCriticalPath([
    view({ id: 'merged', title: 'Merged', mergedAt: NOW - 20 }),
    view({ id: 'cleaned', title: 'Cleaned', cleanedAt: NOW - 10 }),
    view({ id: 'open', title: 'Open' }),
    view({ id: 'afterDone', title: 'After done', dependsOn: ['merged', 'cleaned'] }),
    view({ id: 'afterOpen', title: 'After open', dependsOn: ['open'] }),
    view({ id: 'afterMissing', title: 'After missing', dependsOn: ['ghost', 'ghost2'] }),
  ])
  const ready = ids(path.ready).slice().sort()
  assert.deepEqual(ready, ['afterDone', 'cleaned', 'merged', 'open'].sort())
  assert.equal(path.blocked, 2)
  assert.equal(path.missing, 2)
  assert.equal(path.open, 6)
})

test('cycle A->B->A: no hang, cycles reported, chain still returned', () => {
  const path = buildCriticalPath([
    view({ id: 'a', title: 'A', createdAt: NOW - 2, dependsOn: ['b'] }),
    view({ id: 'b', title: 'B', createdAt: NOW - 1, dependsOn: ['a'] }),
  ])
  assert.ok(path.cycles.length > 0)
  assert.deepEqual(path.cycles.slice().sort(), ['a', 'b'])
  assert.equal(path.length, 2)
  assert.deepEqual(ids(path.ready), [])
  assert.equal(path.blocked, 2)
  assert.equal(path.capped, false)
})

test('archived tasks leave the ready queue; a broken open task stays', () => {
  const path = buildCriticalPath([
    view({ id: 'archived', title: 'Archived', archivedAt: NOW }, 'ready'),
    view({ id: 'broken', title: 'Broken', createdAt: NOW - 1 }, 'broken'),
    view({ id: 'merged', title: 'Merged' }, 'merged'),
  ])
  assert.deepEqual(ids(path.ready), ['broken'])
  assert.equal(path.open, 1)
  assert.equal(path.blocked, 0)
  assert.equal(path.length, 1)
})

test('more than five ready tasks: five kept, truncated flagged', () => {
  const views: TaskView[] = []
  for (let i = 0; i < CRITICAL_PATH_LIMIT + 3; i += 1) {
    views.push(view({ id: 't' + i, title: 'Task ' + i, createdAt: NOW - i }))
  }
  const path = buildCriticalPath(views)
  assert.equal(path.ready.length, CRITICAL_PATH_LIMIT)
  assert.equal(path.readyTotal, CRITICAL_PATH_LIMIT + 3)
  assert.equal(path.truncated, true)
  assert.deepEqual(ids(path.ready), ['t0', 't1', 't2', 't3', 't4'])
})

test('node guard: a chain longer than the cap stops expanding and flags capped', () => {
  const total = CRITICAL_PATH_MAX_NODES + 60
  const views: TaskView[] = []
  for (let i = 0; i < total; i += 1) {
    const id = 'n' + String(i).padStart(4, '0')
    const dep = i === 0 ? undefined : 'n' + String(i - 1).padStart(4, '0')
    views.push(view({ id, title: 'Node ' + i, createdAt: NOW - i, dependsOn: dep ? [dep] : [] }))
  }
  const path = buildCriticalPath(views)
  assert.equal(path.capped, true)
  assert.ok(path.length > 0)
  assert.ok(path.length <= CRITICAL_PATH_MAX_NODES)
  assert.equal(path.open, total)
  // Only the head of the chain is ready; the rest is blocked by its predecessor.
  assert.deepEqual(ids(path.ready), ['n0000'])
})

test('determinism: the same input yields deeply equal output', () => {
  const views = [
    view({ id: 'a', title: 'A', createdAt: NOW - 5 }),
    view({ id: 'b', title: 'B', createdAt: NOW - 4, dependsOn: ['a'] }),
    view({ id: 'c', title: 'C', createdAt: NOW - 3, dependsOn: ['a'] }),
    view({ id: 'd', title: 'D', createdAt: NOW - 2, dependsOn: ['b', 'c'] }),
    view({ id: 'e', title: 'E', createdAt: NOW - 1, dependsOn: ['ghost'] }),
  ]
  const first = buildCriticalPath(views)
  const second = buildCriticalPath(views.slice().reverse())
  assert.deepEqual(first, second)
})

test('status snapshot is carried through for the localized label', () => {
  const path = buildCriticalPath([view({ id: 'a', title: 'A' }, 'reviewing')])
  assert.equal(path.chain[0].status, 'reviewing')
  assert.equal(path.chain[0].title, 'A')
})
