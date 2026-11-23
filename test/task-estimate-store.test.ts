import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { Store } from '../src/store.js'
import { mkTempDir, rmrf } from './helpers/git.js'

const fakeTask = (id: string) =>
  ({
    id,
    title: id,
    description: '',
    branch: `dsh-wt/${id}`,
    baseBranch: 'main',
    worktreePath: `C:/tmp/${id}`,
    repoPath: 'C:/repo',
    status: 'review',
    createdAt: 1,
    updatedAt: 1,
  }) as any

let store: Store
let stateDir = ''
let root = ''

before(async () => {
  root = await mkTempDir('dshw-estimate-')
  stateDir = join(root, 'state')
  store = new Store(stateDir)
  await store.load()
})

after(async () => {
  store.dispose()
  await new Promise((resolve) => setTimeout(resolve, 100))
  if (root) await rmrf(root)
})

test('updateTaskMeta writes a valid estimate and keeps the other fields', () => {
  store.putTask({ ...fakeTask('e1'), tags: ['ui'], priority: 'high', notes: 'kept' } as any)
  const result = store.updateTaskMeta('e1', { estimate: 5 })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.task.estimate, 5)
  assert.deepEqual(result.task.tags, ['ui'])
  assert.equal(result.task.priority, 'high')
  assert.equal(result.task.notes, 'kept')
})

test('updateTaskMeta accepts numeric strings and rejects invalid values', () => {
  store.putTask(fakeTask('e2'))
  const text = store.updateTaskMeta('e2', { estimate: '8' })
  assert.equal(text.ok, true)
  if (!text.ok) return
  assert.equal(text.task.estimate, 8)

  for (const value of [0, -1, 4, 3.5, true, {}, 'nope']) {
    const rejected = store.updateTaskMeta('e2', { estimate: value })
    assert.equal(rejected.ok, false, JSON.stringify(value))
    if (rejected.ok) return
    assert.equal(rejected.reason, 'estimate-invalid')
    // The stored estimate is untouched by a rejected patch.
    assert.equal(store.getTask('e2')!.estimate, 8)
  }
})

test('updateTaskMeta clears the estimate only when it is explicitly null or empty', () => {
  store.putTask({ ...fakeTask('e3'), estimate: 3 } as any)
  const notesOnly = store.updateTaskMeta('e3', { notes: 'keep it' })
  assert.equal(notesOnly.ok, true)
  if (!notesOnly.ok) return
  assert.equal(notesOnly.task.estimate, 3, 'omitting estimate must not clear it')

  const cleared = store.updateTaskMeta('e3', { estimate: null })
  assert.equal(cleared.ok, true)
  if (!cleared.ok) return
  assert.equal('estimate' in cleared.task, false, 'clearing deletes the field')

  store.updateTaskMeta('e3', { estimate: 2 })
  const blank = store.updateTaskMeta('e3', { estimate: '' })
  assert.equal(blank.ok, true)
  if (!blank.ok) return
  assert.equal('estimate' in blank.task, false)
})

test('the estimate survives a store reload', async () => {
  store.putTask(fakeTask('e4'))
  const result = store.updateTaskMeta('e4', { estimate: 1 })
  assert.equal(result.ok, true)

  const reopened = new Store(stateDir)
  await reopened.load()
  try {
    assert.equal(reopened.getTask('e4')!.estimate, 1)
  } finally {
    reopened.dispose()
  }
})
