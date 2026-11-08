import test from 'node:test'
import assert from 'node:assert/strict'
import { STATUS_TONE, isReviewable, pendingLabel, resolveStatus, statusMeta } from '../src/client/status.js'

const T = {
  ready: '准备',
  developing: '进行中',
  review: '待验收',
  reviewing: '验收中',
  merged: '已合并',
  cleaned: '已清理',
  broken: '异常',
  pendingApproval: '待审批',
  pendingPlanReview: '待计划确认',
  pendingQuestion: '待回答',
}

test('STATUS_TONE maps lifecycle states to tones', () => {
  assert.deepEqual(STATUS_TONE, {
    ready: 'neutral',
    cleaned: 'neutral',
    developing: 'brand',
    reviewing: 'brand',
    review: 'warn',
    merged: 'success',
    broken: 'error',
  })
})

test('isReviewable: only review states allow the acceptance switch', () => {
  assert.equal(isReviewable('review'), true)
  assert.equal(isReviewable('reviewing'), true)
  // Not-yet-developed tasks must not enter acceptance early.
  assert.equal(isReviewable('developing'), false)
  assert.equal(isReviewable('ready'), false)
  assert.equal(isReviewable('merged'), false)
  assert.equal(isReviewable('cleaned'), false)
  assert.equal(isReviewable('broken'), false)
})

test('pendingLabel resolves each interaction kind', () => {
  assert.equal(pendingLabel(T, 'approval'), '待审批')
  assert.equal(pendingLabel(T, 'plan-review'), '待计划确认')
  assert.equal(pendingLabel(T, 'question'), '待回答')
  assert.equal(pendingLabel(T, null), '')
})

test('statusMeta returns the lifecycle label and tone', () => {
  assert.deepEqual(statusMeta(T, 'review', null), { label: '待验收', tone: 'warn', pending: false, note: '' })
  assert.equal(statusMeta(T, 'broken', null).tone, 'error')
})

test('statusMeta surfaces a pending chip over a non-terminal state', () => {
  const meta = statusMeta(T, 'developing', 'approval')
  assert.equal(meta.label, '待审批')
  assert.equal(meta.tone, 'warn')
  assert.equal(meta.pending, true)
})

test('statusMeta keeps the terminal lifecycle label even when pending', () => {
  const meta = statusMeta(T, 'merged', 'question')
  assert.equal(meta.label, '已合并')
  assert.equal(meta.tone, 'success')
  assert.equal(meta.pending, true)
  assert.equal(meta.note, '待回答')
})

test('resolveStatus keeps review only once the session stopped running', () => {
  assert.equal(resolveStatus('review', true), 'developing')
  assert.equal(resolveStatus('review', false), 'review')
  assert.equal(resolveStatus('review', null), 'review')
  assert.equal(resolveStatus('review', undefined), 'review')
})

test('resolveStatus leaves other lifecycle states untouched while running', () => {
  for (const status of ['ready', 'developing', 'reviewing', 'merged', 'cleaned', 'broken']) {
    assert.equal(resolveStatus(status, true), status)
  }
})
