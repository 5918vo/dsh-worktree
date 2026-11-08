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
