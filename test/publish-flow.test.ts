import test from 'node:test'
import assert from 'node:assert/strict'
import { findPublishedTask, resolvePublishEntry } from '../src/client/publish-flow.js'

test('resolvePublishEntry: selected -> form, none+projects -> picker, none+no projects -> add', () => {
  assert.equal(resolvePublishEntry({ id: 'p' }, 3), 'form')
  assert.equal(resolvePublishEntry(null, 3), 'picker')
  assert.equal(resolvePublishEntry(null, 0), 'add')
  assert.equal(resolvePublishEntry(undefined, 0), 'add')
})

test('findPublishedTask matches by branch first, then title when no branch', () => {
  const tasks = [
    { id: '1', branch: 'dsh-wt/aaaaaaaa', title: 'A' },
    { id: '2', branch: 'dsh-wt/bbbbbbbb', title: 'B' },
  ]
  assert.equal(findPublishedTask(tasks, { branchName: 'dsh-wt/bbbbbbbb' }).id, '2')
  assert.equal(findPublishedTask(tasks, { title: 'A' }).id, '1')
  assert.equal(findPublishedTask(tasks, { branchName: 'nope', title: 'A' }), null)
  assert.equal(findPublishedTask([], { branchName: 'x' }), null)
})
