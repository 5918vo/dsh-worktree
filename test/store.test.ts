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

test('updateTaskMeta touches only the fields the patch actually carries', async () => {
  const { store, dir } = await freshStore()
  try {
    store.putTask(task('m1', 'p1'))
    const seeded = store.updateTaskMeta('m1', { tags: ['ui', 'api'], priority: 'high', notes: 'first' })
    assert.equal(seeded.ok, true)

    const notesOnly = store.updateTaskMeta('m1', { notes: 'second' })
    assert.equal(notesOnly.ok, true)
    if (!notesOnly.ok) return
    assert.deepEqual(notesOnly.task.tags, ['ui', 'api'], 'a notes-only patch must not clear tags')
    assert.equal(notesOnly.task.priority, 'high')
    assert.equal(notesOnly.task.notes, 'second')

    const tagsOnly = store.updateTaskMeta('m1', { tags: ['docs'] })
    assert.equal(tagsOnly.ok, true)
    if (!tagsOnly.ok) return
    assert.deepEqual(tagsOnly.task.tags, ['docs'])
    assert.equal(tagsOnly.task.priority, 'high', 'a tags-only patch must not clear priority')
    assert.equal(tagsOnly.task.notes, 'second')
  } finally {
    await cleanup(store, dir)
  }
})

test('updateTaskMeta treats an explicit undefined as not provided', async () => {
  const { store, dir } = await freshStore()
  try {
    store.putTask(task('m2', 'p1'))
    store.updateTaskMeta('m2', { tags: ['ui'], priority: 'low', notes: 'n' })
    // The HTTP layer can forward all three keys even when the client sent one;
    // undefined must read as "leave it alone", not as "clear it".
    const res = store.updateTaskMeta('m2', { tags: undefined, priority: undefined, notes: 'changed' })
    assert.equal(res.ok, true)
    if (!res.ok) return
    assert.deepEqual(res.task.tags, ['ui'])
    assert.equal(res.task.priority, 'low')
    assert.equal(res.task.notes, 'changed')
  } finally {
    await cleanup(store, dir)
  }
})

test('updateTaskMeta clears tags, priority and notes only on explicit empty values', async () => {
  const { store, dir } = await freshStore()
  try {
    store.putTask(task('m3', 'p1'))
    store.updateTaskMeta('m3', { tags: ['ui'], priority: 'high', notes: 'n' })

    const cleared = store.updateTaskMeta('m3', { tags: [], priority: 'normal', notes: '' })
    assert.equal(cleared.ok, true)
    if (!cleared.ok) return
    assert.equal('tags' in cleared.task, false)
    assert.equal('priority' in cleared.task, false)
    assert.equal('notes' in cleared.task, false)

    const reloaded = new Store(dir)
    await reloaded.load()
    const row = reloaded.getTask('m3')!
    assert.equal('tags' in row, false)
    assert.equal('priority' in row, false)
    assert.equal('notes' in row, false)
    reloaded.dispose()
    await reloaded.flush()
  } finally {
    await cleanup(store, dir)
  }
})

test('updateTaskMeta validates tags, priority and notes', async () => {
  const { store, dir } = await freshStore()
  try {
    store.putTask(task('m4', 'p1'))
    assert.deepEqual(store.updateTaskMeta('missing', { notes: 'n' }), { ok: false, reason: 'missing' })
    assert.deepEqual(store.updateTaskMeta('m4', { priority: 'urgent' }), { ok: false, reason: 'priority-invalid' })
    assert.deepEqual(
      store.updateTaskMeta('m4', { tags: Array.from({ length: 9 }, (_, i) => 't' + i) }),
      { ok: false, reason: 'tags-too-many' },
    )
    assert.deepEqual(store.updateTaskMeta('m4', { tags: ['x'.repeat(25)] }), { ok: false, reason: 'tags-too-long' })
    assert.deepEqual(store.updateTaskMeta('m4', { notes: 'x'.repeat(2001) }), { ok: false, reason: 'notes-too-long' })
    // A rejected patch must not half-apply.
    assert.equal('tags' in store.getTask('m4')!, false)
    assert.equal('notes' in store.getTask('m4')!, false)
  } finally {
    await cleanup(store, dir)
  }
})

