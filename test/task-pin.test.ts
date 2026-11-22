import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { upsertPublishedTask } from '../src/client/board-data.js'
import { Runtime, TaskError } from '../src/runtime.js'
import { Store } from '../src/store.js'
import { bootHost } from './helpers/host.js'
import { callRoute, findRoute } from './helpers/http.js'
import { commitFile, initRepo, mkTempDir, rmrf } from './helpers/git.js'

const CONFIG = { dirName: '.dsh-worktrees', branchPrefix: 'dsh-wt/', gitPath: 'git' }
const PREFIX = '/dsh-worktree/api'
const TOKEN_HEADER = 'x-dsh-worktree-token'

const fakeTask = (id: string, createdAt: number) =>
  ({
    id,
    title: id,
    description: '',
    branch: `dsh-wt/${id}`,
    baseBranch: 'main',
    worktreePath: `C:/tmp/${id}`,
    repoPath: 'C:/repo',
    status: 'review',
    createdAt,
    updatedAt: createdAt,
  }) as any

let store: Store
let root = ''

before(async () => {
  root = await mkTempDir('dshw-pin-')
  store = new Store(join(root, 'state'))
  await store.load()
})

after(async () => {
  store.dispose()
  await new Promise((resolve) => setTimeout(resolve, 100))
  if (root) await rmrf(root)
})

test('setTaskPinned stamps once, keeps the timestamp and unpins by deleting it', () => {
  store.putTask(fakeTask('p1', 10))
  const first = store.setTaskPinned('p1', true)
  assert.equal(first.ok, true)
  if (!first.ok) return
  const at = first.task.pinnedAt
  assert.equal(typeof at, 'number')

  const again = store.setTaskPinned('p1', true)
  assert.equal(again.ok, true)
  if (!again.ok) return
  assert.equal(again.task.pinnedAt, at, 'repeat pin must not reorder the rail')

  const off = store.setTaskPinned('p1', false)
  assert.equal(off.ok, true)
  if (!off.ok) return
  assert.equal(off.task.pinnedAt, undefined)
  assert.equal('pinnedAt' in store.getTask('p1')!, false)

  assert.deepEqual(store.setTaskPinned('missing', true), { ok: false, reason: 'missing' })
})

test('runtime rejects pinning an unknown task', () => {
  const runtime = new Runtime({ store, config: CONFIG, sessionState: () => 'idle' })
  assert.throws(
    () => runtime.setTaskPinned('missing', true),
    (e: any) => e instanceof TaskError && e.status === 404 && /任务不存在：missing/.test(e.message),
  )
})

test('project views order pinned tasks first, then newest createdAt', async () => {
  const repo = join(root, 'repo')
  await fs.mkdir(repo, { recursive: true })
  await initRepo(repo)
  const runtime = new Runtime({ store, config: CONFIG, sessionState: () => 'idle' })
  const older = await runtime.publish({ repoPath: repo, title: 'older', description: 'd' })
  const newer = await runtime.publish({ repoPath: repo, title: 'newer', description: 'd' })
  store.putTask({ ...store.getTask(older.id)!, createdAt: 100 })
  store.putTask({ ...store.getTask(newer.id)!, createdAt: 200 })

  const before = await runtime.projectViews()
  const ids = before[0].tasks.map((v) => v.task.id)
  assert.deepEqual(ids, [newer.id, older.id])

  store.setTaskPinned(older.id, true)
  const afterPin = await runtime.projectViews()
  assert.deepEqual(afterPin[0].tasks.map((v) => v.task.id), [older.id, newer.id])
})

test('upsertPublishedTask keeps pinned tasks above fresh publications', () => {
  const project = { id: 'pr', repoPath: 'C:/repo' } as any
  const base = (id: string, createdAt: number, pinnedAt?: number) => ({
    task: { ...fakeTask(id, createdAt), pinnedAt },
    snapshot: { status: 'ready' },
    project,
  }) as any
  const views = [{ project, tasks: [base('pinned', 10, 50), base('newer', 30)] }] as any
  const out = upsertPublishedTask(views, fakeTask('fresh', 40), 'pr', 'ready')
  assert.deepEqual(out[0].tasks.map((v: any) => v.task.id), ['pinned', 'fresh', 'newer'])
})

test('POST task/pin toggles the flag through the HTTP API', async () => {
  const repo = join(root, 'http-repo')
  await fs.mkdir(repo, { recursive: true })
  await initRepo(repo)
  const harness = bootHost({}, { stateDir: join(root, 'http-state') })
  const auth = { 'content-type': 'application/json' }
  const session = await callRoute(findRoute(harness.routes, `${PREFIX}/session`).handler, {
    method: 'POST',
    url: `${PREFIX}/session`,
    headers: auth,
    body: {},
  })
  const token = session.body.token as string
  assert.ok(token)
  const task = await harness.app.runtime.publish({ repoPath: repo, title: 'pin me', description: 'd' })

  const callPin = async (pinned: boolean) =>
    callRoute(findRoute(harness.routes, `${PREFIX}/task/pin`).handler, {
      method: 'POST',
      url: `${PREFIX}/task/pin`,
      headers: { ...auth, [TOKEN_HEADER]: token },
      body: { id: task.id, pinned },
    })

  const pinned = await callPin(true)
  assert.equal(pinned.status, 200)
  assert.equal(typeof pinned.body.view.task.pinnedAt, 'number')

  const unpinned = await callPin(false)
  assert.equal(unpinned.status, 200)
  assert.equal(unpinned.body.view.task.pinnedAt, undefined)

  const denied = await callRoute(findRoute(harness.routes, `${PREFIX}/task/pin`).handler, {
    method: 'POST',
    url: `${PREFIX}/task/pin`,
    headers: auth,
    body: { id: task.id, pinned: true },
  })
  assert.equal(denied.status, 403)
})
