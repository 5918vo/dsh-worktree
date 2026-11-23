import test from 'node:test'
import assert from 'node:assert/strict'
import zh from '../locale/zh.json'
import { attentionSummaryTitle } from '../src/client/attention-summary.js'

const counts = (over: Record<string, number> = {}) => ({
  all: 0,
  pending: 0,
  review: 0,
  broken: 0,
  recovery: 0,
  stalled: 0,
  total: 0,
  ...over,
})

const fill = (template: string, values: Record<string, string>) =>
  Object.keys(values).reduce((text, key) => text.split('{' + key + '}').join(values[key]), template)

test('a stale board reports staleness first', () => {
  const title = attentionSummaryTitle(zh, counts({ broken: 2, stalled: 1 }), true, '09:41')
  assert.equal(title, fill(zh.attentionStale, { time: '09:41' }))
})

test('the title follows the most severe present category', () => {
  const title = (over: Record<string, number>) => attentionSummaryTitle(zh, counts(over), false, '—')
  assert.equal(title({ recovery: 1, broken: 2 }), fill(zh.attentionSummaryRecovery, { n: '1' }))
  assert.equal(title({ broken: 2, pending: 1 }), fill(zh.attentionSummaryBroken, { n: '2' }))
  assert.equal(title({ pending: 3, review: 1 }), fill(zh.attentionSummaryPending, { n: '3' }))
  assert.equal(title({ review: 4 }), fill(zh.attentionSummaryReview, { n: '4' }))
})

test('a board where only stalled tasks remain says they are stalled', () => {
  const title = (over: Record<string, number>) => attentionSummaryTitle(zh, counts(over), false, '—')
  assert.equal(title({ stalled: 2 }), fill(zh.attentionSummaryStalled, { n: '2' }))
  assert.equal(title({ review: 1, stalled: 2 }), fill(zh.attentionSummaryReview, { n: '1' }))
})
