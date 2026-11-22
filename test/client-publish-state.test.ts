import test from 'node:test'
import assert from 'node:assert/strict'
import { branchChoices, findPublishedTask, initialPublishForm, isDetachedBranchLabel, publishDraftDirty } from '../src/client/publish-state.js'

const draft = (extra = {}) => ({
  title: '',
  description: '',
  manualCriteria: '',
  pickedCriteria: [],
  branchName: '',
  ...extra,
})

test('initialPublishForm falls back to the continuation title without a draft', () => {
  const form = initialPublishForm(undefined, 'parent task (continued)')
  assert.equal(form.title, 'parent task (continued)')
  assert.equal(form.description, '')
  assert.deepEqual(form.pickedCriteria, [])
  assert.equal(form.branchName, '')
})

test('initialPublishForm restores every draft field and keeps an explicit empty title', () => {
  const form = initialPublishForm(draft({
    title: '',
    description: 'details',
    manualCriteria: 'manual',
    pickedCriteria: ['a', 'b'],
    branchName: 'feat/x',
  }), 'should not win')
  assert.equal(form.title, '', 'a cleared draft title must not fall back')
  assert.equal(form.description, 'details')
  assert.equal(form.manualCriteria, 'manual')
  assert.deepEqual(form.pickedCriteria, ['a', 'b'])
  assert.equal(form.branchName, 'feat/x')
})

test('initialPublishForm ignores malformed pickedCriteria', () => {
  const form = initialPublishForm({ pickedCriteria: 'a,b' })
  assert.deepEqual(form.pickedCriteria, [])
})

test('publishDraftDirty is false for an unchanged form', () => {
  const form = draft({ title: 't', description: 'd', pickedCriteria: ['a', 'b'], branchName: 'feat/x' })
  assert.equal(publishDraftDirty(form, draft({ title: 't', description: 'd', pickedCriteria: ['b', 'a'], branchName: 'feat/x' })), false)
})

test('publishDraftDirty detects every tracked field', () => {
  const base = draft({ title: 't', description: 'd', manualCriteria: 'm', pickedCriteria: ['a'], branchName: 'b' })
  assert.equal(publishDraftDirty(base, { ...base, title: 't2' }), true)
  assert.equal(publishDraftDirty(base, { ...base, description: 'd2' }), true)
  assert.equal(publishDraftDirty(base, { ...base, manualCriteria: 'm2' }), true)
  assert.equal(publishDraftDirty(base, { ...base, pickedCriteria: ['a', 'b'] }), true)
  assert.equal(publishDraftDirty(base, { ...base, branchName: 'b2' }), true)
  assert.equal(publishDraftDirty(base, { ...base, pickedCriteria: [] }), true)
})

const task = (id, extra = {}) => ({ id, branch: 'dsh-wt/' + id, title: 'task ' + id, ...extra })

test('findPublishedTask prefers an exact branch match over a title match', () => {
  const list = [task('a', { title: 'same', branch: 'other' }), task('b', { title: 'different', branch: 'feat/x' })]
  const found = findPublishedTask(list, { projectId: 'p1', branchName: 'feat/x', title: 'same' })
  assert.equal(found && found.id, 'b')
})

test('findPublishedTask matches by title when no branch was supplied', () => {
  const list = [task('a'), task('b', { title: 'unique title' })]
  const found = findPublishedTask(list, { projectId: 'p1', branchName: '', title: 'unique title' })
  assert.equal(found && found.id, 'b')
})

test('findPublishedTask falls back to the title when the branch is not in the list', () => {
  const list = [task('a', { title: 'unique title' })]
  const found = findPublishedTask(list, { branchName: 'missing', title: 'unique title' })
  assert.equal(found && found.id, 'a')
})

test('findPublishedTask returns null when nothing matches', () => {
  assert.equal(findPublishedTask([task('a')], { branchName: 'nope', title: 'nope' }), null)
})

test('findPublishedTask returns null for empty or malformed input', () => {
  assert.equal(findPublishedTask([], { branchName: 'x', title: 'y' }), null)
  assert.equal(findPublishedTask(null, { branchName: 'x' }), null)
  assert.equal(findPublishedTask(undefined, null), null)
  assert.equal(findPublishedTask([task('a')], {}), null)
})

test('branchChoices keeps trunks and the base, hides task branches', () => {
  const list = ['main', 'master', 'develop', 'feature/login', 'dsh-wt/ab12cd34', '(HEAD detached at 1a2b3c4)']
  const primary = branchChoices(list, 'develop')
  assert.deepEqual(primary.primary, ['main', 'master', 'develop'])
  assert.deepEqual(primary.rest, ['feature/login', 'dsh-wt/ab12cd34'])
  // A missing base still gets a slot so the select cannot silently retarget.
  const missing = branchChoices(['main', 'dsh-wt/ab12cd34'], 'release/1.0')
  assert.ok(missing.primary.includes('release/1.0'))
  assert.deepEqual(branchChoices(null, ''), { primary: [], rest: [] })
})

test('isDetachedBranchLabel recognises git pseudo entries only', () => {
  assert.equal(isDetachedBranchLabel('(HEAD detached at 1a2b3c4)'), true)
  assert.equal(isDetachedBranchLabel('main'), false)
  assert.equal(isDetachedBranchLabel(''), false)
})
