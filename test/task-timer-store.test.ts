import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs, statSync } from 'node:fs'
import { join } from 'node:path'
import { Store } from '../src/store.js'
import type { WorktreeTask } from '../src/models.js'
import { mkTempDir, rmrf } from './helpers/git.js'

const MINUTE = 60 * 1000

function task(id: string, over: Partial<WorktreeTask> = {}): WorktreeTask {
  return {
    id,
    projectId: 'p1',
    title: 't-' + id,
    description: 'd',
    repoPath: 'C:/repo',
    baseBranch: 'main',
    branch: 'b-' + id,
    worktreePath: 'C:/repo/.dsh-worktrees/' + id,
    sessionId: null,
    firstPrompt: '',
    startOnBind: true,
    createdAt: 1,
    updatedAt: 1,
    ...over,
  }
}

let root = ''
let dir = ''
let store: Store

// `now` is always injected, so the assertions never read the system clock.
before(async () => {
  root = await mkTempDir('dshw-timer-')
  dir = join(root, 'state')
  store = new Store(dir)
  await store.load()
})

after(async () => {
  store.dispose()
  await new Promise((resolve) => setTimeout(resolve, 100))
  if (root) await rmrf(root)
})

const fileStamp = () => statSync(join(dir, 'tasks.json')).mtimeMs

test('start then stop accumulates the stretch and persists it', async () => {
  store.putTask(task('cycle'))
  const started = store.startTaskTimer('cycle', 1000)
  assert.equal(started.ok, true)
  if (!started.ok) return
  assert.equal(started.task.workStartedAt, 1000)
  assert.equal(started.task.workMs, 0)
  assert.equal(started.task.updatedAt, 1000, 'the write stamps updatedAt')

  const stopped = store.stopTaskTimer('cycle', 1000 + 5 * MINUTE)
  assert.equal(stopped.ok, true)
  if (!stopped.ok) return
  assert.equal(stopped.task.workMs, 5 * MINUTE)
  assert.equal('workStartedAt' in stopped.task, false, 'the start stamp is dropped, not zeroed')
  assert.equal(stopped.task.updatedAt, 1000 + 5 * MINUTE)

  // The total survives a reload from disk.
  const reopened = new Store(dir)
  await reopened.load()
  try {
    const reloaded = reopened.getTask('cycle')
    assert.ok(reloaded)
    assert.equal(reloaded.workMs, 5 * MINUTE)
    assert.equal('workStartedAt' in reloaded, false)
  } finally {
    reopened.dispose()
  }
})

test('a second cycle adds to the first total', () => {
  store.putTask(task('twice', { workMs: 10 * MINUTE }))
  const started = store.startTaskTimer('twice', 1000)
  assert.equal(started.ok, true)
  const stopped = store.stopTaskTimer('twice', 1000 + 4 * MINUTE)
  assert.equal(stopped.ok, true)
  if (!stopped.ok) return
  assert.equal(stopped.task.workMs, 14 * MINUTE)
})

test('repeated start and stop are idempotent and do not touch the file', async () => {
  store.putTask(task('idem'))
  const started = store.startTaskTimer('idem', 2000)
  assert.equal(started.ok, true)
  if (!started.ok) return
  const stamp = started.task.workStartedAt
  const before = fileStamp()
  await new Promise((resolve) => setTimeout(resolve, 30))

  const again = store.startTaskTimer('idem', 99_000)
  assert.equal(again.ok, true)
  if (!again.ok) return
  assert.equal(again.task.workStartedAt, stamp, 'restarting must not reset the interval')
  assert.equal(again.task.updatedAt, 2000, 'an idempotent start does not restamp updatedAt')
  assert.equal(fileStamp(), before, 'an idempotent start does not write the state file')

  const stopped = store.stopTaskTimer('idem', 99_000)
  assert.equal(stopped.ok, true)
  const stopStamp = fileStamp()
  await new Promise((resolve) => setTimeout(resolve, 30))
  const stoppedAgain = store.stopTaskTimer('idem', 120_000)
  assert.equal(stoppedAgain.ok, true)
  if (!stoppedAgain.ok || !stopped.ok) return
  assert.equal(stoppedAgain.task.workMs, stopped.task.workMs, 'a repeated stop adds nothing')
  assert.equal(fileStamp(), stopStamp, 'a repeated stop does not write the state file')
})

test('closed tasks refuse a new timer but a running one can still be stopped', () => {
  for (const closed of [{ mergedAt: 1 }, { cleanedAt: 1 }, { archivedAt: 1 }]) {
    const id = 'closed-' + Object.keys(closed)[0]
    store.putTask(task(id, closed))
    assert.deepEqual(store.startTaskTimer(id, 1000), { ok: false, reason: 'closed' })
  }

  // A clock left running when the task merged must still be stoppable.
  store.putTask(task('mid'))
  assert.equal(store.startTaskTimer('mid', 1000).ok, true)
  store.putTask(task('mid', { workStartedAt: 1000, mergedAt: 5000 }))
  const stopped = store.stopTaskTimer('mid', 1000 + MINUTE)
  assert.equal(stopped.ok, true)
  if (!stopped.ok) return
  assert.equal(stopped.task.workMs, MINUTE)
  assert.equal(stopped.task.mergedAt, 5000, 'stopping keeps the lifecycle stamps')
})

test('unknown tasks report missing for both actions', () => {
  assert.deepEqual(store.startTaskTimer('nope', 1000), { ok: false, reason: 'missing' })
  assert.deepEqual(store.stopTaskTimer('nope', 1000), { ok: false, reason: 'missing' })
})

test('a backwards clock never shrinks the recorded total', () => {
  store.putTask(task('skew', { workMs: 7 * MINUTE, workStartedAt: 10 * MINUTE }))
  const stopped = store.stopTaskTimer('skew', MINUTE)
  assert.equal(stopped.ok, true)
  if (!stopped.ok) return
  assert.equal(stopped.task.workMs, 7 * MINUTE)
})