test('updateTaskMeta writes are visible to another store instance', async () => {
  const dir = await fs.mkdtemp(join(tmpdir(), 'dshw-store-'))
  const a = new Store(dir)
  const b = new Store(dir)
  await a.load()
  await b.load()
  try {
    a.putTask(task('m5', 'p1'))
    b.refreshTasks()
    assert.equal(b.updateTaskMeta('m5', { notes: 'from-b' }).ok, true)
    a.refreshTasks()
    assert.equal(a.getTask('m5')!.notes, 'from-b')
  } finally {
    a.dispose()
    b.dispose()
    await a.flush()
    await b.flush()
    await rmrf(dir)
  }
})

test('updateTaskMeta stores dependencies and clears them only on an explicit empty list', async () => {
  const { store, dir } = await freshStore()
  try {
    store.putTask(task('d1', 'p1'))
    store.putTask(task('d2', 'p1'))
    store.putTask(task('d3', 'p1'))

    const set = store.updateTaskMeta('d1', { dependsOn: ['d2', 'd3', 'd2'] })
    assert.equal(set.ok, true)
    if (!set.ok) return
    assert.deepEqual(set.task.dependsOn, ['d2', 'd3'], 'duplicates are dropped')

    // A patch for another field keeps the dependency list intact.
    const notesOnly = store.updateTaskMeta('d1', { notes: 'n' })
    assert.equal(notesOnly.ok, true)
    if (!notesOnly.ok) return
    assert.deepEqual(notesOnly.task.dependsOn, ['d2', 'd3'])

    const cleared = store.updateTaskMeta('d1', { dependsOn: [] })
    assert.equal(cleared.ok, true)
    if (!cleared.ok) return
    assert.equal('dependsOn' in cleared.task, false, 'an empty list removes the field')

    const reloaded = new Store(dir)
    await reloaded.load()
    assert.equal('dependsOn' in reloaded.getTask('d1')!, false)
    reloaded.dispose()
    await reloaded.flush()
  } finally {
    await cleanup(store, dir)
  }
})

test('updateTaskMeta rejects invalid dependency edits without touching the record', async () => {
  const { store, dir } = await freshStore()
  try {
    store.putTask(task('d4', 'p1'))
    store.putTask(task('d5', 'p1'))
    store.putTask({ ...task('d6', 'p2'), projectId: 'p2' })
    store.updateTaskMeta('d4', { dependsOn: ['d5'] })

    assert.deepEqual(
      store.updateTaskMeta('d4', { dependsOn: ['d4'] }),
      { ok: false, reason: 'deps-self' },
    )
    assert.deepEqual(
      store.updateTaskMeta('d4', { dependsOn: ['nope'] }),
      { ok: false, reason: 'deps-missing' },
    )
    assert.deepEqual(
      store.updateTaskMeta('d4', { dependsOn: ['d6'] }),
      { ok: false, reason: 'deps-cross-project' },
    )
    assert.deepEqual(
      store.updateTaskMeta('d4', { dependsOn: Array.from({ length: 9 }, (_, i) => 'm' + i) }),
      { ok: false, reason: 'deps-too-many' },
      'the limit is checked before existence',
    )
    // d5 -> d4 would close a cycle once d4 already depends on d5.
    assert.deepEqual(
      store.updateTaskMeta('d5', { dependsOn: ['d4'] }),
      { ok: false, reason: 'deps-cycle' },
    )
    assert.deepEqual(store.getTask('d4')!.dependsOn, ['d5'], 'a rejected edit leaves the list alone')
    assert.equal('dependsOn' in store.getTask('d5')!, false)
  } finally {
    await cleanup(store, dir)
  }
})

test('two store instances can edit dependencies and notes without clobbering each other', async () => {
  const dir = await fs.mkdtemp(join(tmpdir(), 'dshw-store-'))
  const a = new Store(dir)
  const b = new Store(dir)
  await a.load()
  await b.load()
  try {
    a.putTask(task('d7', 'p1'))
    a.putTask(task('d8', 'p1'))
    b.refreshTasks()
    assert.equal(b.updateTaskMeta('d7', { dependsOn: ['d8'] }).ok, true)
    a.refreshTasks()
    assert.equal(a.updateTaskMeta('d7', { notes: 'from-a' }).ok, true)
    b.refreshTasks()
    assert.deepEqual(b.getTask('d7')!.dependsOn, ['d8'], 'the notes write must not drop dependencies')
    assert.equal(b.getTask('d7')!.notes, 'from-a')
  } finally {
    a.dispose()
    b.dispose()
    await a.flush()
    await b.flush()
    await rmrf(dir)
  }
})
