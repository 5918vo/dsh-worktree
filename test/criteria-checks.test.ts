import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { Store } from '../src/store.js'
import type { WorktreeTask } from '../src/models.js'
import { bootHost } from './helpers/host.js'
import { callRoute, findRoute } from './helpers/http.js'
import { mkTempDir, rmrf } from './helpers/git.js'

const PREFIX = '/dsh-worktree/api'

const tempDirs: string[] = []

after(async () => {
  for (const dir of tempDirs) await rmrf(dir)
})

function task(id: string, criteria: string[], repoPath: string): WorktreeTask {
  return {
    id,
    projectId: 'p1',
    title: 't-' + id,
    description: '',
    repoPath,
    baseBranch: 'main',
    branch: 'b-' + id,
    worktreePath: join(repoPath, '.dsh-worktrees', id),
    sessionId: null,
    firstPrompt: '',
    startOnBind: false,
    acceptanceCriteria: criteria,
    createdAt: 1,
    updatedAt: 1,
  }
}

test('store toggles criteria in standard order and persists them', async () => {
  const dir = await mkTempDir('dshw-criteria-store-')
  tempDirs.push(dir)
  const repo = join(dir, 'repo')
  const store = new Store(dir)
  await store.load()
  store.putTask(task('t1', ['a', 'b', 'c'], repo))

  const first = store.setCriterionChecked('t1', 'b', true)
  assert.equal(first.ok, true)
  if (!first.ok) return
  assert.deepEqual(first.task.checkedCriteria, ['b'])

  // Click order must not leak into the record: checkedCriteria follows the
  // acceptanceCriteria order, so the checklist never reshuffles while checked.
  const second = store.setCriterionChecked('t1', 'c', true)
  assert.equal(second.ok, true)
  if (second.ok) assert.deepEqual(second.task.checkedCriteria, ['b', 'c'])
  const third = store.setCriterionChecked('t1', 'a', true)
  assert.equal(third.ok, true)
  if (third.ok) assert.deepEqual(third.task.checkedCriteria, ['a', 'b', 'c'])

  // Re-checking is idempotent.
  const again = store.setCriterionChecked('t1', 'a', true)
  assert.equal(again.ok, true)
  if (again.ok) assert.deepEqual(again.task.checkedCriteria, ['a', 'b', 'c'])

  const unchecked = store.setCriterionChecked('t1', 'b', false)
  assert.equal(unchecked.ok, true)
  if (unchecked.ok) assert.deepEqual(unchecked.task.checkedCriteria, ['a', 'c'])

  assert.deepEqual(store.setCriterionChecked('t1', 'nope', true), { ok: false, reason: 'unknown' })
  assert.deepEqual(store.setCriterionChecked('missing', 'a', true), { ok: false, reason: 'missing' })

  // A recorded check whose standard disappeared is dropped on the next write.
  const trimmed = task('t1', ['a'], repo)
  trimmed.updatedAt = 1
  store.putTask(trimmed)
  const pruned = store.setCriterionChecked('t1', 'a', true)
  assert.equal(pruned.ok, true)
  if (pruned.ok) assert.deepEqual(pruned.task.checkedCriteria, ['a'])

  // Durable: a fresh store reads the same record back from disk.
  const reloaded = new Store(dir)
  await reloaded.load()
  assert.deepEqual(reloaded.getTask('t1')?.checkedCriteria, ['a'])

  store.dispose()
  reloaded.dispose()
})

test('two store instances keep each other’s criterion writes', async () => {
  const dir = await mkTempDir('dshw-criteria-multi-')
  tempDirs.push(dir)
  const repo = join(dir, 'repo')
  const first = new Store(dir)
  const second = new Store(dir)
  await first.load()
  await second.load()
  first.putTask(task('t1', ['a', 'b'], repo))

  // The second store has never seen this task in memory; its write must start
  // from the disk baseline (refresh inside the lock) instead of an empty map.
  const one = first.setCriterionChecked('t1', 'a', true)
  assert.equal(one.ok, true)
  const two = second.setCriterionChecked('t1', 'b', true)
  assert.equal(two.ok, true)
  if (two.ok) assert.deepEqual(two.task.checkedCriteria, ['a', 'b'])

  const reloaded = new Store(dir)
  await reloaded.load()
  assert.deepEqual(reloaded.getTask('t1')?.checkedCriteria, ['a', 'b'])

  first.dispose()
  second.dispose()
  reloaded.dispose()
})

test('POST task/criteria checks a criterion over HTTP', async () => {
  const root = await mkTempDir('dshw-criteria-http-')
  tempDirs.push(root)
  const harness = bootHost({}, { stateDir: join(root, 'state') })
  // The repo/worktree paths do not exist: computeSnapshot catches the failure
  // and reports `broken`, which is enough for a view response.
  harness.app.store.putTask(task('t1', ['a', 'b'], join(root, 'missing-repo')))

  const call = (name: string, opts: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) =>
    callRoute(findRoute(harness.routes, `${PREFIX}/${name}`).handler, {
      method: opts.method || 'POST',
      url: `${PREFIX}/${name}`,
      headers: Object.assign({ 'content-type': 'application/json' }, opts.headers || {}),
      body: opts.body,
    })

  const session = await call('session', { body: {} })
  const token = String(session.body.token || '')
  assert.ok(token, 'expected a board token from POST /session')
  const auth = { 'x-dsh-worktree-token': token }

  const ok = await call('task/criteria', { headers: auth, body: { id: 't1', text: 'a', checked: true } })
  assert.equal(ok.status, 200)
  assert.deepEqual(ok.body.view.task.checkedCriteria, ['a'])

  const list = await call('tasks', { method: 'GET', headers: auth })
  assert.equal(list.status, 200)
  assert.deepEqual(list.body.tasks[0].task.checkedCriteria, ['a'])

  const noToken = await call('task/criteria', { body: { id: 't1', text: 'b', checked: true } })
  assert.equal(noToken.status, 403)

  const missing = await call('task/criteria', { headers: auth, body: { id: 'missing', text: 'a', checked: true } })
  assert.equal(missing.status, 404)

  const unknown = await call('task/criteria', { headers: auth, body: { id: 't1', text: 'zzz', checked: true } })
  assert.equal(unknown.status, 400)
  assert.equal(unknown.body.code, 'unknown-criterion')

  const empty = await call('task/criteria', { headers: auth, body: { id: 't1', text: '   ', checked: true } })
  assert.equal(empty.status, 400)
})
