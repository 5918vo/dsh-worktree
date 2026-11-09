import test from 'node:test'
import assert from 'node:assert/strict'
import { filterModelGroups } from '../src/client/model-filter'

const groups = [
  { id: 'deepseek', name: 'DeepSeek', models: [{ id: 'v4', name: 'DeepSeek V4' }, { id: 'r1', name: 'DeepSeek R1' }] },
  { id: 'baba', name: 'Baba', models: [{ id: 'mm/auto', name: 'Auto' }, { id: 'mm/chat', name: 'Chat Flash' }] },
]

test('filterModelGroups returns every group for a blank query', () => {
  const out = filterModelGroups(groups, '')
  assert.equal(out.length, 2)
  assert.equal(out[1].models.length, 2)
})

test('filterModelGroups matches names/ids case-insensitively and drops empty groups', () => {
  const out = filterModelGroups(groups, 'flash')
  assert.deepEqual(out.map((g) => g.id), ['baba'])
  assert.deepEqual(out[0].models.map((m) => m.id), ['mm/chat'])
  assert.deepEqual(filterModelGroups(groups, 'V4').map((g) => g.id), ['deepseek'])
})

test('filterModelGroups matches the model id too and returns [] when nothing matches', () => {
  assert.deepEqual(filterModelGroups(groups, 'mm/auto')[0].models.map((m) => m.id), ['mm/auto'])
  assert.deepEqual(filterModelGroups(groups, 'zzz'), [])
})

test('filterModelGroups tolerates malformed input', () => {
  assert.deepEqual(filterModelGroups(null, 'x'), [])
  assert.deepEqual(filterModelGroups([{ id: 'a', name: 'A' } as any], '').length, 1)
})
