import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeCriteria, parseCriteriaText } from '../src/criteria'

test('normalizeCriteria trims, drops blanks and dedupes', () => {
  assert.deepEqual(normalizeCriteria(['  a  ', '', 'b', 'a', '   ']), ['a', 'b'])
})

test('normalizeCriteria accepts a multiline string', () => {
  assert.deepEqual(normalizeCriteria('one\r\n\ntwo\none'), ['one', 'two'])
})

test('normalizeCriteria ignores non-string values and non-array input', () => {
  assert.deepEqual(normalizeCriteria([1 as any, null as any, 'ok']), ['ok'])
  assert.deepEqual(normalizeCriteria(undefined), [])
  assert.deepEqual(normalizeCriteria(null), [])
})

test('parseCriteriaText splits lines and trims', () => {
  assert.deepEqual(parseCriteriaText('  first  \n\nsecond\n'), ['first', 'second'])
  assert.deepEqual(parseCriteriaText('   \n \n'), [])
})
