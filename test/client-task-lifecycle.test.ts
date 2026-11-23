import test from 'node:test'
import assert from 'node:assert/strict'
import en from '../locale/en.json'
import zh from '../locale/zh.json'
import {
  buildTaskLifecycle,
  lifecycleCycleDays,
  lifecycleLabelKey,
  type LifecycleKind,
} from '../src/client/task-lifecycle.js'

const DAY = 86_400_000
const T0 = new Date(2026, 0, 5, 9, 7).getTime()

const kinds = (task: any) => buildTaskLifecycle(task).map((event) => event.kind)

test('a freshly published task has only the publish event', () => {
  assert.deepEqual(buildTaskLifecycle({ createdAt: T0 }), [{ kind: 'created', at: T0 }])
  assert.deepEqual(kinds({ createdAt: T0, updatedAt: T0 }), ['created'])
})

test('every stored timestamp becomes an event in ascending order', () => {
  const events = buildTaskLifecycle({
    createdAt: T0,
    archivedAt: T0 + 4 * DAY,
    pinnedAt: T0 + DAY,
    mergedAt: T0 + 3 * DAY,
    cleanedAt: T0 + 5 * DAY,
    updatedAt: T0 + 6 * DAY,
    mergedCommit: 'abcdef1234567890',
  })
  assert.deepEqual(events.map((event) => event.kind), ['created', 'pinned', 'merged', 'archived', 'cleaned', 'updated'])
  assert.deepEqual(events.map((event) => event.at), [T0, T0 + DAY, T0 + 3 * DAY, T0 + 4 * DAY, T0 + 5 * DAY, T0 + 6 * DAY])
  assert.equal(events[2].commit, 'abcdef1')
  assert.equal(events[0].commit, undefined)
  assert.equal(events[3].commit, undefined)
})

test('the merge commit is only a 7-character short SHA when available', () => {
  const withSha = buildTaskLifecycle({ createdAt: T0, mergedAt: T0 + DAY, mergedCommit: 'deadbeefcafe' })
  assert.equal(withSha.find((event) => event.kind === 'merged')?.commit, 'deadbee')

  for (const mergedCommit of ['', '   ', null, undefined, 42]) {
    const events = buildTaskLifecycle({ createdAt: T0, mergedAt: T0 + DAY, mergedCommit })
    if (mergedCommit === 42) assert.equal(events.find((event) => event.kind === 'merged')?.commit, '42')
    else assert.equal(events.find((event) => event.kind === 'merged')?.commit, undefined)
  }
})

test('updatedAt is ignored unless it is clearly later than every other event', () => {
  const base = { createdAt: T0, mergedAt: T0 + DAY }

  assert.deepEqual(kinds({ ...base, updatedAt: T0 - DAY }), ['created', 'merged'])
  assert.deepEqual(kinds({ ...base, updatedAt: T0 }), ['created', 'merged'])
  assert.deepEqual(kinds({ ...base, updatedAt: T0 + DAY - 1 }), ['created', 'merged'])
  assert.deepEqual(kinds({ ...base, updatedAt: T0 + DAY + 999 }), ['created', 'merged'])
  assert.deepEqual(kinds({ ...base, updatedAt: T0 + DAY + 1000 }), ['created', 'merged', 'updated'])
})

test('updatedAt alone still shows, since it cannot duplicate another event', () => {
  assert.deepEqual(buildTaskLifecycle({ updatedAt: T0 }), [{ kind: 'updated', at: T0 }])
})

test('invalid, missing and negative timestamps are ignored', () => {
  const bad = [null, undefined, NaN, Infinity, -Infinity, -1, 0, '', '2026-01-05', {}, true]
  for (const value of bad) {
    const events = buildTaskLifecycle({ createdAt: value, pinnedAt: value, mergedAt: value, updatedAt: value })
    assert.deepEqual(events, [], `timestamp ${String(value)} must be ignored`)
  }
  assert.deepEqual(buildTaskLifecycle({}), [])
  assert.deepEqual(buildTaskLifecycle(null), [])
})

