import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeCommitMessage } from '../src/gitx/merge.js'

test('mergeCommitMessage names the task instead of only the sha', () => {
  assert.equal(mergeCommitMessage({ id: '10080667-aaaa-bbbb', title: '整理 README 说明' }), 'Merge task 10080667: 整理 README 说明')
  assert.equal(mergeCommitMessage({ id: 'abcdefgh123', title: '   ' }), 'Merge task abcdefgh')
  assert.equal(mergeCommitMessage({ id: '', title: 'x' }), 'Merge task unknown: x')
})
