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
  root = await mkTempDir('dshw-budget-')
  stateDir = join(root, 'state')
  store = new Store(stateDir)
  await store.load()
})

after(async () => {
  store.dispose()
  await new Promise((resolve) => setTimeout(resolve, 100))
  if (root) await rmrf(root)
})

test('updateTaskMeta writes a valid budget and keeps the other fields', () => {
  store.putTask({ ...fakeTask('b1'), tags: ['ui'], priority: 'high', notes: 'kept' } as any)
  const result = store.updateTaskMeta('b1', { workBudgetHours: 4.5 })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.task.workBudgetHours, 4.5)
  assert.deepEqual(result.task.tags, ['ui'])
  assert.equal(result.task.priority, 'high')
  assert.equal(result.task.notes, 'kept')

  const text = store.updateTaskMeta('b1', { workBudgetHours: '0.25' })
  assert.equal(text.ok, true)
  if (!text.ok) return
  assert.equal(text.task.workBudgetHours, 0.25)
})

test('updateTaskMeta rejects an invalid budget and leaves the stored value alone', () => {
  store.putTask(fakeTask('b2'))
  const seeded = store.updateTaskMeta('b2', { workBudgetHours: 8 })
  assert.equal(seeded.ok, true)

  for (const value of [0, -1, 0.249, 1000.01, true, {}, [], 'nope', NaN, Infinity]) {
    const rejected = store.updateTaskMeta('b2', { workBudgetHours: value })
    assert.equal(rejected.ok, false, JSON.stringify(value))
    if (rejected.ok) return
    assert.equal(rejected.reason, 'budget-invalid')
    assert.equal(store.getTask('b2')!.workBudgetHours, 8)
  }
})

test('updateTaskMeta clears the budget only when it is explicitly null or empty', () => {
  store.putTask({ ...fakeTask('b3'), workBudgetHours: 2 } as any)

  const notesOnly = store.updateTaskMeta('b3', { notes: 'keep it' })
  assert.equal(notesOnly.ok, true)
  if (!notesOnly.ok) return
  assert.equal(notesOnly.task.workBudgetHours, 2, 'omitting the field must not clear it')

  const cleared = store.updateTaskMeta('b3', { workBudgetHours: null })
  assert.equal(cleared.ok, true)
  if (!cleared.ok) return
  assert.equal('workBudgetHours' in cleared.task, false, 'clearing deletes the field')

  store.updateTaskMeta('b3', { workBudgetHours: 1.5 })
  const blank = store.updateTaskMeta('b3', { workBudgetHours: '' })
  assert.equal(blank.ok, true)
  if (!blank.ok) return
  assert.equal('workBudgetHours' in blank.task, false)
})

test('the budget survives a store reload', async () => {
  store.putTask(fakeTask('b4'))
  const result = store.updateTaskMeta('b4', { workBudgetHours: 12 })
  assert.equal(result.ok, true)

  const reopened = new Store(stateDir)
  await reopened.load()
  try {
    assert.equal(reopened.getTask('b4')!.workBudgetHours, 12)
  } finally {
    reopened.dispose()
  }
})

test('a legacy record without a budget reads as unbudgeted', () => {
  store.putTask(fakeTask('b5'))
  const task = store.getTask('b5')!
  assert.equal(task.workBudgetHours, undefined)
  const noop = store.updateTaskMeta('b5', {})
  assert.equal(noop.ok, true)
  if (!noop.ok) return
  assert.equal('workBudgetHours' in noop.task, false)
})
