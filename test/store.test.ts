import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Store } from '../src/store.js'
import { Project, WorktreeTask } from '../src/models.js'
import { rmrf } from './helpers/git.js'

function project(id: string, repoPath: string): Project {
  return { id, name: 'p-' + id, repoPath, baseBranch: 'main', createdAt: 1 }
}

function task(id: string, projectId: string, createdAt = 1): WorktreeTask {
  return {
    id,
    projectId,
    title: 't-' + id,
    description: 'd',
    repoPath: 'C:/repo',
    baseBranch: 'main',
    branch: 'b-' + id,
    worktreePath: 'C:/repo/.dsh-worktrees/' + id,
    sessionId: null,
    firstPrompt: '',
    startOnBind: true,
    createdAt,
    updatedAt: createdAt,
  }
}

function pendingOp(taskId: string): any {
  return {
    operationId: 'op-' + taskId,
    kind: 'merge',
    taskId,
    repoIdentity: 'C:/repo',
    step: 'switch',
    originalRef: { branch: 'main', sha: null },
    expectedTip: null,
    expectedBase: null,
    recoveryStatus: 'pending',
    startedAt: 1,
  }
}

async function freshStore(): Promise<{ store: Store; dir: string }> {
  const dir = await fs.mkdtemp(join(tmpdir(), 'dshw-store-'))
  const store = new Store(dir)
  await store.load()
  return { store, dir }
}

async function cleanup(store: Store, dir: string): Promise<void> {
  store.dispose()
  await store.flush()
  // dispose() also kicks off a fire-and-forget flush; give it time to finish.
  await new Promise((resolve) => setTimeout(resolve, 100))
  await rmrf(dir)
}

test('store keeps projects and tasks in memory with expected ordering', async () => {
  const { store, dir } = await freshStore()
  try {
    store.putProject(project('a', 'C:/repo/a'))
    store.putProject(project('b', 'C:/repo/b'))
    assert.deepEqual(store.listProjects().map((p) => p.id), ['a', 'b'])

    store.putTask(task('t1', 'a', 1))
    store.putTask(task('t2', 'a', 2))
    store.putTask(task('t3', 'b', 3))
    // listTasks is newest-first
    assert.deepEqual(store.listTasks().map((t) => t.id), ['t3', 't2', 't1'])
    assert.deepEqual(store.listTasksOfProject('a').map((t) => t.id), ['t2', 't1'])
    assert.equal(store.getTask('t1')!.title, 't-t1')
    assert.equal(store.getProject('a')!.repoPath, 'C:/repo/a')

    assert.equal(store.deleteTask('t1'), true)
    assert.equal(store.deleteTask('missing'), false)
    assert.equal(store.deleteProject('a'), true)
    assert.equal(store.deleteProject('a'), false)
    assert.equal(store.getTask('t1'), undefined)
  } finally {
    await cleanup(store, dir)
  }
})

test('store persists tasks/projects to disk and reloads them', async () => {
  const { store, dir } = await freshStore()
  try {
    store.putProject(project('p', 'C:/repo/p'))
    store.putTask(task('t', 'p', 10))
    await store.flush()
  } finally {
    store.dispose()
    await store.flush()
  }
  try {
    const reloaded = new Store(dir)
    await reloaded.load()
    assert.equal(reloaded.getProject('p')!.repoPath, 'C:/repo/p')
    assert.equal(reloaded.getTask('t')!.projectId, 'p')
  } finally {
    // let the disposing store's background flush finish before deleting
    await new Promise((resolve) => setTimeout(resolve, 100))
    await rmrf(dir)
  }
})
test('findProjectByRepo normalizes trailing separators and case', async () => {
  const { store, dir } = await freshStore()
  try {
    store.putProject(project('p', 'C:/Repo/Alpha/'))
    assert.equal(store.findProjectByRepo('c:/repo/alpha')?.id, 'p')
    assert.equal(store.findProjectByRepo('C:/Repo/Alpha//')?.id, 'p')
    assert.equal(store.findProjectByRepo('C:/other'), undefined)
  } finally {
    await cleanup(store, dir)
  }
})

test('recents dedupe, cap at ten and clear', async () => {
  const { store, dir } = await freshStore()
  try {
    store.addRecent('C:/a')
    store.addRecent('C:/b')
    store.addRecent('C:/a')
    assert.deepEqual(store.listRecents(), ['C:/a', 'C:/b'])
    for (let i = 0; i < 15; i += 1) store.addRecent('C:/d' + i)
    assert.equal(store.listRecents().length, 10)
    assert.equal(store.listRecents()[0], 'C:/d14')
    store.clearRecents()
    assert.deepEqual(store.listRecents(), [])
  } finally {
    await cleanup(store, dir)
  }
})

test('store persists a task parentId across reload', async () => {
  const { store, dir } = await freshStore()
  try {
    const t = task('child', 'p', 1)
    t.parentId = 'parent'
    store.putTask(t)
    await store.flush()
  } finally {
    store.dispose()
    await store.flush()
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  try {
    const reloaded = new Store(dir)
    await reloaded.load()
    assert.equal(reloaded.getTask('child')!.parentId, 'parent')
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 100))
    await rmrf(dir)
  }
})

