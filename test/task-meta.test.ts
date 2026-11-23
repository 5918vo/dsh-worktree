import test from 'node:test'
import assert from 'node:assert/strict'
import {
  NOTES_MAX_LENGTH,
  TAG_LIMIT,
  TAG_MAX_LENGTH,
  compareTaskOrder,
  normalizePriority,
  normalizeTags,
  parseTagText,
  priorityRank,
  validateTags,
} from '../src/task-meta.js'

test('parseTagText splits on both comma styles and trims blanks', () => {
  assert.deepEqual(parseTagText('ui, api，docs'), ['ui', 'api', 'docs'])
  assert.deepEqual(parseTagText('  a ,, b ,  '), ['a', 'b'])
  assert.deepEqual(parseTagText(''), [])
  assert.deepEqual(parseTagText(' , ， '), [])
})

test('parseTagText strips leading # and collapses inner whitespace', () => {
  assert.deepEqual(parseTagText('#ui, ##api'), ['ui', 'api'])
  assert.deepEqual(parseTagText('needs   review'), ['needs review'])
})

test('parseTagText dedupes case-insensitively but keeps the first spelling', () => {
  assert.deepEqual(parseTagText('UI, ui, Ui'), ['UI'])
  assert.deepEqual(parseTagText('bug, Bug, BUG, feature'), ['bug', 'feature'])
})

test('normalizeTags accepts arrays and single strings, rejects junk', () => {
  assert.deepEqual(normalizeTags(['ui', 'api']), ['ui', 'api'])
  assert.deepEqual(normalizeTags(['ui', 'UI', 'docs']), ['ui', 'docs'])
  assert.deepEqual(normalizeTags('ui, api'), ['ui', 'api'])
  assert.deepEqual(normalizeTags(undefined), [])
  assert.deepEqual(normalizeTags(null), [])
  assert.deepEqual(normalizeTags(42), [])
  assert.deepEqual(normalizeTags({ a: 1 }), [])
  assert.deepEqual(normalizeTags(['', '  ', '#']), [])
})

test('validateTags accepts the 8/24 boundaries and rejects one past them', () => {
  const eight = Array.from({ length: TAG_LIMIT }, (_, i) => 'tag' + i)
  assert.deepEqual(validateTags([]), { ok: true })
  assert.deepEqual(validateTags(eight), { ok: true })
  assert.deepEqual(validateTags([...eight, 'extra']), { ok: false, error: 'too-many' })
  const longest = 'x'.repeat(TAG_MAX_LENGTH)
  assert.deepEqual(validateTags([longest]), { ok: true })
  assert.deepEqual(validateTags([longest + 'x']), { ok: false, error: 'too-long' })
})

test('normalizePriority canonicalizes the value and rejects unknown input', () => {
  assert.equal(normalizePriority(undefined), 'normal')
  assert.equal(normalizePriority(null), 'normal')
  assert.equal(normalizePriority(''), 'normal')
  assert.equal(normalizePriority(' NORMAL '), 'normal')
  assert.equal(normalizePriority('high'), 'high')
  assert.equal(normalizePriority('LOW'), 'low')
  assert.equal(normalizePriority('urgent'), undefined)
})

test('priorityRank orders high over normal over low', () => {
  assert.equal(priorityRank({ priority: 'high' }), 2)
  assert.equal(priorityRank({}), 1)
  assert.equal(priorityRank({ priority: 'normal' }), 1)
  assert.equal(priorityRank({ priority: 'low' }), 0)
})

test('compareTaskOrder sorts pinned, then priority, then newest', () => {
  const t = (id: string, extra: Record<string, any> = {}) => ({ id, createdAt: 100, ...extra })

  // Priority first when nothing is pinned.
  const high = t('high', { priority: 'high' })
  const normal = t('normal')
  const low = t('low', { priority: 'low' })
  assert.deepEqual([low, normal, high].sort(compareTaskOrder).map((x) => x.id), ['high', 'normal', 'low'])

  // Pinning outranks priority.
  const pinnedLow = t('pinned-low', { priority: 'low', pinnedAt: 1 })
  assert.deepEqual([high, pinnedLow].sort(compareTaskOrder).map((x) => x.id), ['pinned-low', 'high'])

  // Same rank: newer createdAt first.
  const newer = t('newer', { createdAt: 200 })
  const older = t('older', { createdAt: 50 })
  assert.deepEqual([older, newer].sort(compareTaskOrder).map((x) => x.id), ['newer', 'older'])
})

test('NOTES_MAX_LENGTH is 2000 characters', () => {
  assert.equal(NOTES_MAX_LENGTH, 2000)
})
