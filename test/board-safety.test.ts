import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/**
 * Safety: the task row, the attention summary/filter and the derivation must
 * never call a repository-mutating endpoint. They may only navigate. This static
 * guard catches a future edit that wires a quick action to checkout/merge/etc.
 */
const FILES = ['src/client/task-attention.ts', 'src/client/task-row.ts', 'src/client/attention-filter.ts']
const FORBIDDEN = ['task/checkout', 'task/back', 'task/merge', 'task/cleanup', 'task/stash', 'postLong(', 'post(']

test('row/filter/summary modules never call mutating git endpoints', () => {
  for (const file of FILES) {
    const src = readFileSync(file, 'utf8')
    for (const token of FORBIDDEN) {
      assert.equal(src.includes(token), false, `${file} must not reference ${token}`)
    }
  }
})