// F1: dispose/flush must never overwrite the shared ledger with local memory.
test('dispose/flush from one process keeps tasks written by another', async () => {
  const dir = await fs.mkdtemp(join(tmpdir(), 'dshw-store-'))
  const a = new Store(dir)
  const b = new Store(dir)
  await a.load()
  await b.load()
  try {
    b.putTask(task('from-b', 'p'))
    a.dispose()
    let disk = JSON.parse(await fs.readFile(join(dir, 'tasks.json'), 'utf8'))
    assert.ok(disk['from-b'], 'dispose must not drop another process task')

    b.putTask(task('from-b-2', 'p'))
    await a.flush()
    disk = JSON.parse(await fs.readFile(join(dir, 'tasks.json'), 'utf8'))
    assert.ok(disk['from-b'], 'flush must keep the first task')
    assert.ok(disk['from-b-2'], 'flush must keep the second task')
  } finally {
    await rmrf(dir)
  }
})

// F2: refresh must drop keys removed on disk, and a later write must not
// resurrect them (a journal would otherwise make merges permanently pending).
test('a refresh drops fields another process cleared and writes keep them clear', async () => {
  const dir = await fs.mkdtemp(join(tmpdir(), 'dshw-store-'))
  const a = new Store(dir)
  const b = new Store(dir)
  await a.load()
  await b.load()
  try {
    const first = task('shared', 'p')
    ;(first as any).pendingOp = pendingOp('shared')
    a.putTask(first)
    assert.ok(a.getTask('shared')!.pendingOp, 'A caches the journal')

    const seenByB = b.getTask('shared')!
    seenByB.pendingOp = undefined
    b.putTask(seenByB)

    assert.equal(a.getTask('shared')!.pendingOp, undefined, 'A must see the cleared journal')
    const seenByA = a.getTask('shared')!
    seenByA.title = 'renamed'
    a.putTask(seenByA)

    const disk = JSON.parse(await fs.readFile(join(dir, 'tasks.json'), 'utf8'))
    assert.equal(disk.shared.title, 'renamed')
    assert.equal(disk.shared.pendingOp, undefined, 'a later write must not resurrect the journal')

    const reloaded = new Store(dir)
    await reloaded.load()
    assert.equal(reloaded.getTask('shared')!.pendingOp, undefined)
  } finally {
    await rmrf(dir)
  }
})

// Binding is read-modify-write on a shared file: it must be atomic across
// processes and must never point two tasks at one session (or overwrite a
// binding another process just made).
test('bindSession is atomic across store instances and refuses duplicate bindings', async () => {
  const dir = await fs.mkdtemp(join(tmpdir(), 'dshw-store-'))
  const a = new Store(dir)
  const b = new Store(dir)
  await a.load()
  await b.load()
  try {
    a.putTask(task('t1', 'p'))
    a.putTask(task('t2', 'p'))
    // Snapshot before the binding: a later stale write must not clear it.
    const stale = { ...a.getTask('t1')! }

    assert.equal(b.bindSession('t1', 's1').ok, true)
    assert.equal(a.getTask('t1')!.sessionId, 's1')
    assert.equal(a.getTask('t1')!.startOnBind, false)
    stale.title = 'renamed'
    a.putTask(stale as any)
    assert.equal(a.getTask('t1')!.sessionId, 's1', 'a stale snapshot must not clear the binding')
    assert.equal(a.getTask('t1')!.startOnBind, false, 'a stale snapshot must not reopen start-on-bind')
    assert.equal(a.getTask('t1')!.title, 'renamed')

    const taken = b.bindSession('t2', 's1')
    assert.equal(taken.ok, false)
    assert.equal((taken as any).conflict, 'session-taken')
    assert.equal((taken as any).other.id, 't1')

    const rebound = b.bindSession('t1', 's2')
    assert.equal(rebound.ok, false)
    assert.equal((rebound as any).conflict, 'task-bound')
    assert.equal(a.getTask('t1')!.sessionId, 's1', 'the first binding must win')

    assert.equal(b.bindSession('t1', 's1').ok, true, 'binding the same pair is idempotent')

    // Deleting the conversation unbinds atomically, freeing the session for a
    // later task; the old task stays unbound (no resurrection).
    assert.equal(b.unbindSession('s1')?.id, 't1')
    assert.equal(a.getTask('t1')!.sessionId, null)
    assert.equal(a.getTask('t1')!.startOnBind, false)
    assert.equal(b.bindSession('t2', 's1').ok, true)
    assert.equal(a.getTask('t2')!.sessionId, 's1')

    const missing = b.bindSession('missing', 's9')
    assert.equal(missing.ok, false)
    assert.equal((missing as any).conflict, 'missing')
  } finally {
    a.dispose()
    b.dispose()
    await a.flush()
    await b.flush()
    await rmrf(dir)
  }
})
