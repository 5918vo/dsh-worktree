import test from 'node:test'
import assert from 'node:assert/strict'
import { hasStructuredFilters, matchesStructuredQuery, parseSearchQuery } from '../src/client/search-query.js'

const empty = { text: '', tags: [], priorities: [], statuses: [], invalid: [] }

test('parseSearchQuery treats empty and non-string input as an empty query', () => {
  for (const raw of [undefined, null, 42, true, {}, [], '   ', '']) {
    assert.deepEqual(parseSearchQuery(raw), empty)
  }
  // The returned arrays are fresh, so one caller cannot mutate another's query.
  const first = parseSearchQuery('')
  first.tags.push('leak')
  assert.deepEqual(parseSearchQuery('').tags, [])
})

test('parseSearchQuery keeps plain text, normalized to single spaces', () => {
  assert.deepEqual(parseSearchQuery('  登录   修复  '), { ...empty, text: '登录 修复' })
  // Unknown keys stay plain text and never fail the parser.
  assert.deepEqual(parseSearchQuery('foo:bar'), { ...empty, text: 'foo:bar' })
  assert.deepEqual(parseSearchQuery('登录 foo:bar'), { ...empty, text: '登录 foo:bar' })
})

test('parseSearchQuery reads one and many tags with AND semantics', () => {
  assert.deepEqual(parseSearchQuery('tag:前端').tags, ['前端'])
  // Key is case-insensitive and the tag is stored lowercased for comparison.
  assert.deepEqual(parseSearchQuery('TAG:UI Tags:前端').tags, ['ui', '前端'])
  assert.deepEqual(parseSearchQuery('tag:前端 tag:紧急').tags, ['前端', '紧急'])
  // A leading # is stripped and repeated tokens collapse.
  assert.deepEqual(parseSearchQuery('tag:#前端 tag:前端').tags, ['前端'])
  // Multi-word tags need quotes; an unclosed quote keeps the rest.
  assert.deepEqual(parseSearchQuery('tag:"需要 设计"').tags, ['需要 设计'])
  assert.deepEqual(parseSearchQuery('tag:"需要 设计').tags, ['需要 设计'])
  // An empty tag is not a condition and leaves nothing behind.
  assert.deepEqual(parseSearchQuery('tag:'), empty)
})

test('parseSearchQuery accepts valid priorities and statuses, marking invalid values', () => {
  assert.deepEqual(parseSearchQuery('priority:high').priorities, ['high'])
  assert.deepEqual(parseSearchQuery('PRIO:low').priorities, ['low'])
  assert.deepEqual(parseSearchQuery('priority:high priority:low priority:high').priorities, ['high', 'low'])
  assert.deepEqual(parseSearchQuery('status:review status:MERGED').statuses, ['review', 'merged'])

  // An invalid value is kept whole as plain text and flagged, never thrown.
  assert.deepEqual(parseSearchQuery('priority:urgent'), {
    text: 'priority:urgent', tags: [], priorities: [], statuses: [], invalid: ['priority:urgent'],
  })
  assert.deepEqual(parseSearchQuery('status:done'), {
    text: 'status:done', tags: [], priorities: [], statuses: [], invalid: ['status:done'],
  })
})

test('parseSearchQuery mixes text and structured tokens in one query', () => {
  assert.deepEqual(parseSearchQuery('登录 修复 tag:紧急 priority:high status:review'), {
    text: '登录 修复',
    tags: ['紧急'],
    priorities: ['high'],
    statuses: ['review'],
    invalid: [],
  })
})

test('hasStructuredFilters only reports real conditions', () => {
  assert.equal(hasStructuredFilters(parseSearchQuery('')), false)
  assert.equal(hasStructuredFilters(parseSearchQuery('登录')), false)
  assert.equal(hasStructuredFilters(parseSearchQuery('foo:bar')), false)
  assert.equal(hasStructuredFilters(parseSearchQuery('tag:')), false)
  assert.equal(hasStructuredFilters(parseSearchQuery('priority:urgent')), false)
  assert.equal(hasStructuredFilters(parseSearchQuery('tag:ui')), true)
  assert.equal(hasStructuredFilters(parseSearchQuery('priority:high')), true)
  assert.equal(hasStructuredFilters(parseSearchQuery('status:review')), true)
})

const task = (over: any = {}) => ({ id: 't1', title: 'Alpha', tags: [], priority: 'normal', ...over })
const snap = (status: string) => ({ status })

test('matchesStructuredQuery combines tags with AND', () => {
  const query = parseSearchQuery('tag:ui tag:api')
  assert.equal(matchesStructuredQuery(query, task({ tags: ['UI', 'API'] }), snap('review')), true)
  assert.equal(matchesStructuredQuery(query, task({ tags: ['ui'] }), snap('review')), false)
  assert.equal(matchesStructuredQuery(query, task(), snap('review')), false)
  // A task without a tags array must not throw.
  assert.equal(matchesStructuredQuery(parseSearchQuery('tag:ui'), {}, snap('review')), false)
})

test('matchesStructuredQuery treats priorities as OR with normal as the default', () => {
  const query = parseSearchQuery('priority:high priority:low')
  assert.equal(matchesStructuredQuery(query, task({ priority: 'high' }), snap('review')), true)
  assert.equal(matchesStructuredQuery(query, task({ priority: 'low' }), snap('review')), true)
  assert.equal(matchesStructuredQuery(query, task({ priority: 'normal' }), snap('review')), false)
  assert.equal(matchesStructuredQuery(parseSearchQuery('priority:normal'), task(), snap('review')), true)
})

test('matchesStructuredQuery treats statuses as OR and needs a snapshot', () => {
  const query = parseSearchQuery('status:review status:merged')
  assert.equal(matchesStructuredQuery(query, task(), snap('review')), true)
  assert.equal(matchesStructuredQuery(query, task(), snap('merged')), true)
  assert.equal(matchesStructuredQuery(query, task(), snap('developing')), false)
  assert.equal(matchesStructuredQuery(query, task(), null), false)
  // A status condition is the only thing a missing snapshot breaks: text works.
  assert.equal(matchesStructuredQuery(parseSearchQuery('alpha'), task(), null, ['Alpha']), true)
})

test('matchesStructuredQuery ANDs categories together', () => {
  const query = parseSearchQuery('tag:ui priority:high status:review')
  assert.equal(matchesStructuredQuery(query, task({ tags: ['UI'], priority: 'high' }), snap('review')), true)
  assert.equal(matchesStructuredQuery(query, task({ tags: ['UI'], priority: 'low' }), snap('review')), false)
  assert.equal(matchesStructuredQuery(query, task({ tags: [], priority: 'high' }), snap('review')), false)
  assert.equal(matchesStructuredQuery(query, task({ tags: ['UI'], priority: 'high' }), snap('merged')), false)
})

test('matchesStructuredQuery applies text only through the caller fields', () => {
  assert.equal(matchesStructuredQuery(parseSearchQuery(''), task(), null), true)
  assert.equal(matchesStructuredQuery(parseSearchQuery('登录'), task(), null, ['修复登录']), true)
  assert.equal(matchesStructuredQuery(parseSearchQuery('LOGIN'), task(), null, ['fix login']), true)
  assert.equal(matchesStructuredQuery(parseSearchQuery('登录'), task(), null, ['修复']), false)
  // An invalid token degrades to plain text.
  assert.equal(matchesStructuredQuery(parseSearchQuery('priority:urgent'), task(), null, ['priority:urgent']), true)
  assert.equal(matchesStructuredQuery(parseSearchQuery('priority:urgent'), task({ priority: 'urgent' }), null, ['x']), false)
})