test('equal timestamps use a fixed event order instead of the input order', () => {
  const task = { cleanedAt: T0, archivedAt: T0, mergedAt: T0, pinnedAt: T0, createdAt: T0 }
  assert.deepEqual(kinds(task), ['created', 'pinned', 'merged', 'cleaned', 'archived'])
  const reversed = { createdAt: T0, pinnedAt: T0, mergedAt: T0, cleanedAt: T0, archivedAt: T0 }
  assert.deepEqual(kinds(reversed), ['created', 'pinned', 'merged', 'cleaned', 'archived'])
  // Sorting must not depend on key insertion order even with distinct times.
  const shuffled = { archivedAt: T0 + 2, createdAt: T0, mergedAt: T0 + 1 }
  assert.deepEqual(kinds(shuffled), ['created', 'merged', 'archived'])
})

test('lifecycleCycleDays reports publish → merge with one decimal', () => {
  assert.equal(lifecycleCycleDays({ createdAt: T0, mergedAt: T0 + 2 * DAY }), 2)
  assert.equal(lifecycleCycleDays({ createdAt: T0, mergedAt: T0 + 2.54 * DAY }), 2.5)
  assert.equal(lifecycleCycleDays({ createdAt: T0, mergedAt: T0 + 0.04 * DAY }), 0)
  assert.equal(lifecycleCycleDays({ createdAt: T0, mergedAt: T0 }), 0)
})

test('lifecycleCycleDays is null without a usable merge time', () => {
  assert.equal(lifecycleCycleDays({ createdAt: T0 }), null)
  assert.equal(lifecycleCycleDays({ mergedAt: T0 + DAY }), null)
  assert.equal(lifecycleCycleDays({ createdAt: T0, mergedAt: T0 - 1 }), null)
  assert.equal(lifecycleCycleDays({ createdAt: T0, mergedAt: NaN }), null)
  assert.equal(lifecycleCycleDays({ createdAt: 0, mergedAt: T0 }), null)
  assert.equal(lifecycleCycleDays(null), null)
})

test('every lifecycle kind maps to a key present in both dictionaries', () => {
  const all: LifecycleKind[] = ['created', 'pinned', 'merged', 'cleaned', 'archived', 'updated']
  const keys = all.map(lifecycleLabelKey)
  assert.deepEqual(keys, [
    'lifecycleCreated',
    'lifecyclePinned',
    'lifecycleMerged',
    'lifecycleCleaned',
    'lifecycleArchived',
    'lifecycleUpdated',
  ])
  assert.equal(new Set(keys).size, keys.length)
  for (const key of keys) {
    assert.ok(Object.prototype.hasOwnProperty.call(zh, key), `zh is missing ${key}`)
    assert.ok(Object.prototype.hasOwnProperty.call(en, key), `en is missing ${key}`)
  }
  assert.ok(Object.prototype.hasOwnProperty.call(zh, 'taskLifecycle'))
  assert.ok(Object.prototype.hasOwnProperty.call(en, 'taskLifecycle'))
  assert.ok(Object.prototype.hasOwnProperty.call(zh, 'lifecycleEmpty'))
  assert.ok(Object.prototype.hasOwnProperty.call(en, 'lifecycleEmpty'))
  assert.ok(Object.prototype.hasOwnProperty.call(zh, 'lifecycleCycle'))
  assert.ok(Object.prototype.hasOwnProperty.call(en, 'lifecycleCycle'))
  assert.ok(Object.prototype.hasOwnProperty.call(zh, 'reportLifecycle'))
  assert.ok(Object.prototype.hasOwnProperty.call(en, 'reportLifecycle'))
})

test('the timeline is derived only: the input task is never mutated', () => {
  const task: any = { createdAt: T0, mergedAt: T0 + DAY, updatedAt: T0 + 2 * DAY, mergedCommit: 'abcdef1234' }
  const before = JSON.stringify(task)
  buildTaskLifecycle(task)
  lifecycleCycleDays(task)
  assert.equal(JSON.stringify(task), before)
})
