import test from 'node:test'
import assert from 'node:assert/strict'
import { filterBranches } from '../src/client/branch-filter'

const list = [
  { name: 'main', current: true },
  { name: 'develop' },
  { name: 'feature/login' },
  { name: 'Feature/PAY' },
  { name: 'release/1.0' },
]

test('filterBranches returns every branch for a blank query', () => {
  assert.equal(filterBranches(list, '').length, 5)
  assert.equal(filterBranches(list, '   ').length, 5)
})

test('filterBranches matches a case-insensitive substring of the name', () => {
  assert.deepEqual(filterBranches(list, 'FEAT').map((b) => b.name), ['feature/login', 'Feature/PAY'])
  assert.deepEqual(filterBranches(list, 'main').map((b) => b.name), ['main'])
})

test('filterBranches trims whitespace and returns an empty list when nothing matches', () => {
  assert.deepEqual(filterBranches(list, '  login ').map((b) => b.name), ['feature/login'])
  assert.equal(filterBranches(list, 'nope').length, 0)
})

test('filterBranches tolerates missing or malformed input', () => {
  assert.deepEqual(filterBranches(null, 'x'), [])
  assert.deepEqual(filterBranches(undefined, 'x'), [])
  assert.deepEqual(
    filterBranches([{ name: 'alpha' }, null as any, { name: '' }], 'a').map((b) => b.name),
    ['alpha'],
  )
})
