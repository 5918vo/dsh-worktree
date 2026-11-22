import test from 'node:test'
import assert from 'node:assert/strict'
import { environmentWarnings } from '../src/client/environment.js'

test('environmentWarnings is empty without a snapshot', () => {
  assert.deepEqual(environmentWarnings(null), [])
  assert.deepEqual(environmentWarnings(undefined), [])
})

test('environmentWarnings reports an old git that cannot pre-check merges', () => {
  assert.deepEqual(environmentWarnings({ mergeTreeSupported: false, longPaths: true }), ['git'])
})

test('environmentWarnings reports disabled Windows long paths', () => {
  assert.deepEqual(environmentWarnings({ mergeTreeSupported: true, longPaths: false }), ['longPaths'])
})

test('environmentWarnings reports both problems in a stable order', () => {
  assert.deepEqual(environmentWarnings({ mergeTreeSupported: false, longPaths: false }), ['git', 'longPaths'])
})

test('environmentWarnings stays silent when capabilities are fine or unknown', () => {
  assert.deepEqual(environmentWarnings({ mergeTreeSupported: true, longPaths: true }), [])
  assert.deepEqual(environmentWarnings({ mergeTreeSupported: true, longPaths: null }), [])
  assert.deepEqual(environmentWarnings({}), [])
})
