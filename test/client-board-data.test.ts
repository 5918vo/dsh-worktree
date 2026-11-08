import test from 'node:test'
import assert from 'node:assert/strict'
import { provisionalSnapshot, upsertPublishedTask } from '../src/client/board-data.js'

const project = (id, repoPath, name = id) => ({ id, name, repoPath, baseBranch: 'main', createdAt: 1 })

const task = (id, projectId, createdAt, extra = {}) => ({
  id,
  projectId,
  title: 'task ' + id,
  description: '',
  repoPath: 'C:/repo',
  baseBranch: 'main',
  branch: 'dsh-wt/' + id,
  worktreePath: 'C:/repo/.dsh-worktrees/' + id,
  sessionId: null,
  firstPrompt: '',
  startOnBind: false,
  createdAt,
  updatedAt: createdAt,
  ...extra,
})

const view = (p, tasks) => ({
  project: p,
  stats: { tasks: tasks.length, byStatus: {}, running: 0 },
  tasks: tasks.map((t) => ({ task: t, snapshot: provisionalSnapshot(t, 'ready') })),
})

test('provisionalSnapshot marks the worktree as present with the given status', () => {
  const snap = provisionalSnapshot(task('a', 'p1', 10), 'developing')
  assert.equal(snap.status, 'developing')
  assert.equal(snap.worktree.exists, true)
  assert.equal(snap.worktree.branch, 'dsh-wt/a')
  assert.equal(snap.merged, false)
})

test('upsertPublishedTask inserts the new task at the top of its project', () => {
  const views = [view(project('p1', 'C:/repo'), [task('old', 'p1', 5)])]
  const fresh = task('new', 'p1', 20, { sessionId: 'sess-1' })
  const next = upsertPublishedTask(views, fresh, 'p1', 'developing')
  assert.equal(views[0].tasks.length, 1, 'input must not be mutated')
  assert.equal(next[0].tasks.length, 2)
  assert.equal(next[0].tasks[0].task.id, 'new')
  assert.equal(next[0].tasks[0].snapshot.status, 'developing')
  assert.equal(next[0].stats.tasks, 2)
})

test('upsertPublishedTask replaces an existing copy instead of duplicating it', () => {
  const views = [view(project('p1', 'C:/repo'), [task('new', 'p1', 20)])]
  const next = upsertPublishedTask(views, task('new', 'p1', 20), 'p1', 'developing')
  assert.equal(next[0].tasks.length, 1)
})

test('upsertPublishedTask falls back to the repo match when the project id is unknown', () => {
  const views = [view(project('p1', 'C:/repo'), [])]
  const next = upsertPublishedTask(views, task('new', 'gone', 20), 'gone', 'ready')
  assert.equal(next[0].tasks.length, 1)
  assert.equal(next[0].tasks[0].task.projectId, 'p1')
})

test('upsertPublishedTask leaves the board untouched for an unknown repo', () => {
  const views = [view(project('p1', 'C:/repo'), [])]
  const next = upsertPublishedTask(views, { ...task('new', 'x', 20), repoPath: 'C:/other' }, 'x', 'ready')
  assert.equal(next[0].tasks.length, 0)
})
