import test from 'node:test'
import assert from 'node:assert/strict'
import {
  QUICK_PROMPTS,
  quickPromptDisabledReason,
  quickPromptReasonKey,
  quickPromptText,
} from '../src/client/quick-prompts.js'

test('quick prompts expose four stable chips in a fixed order', () => {
  assert.deepEqual(QUICK_PROMPTS.map((p) => p.key), ['continue', 'tests', 'summary', 'commit'])
  assert.deepEqual(QUICK_PROMPTS.map((p) => p.label), [
    'quickPromptContinue',
    'quickPromptTests',
    'quickPromptSummary',
    'quickPromptCommit',
  ])
})

test('continue inserts the task title, other prompts are task-independent', () => {
  assert.match(quickPromptText('continue', { title: '修复登录' }), /「修复登录」/)
  assert.equal(quickPromptText('continue', { title: '' }).includes('「」'), true)
  for (const key of ['tests', 'summary', 'commit'] as const) {
    const text = quickPromptText(key, { title: 'x' })
    assert.equal(text.includes('x'), false)
    assert.equal(text.length > 10, true)
  }
  assert.equal(quickPromptText('nope' as any, { title: 'x' }), '')
})

test('sending is blocked without a session, while waiting, or while busy', () => {
  assert.equal(quickPromptDisabledReason({ hasSession: false }), 'no-session')
  assert.equal(quickPromptDisabledReason({ hasSession: true, pendingKind: 'approval' }), 'pending')
  assert.equal(quickPromptDisabledReason({ hasSession: true, pendingKind: 'question' }), 'pending')
  assert.equal(quickPromptDisabledReason({ hasSession: true, busy: true }), 'busy')
  // A running-but-not-waiting session is allowed: the host queues the prompt.
  assert.equal(quickPromptDisabledReason({ hasSession: true }), '')
})

test('block reasons map to locale keys and idle has none', () => {
  assert.equal(quickPromptReasonKey('no-session'), 'quickPromptNoSession')
  assert.equal(quickPromptReasonKey('pending'), 'quickPromptPending')
  assert.equal(quickPromptReasonKey('busy'), 'quickPromptBusy')
  assert.equal(quickPromptReasonKey(''), '')
})
