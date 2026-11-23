import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DUE_SOON_DAYS,
  NOTES_MAX_LENGTH,
  TAG_LIMIT,
  TAG_MAX_LENGTH,
  TASK_ESTIMATES,
  compareTaskOrder,
  dueDayOffset,
  dueInputValue,
  dueStateOf,
  normalizePriority,
  normalizeTags,
  parseDueAt,
  parseEstimate,
  parseTagText,
  priorityRank,
  startOfLocalDay,
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

test('parseDueAt clears on empty input and normalizes numbers to local midnight', () => {
  assert.deepEqual(parseDueAt(null), { ok: true, value: null })
  assert.deepEqual(parseDueAt(undefined), { ok: true, value: null })
  assert.deepEqual(parseDueAt(''), { ok: true, value: null })
  assert.deepEqual(parseDueAt('   '), { ok: true, value: null })

  const noon = new Date(2026, 4, 17, 12, 34, 56).getTime()
  assert.deepEqual(parseDueAt(noon), { ok: true, value: new Date(2026, 4, 17).getTime() })
  assert.deepEqual(parseDueAt('2026-05-17'), { ok: true, value: new Date(2026, 4, 17).getTime() })
  assert.deepEqual(parseDueAt('2026-1-3'), { ok: true, value: new Date(2026, 0, 3).getTime() })
})

test('parseDueAt rejects impossible calendar dates instead of rolling them over', () => {
  assert.deepEqual(parseDueAt('2026-02-30'), { ok: false })
  assert.deepEqual(parseDueAt('2026-13-01'), { ok: false })
  assert.deepEqual(parseDueAt('2026-00-10'), { ok: false })
  assert.deepEqual(parseDueAt('not a date'), { ok: false })
  assert.deepEqual(parseDueAt(0), { ok: false })
  assert.deepEqual(parseDueAt(-1), { ok: false })
  assert.deepEqual(parseDueAt(Number.NaN), { ok: false })
  assert.deepEqual(parseDueAt(Number.POSITIVE_INFINITY), { ok: false })
})

test('startOfLocalDay floors a timestamp to local midnight', () => {
  const late = new Date(2026, 11, 31, 23, 59, 59, 999).getTime()
  assert.equal(startOfLocalDay(late), new Date(2026, 11, 31).getTime())
  assert.equal(startOfLocalDay(Number.NaN), 0)
})

test('dueDayOffset counts whole calendar days across months, years and DST', () => {
  const at = (y: number, m: number, d: number, h = 0) => new Date(y, m, d, h).getTime()
  assert.equal(dueDayOffset(at(2026, 0, 10), at(2026, 0, 10, 23)), 0)
  assert.equal(dueDayOffset(at(2026, 1, 2), at(2026, 0, 30)), 3)
  assert.equal(dueDayOffset(at(2026, 0, 1), at(2025, 11, 31)), 1)
  assert.equal(dueDayOffset(at(2025, 11, 31), at(2026, 0, 1)), -1)
  // A 40-day span must equal 40 whatever the offset transitions inside it.
  assert.equal(dueDayOffset(at(2026, 2, 1), at(2026, 0, 20)), 40)
  assert.equal(dueDayOffset(null, at(2026, 0, 1)), null)
  assert.equal(dueDayOffset(undefined, at(2026, 0, 1)), null)
  assert.equal(dueDayOffset(0, at(2026, 0, 1)), null)
})

test('dueStateOf buckets overdue, today, soon and later', () => {
  const now = new Date(2026, 2, 10, 15).getTime()
  const day = (d: number) => new Date(2026, 2, d).getTime()
  assert.deepEqual(dueStateOf(day(7), now), { kind: 'overdue', days: 3 })
  assert.deepEqual(dueStateOf(day(10), now), { kind: 'today', days: 0 })
  assert.deepEqual(dueStateOf(day(11), now), { kind: 'soon', days: 1 })
  assert.deepEqual(dueStateOf(day(10 + DUE_SOON_DAYS), now), { kind: 'soon', days: DUE_SOON_DAYS })
  assert.deepEqual(dueStateOf(day(11 + DUE_SOON_DAYS), now), { kind: 'later', days: 0 })
  assert.equal(dueStateOf(null, now), null)
  assert.equal(dueStateOf(0, now), null)
})

test('dueInputValue formats a zero-padded local date and ignores invalid input', () => {
  assert.equal(dueInputValue(new Date(2026, 0, 5).getTime()), '2026-01-05')
  assert.equal(dueInputValue(new Date(2026, 11, 31).getTime()), '2026-12-31')
  assert.equal(dueInputValue(null), '')
  assert.equal(dueInputValue(0), '')
  assert.equal(dueInputValue(Number.NaN), '')
})

test('a due date never changes the task order', () => {
  const a = { id: 'a', createdAt: 100, dueAt: new Date(2020, 0, 1).getTime() }
  const b = { id: 'b', createdAt: 200 }
  assert.deepEqual([b, a].sort(compareTaskOrder).map((t) => t.id), ['b', 'a'])
})

test('TASK_ESTIMATES lists the allowed point sizes in ascending order', () => {
  assert.deepEqual([...TASK_ESTIMATES], [1, 2, 3, 5, 8])
})

test('parseEstimate accepts every allowed size as a number or a numeric string', () => {
  for (const points of TASK_ESTIMATES) {
    assert.deepEqual(parseEstimate(points), { ok: true, value: points })
    assert.deepEqual(parseEstimate(String(points)), { ok: true, value: points })
  }
  assert.deepEqual(parseEstimate(' 3 '), { ok: true, value: 3 }, 'surrounding whitespace is harmless')
  assert.deepEqual(parseEstimate('3.0'), { ok: true, value: 3 }, 'a whole number written with a decimal still counts')
})

test('parseEstimate reads null, undefined and a blank string as unestimated', () => {
  assert.deepEqual(parseEstimate(null), { ok: true, value: null })
  assert.deepEqual(parseEstimate(undefined), { ok: true, value: null })
  assert.deepEqual(parseEstimate(''), { ok: true, value: null })
  assert.deepEqual(parseEstimate('   '), { ok: true, value: null })
})

test('parseEstimate rejects everything outside 1/2/3/5/8 instead of coercing it', () => {
  const bad: unknown[] = [0, -1, 4, 6, 3.5, '0', '4', '3.5', '-2', 'abc', true, false, {}, [], Number.NaN, Number.POSITIVE_INFINITY]
  for (const value of bad) assert.deepEqual(parseEstimate(value), { ok: false }, JSON.stringify(value))
})
