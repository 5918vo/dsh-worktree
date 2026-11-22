import test from 'node:test'
import assert from 'node:assert/strict'
import { sameRepoPath, submitBlockedReason } from '../src/client/project-form.js'

const BS = String.fromCharCode(92)
const winPath = `C:${BS}Users${BS}liang${BS}demo`

test('sameRepoPath ignores separators, trailing slashes and case', () => {
  assert.equal(sameRepoPath(winPath, 'c:/users/liang/demo/'), true)
  assert.equal(sameRepoPath('/home/u/demo/', '/home/u/demo'), true)
  assert.equal(sameRepoPath('/home/u/demo', '/home/u/other'), false)
  assert.equal(sameRepoPath('', ''), false)
  assert.equal(sameRepoPath(null, undefined), false)
})

test('submitBlockedReason names the first missing input, loading first', () => {
  const t = { chooseDirFirst: 'dir', loadingBranches: 'loading', chooseBaseFirst: 'base' }
  assert.equal(submitBlockedReason(t, '', '', 'idle'), 'dir')
  assert.equal(submitBlockedReason(t, '/repo', '', 'loading'), 'loading')
  assert.equal(submitBlockedReason(t, '/repo', '', 'success'), 'base')
  assert.equal(submitBlockedReason(t, '/repo', 'main', 'success'), '')
})
