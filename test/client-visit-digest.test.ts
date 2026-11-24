import test from 'node:test'
import assert from 'node:assert/strict'
import {
  VISIT_EVENT_LIMIT,
  buildVisitDigest,
  type VisitDigest,
} from '../src/client/visit-digest.js'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
/** Local noon, so calendar-day comparisons do not depend on the test timezone. */
const NOW = new Date(2026, 0, 10, 12, 0, 0).getTime()
const SINCE = NOW - 2 * HOUR

function snap(status = 'ready', over: Record<string, any> = {}) {
  return Object.assign(
    {
      status,
      worktree: { exists: true, branch: 'b', dirtyCount: 0, ahead: 0, commits: [], lastCommitAt: null },
      repo: { exists: true, currentBranch: 'main', dirtyCount: 0 },
      branchExists: true,
      merged: false,
    },
    over,
  )
}

function task(over: Record<string, any> = {}) {
  return Object.assign(
    {
      id: 't1',
      projectId: 'p1',
      title: 'Task one',
      createdAt: SINCE - DAY,
      updatedAt: SINCE - DAY,
    },
    over,
  )
}

function view(over: Record<string, any> = {}, status = 'ready', snapshotOver: Record<string, any> = {}) {
  return { task: task(over), snapshot: snap(status, snapshotOver) }
}

function digestOf(views: any[], since: unknown = SINCE, now = NOW): VisitDigest {
  const digest = buildVisitDigest(views as any, since, now)
  assert.ok(digest, 'expected a digest')
  return digest as VisitDigest
}

test('VISIT_EVENT_LIMIT is the documented 8', () => {
  assert.equal(VISIT_EVENT_LIMIT, 8)
})

test('missing, illegal or non-past baselines return null', () => {
  const views = [view({ createdAt: SINCE + 1 })]
  for (const since of [undefined, null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY, '123', {}, [], true]) {
    assert.equal(buildVisitDigest(views as any, since, NOW), null, `since=${String(since)}`)
  }
  assert.equal(buildVisitDigest(views as any, NOW, NOW), null)
  assert.equal(buildVisitDigest(views as any, NOW + 1, NOW), null)
  // A missing `now` falls back to the real clock; only the null contract is asserted.
  assert.equal(buildVisitDigest(views as any, 0), null)
})

test('events include since+1 through now, excluding since and the future', () => {
  const views = [
    view({ id: 'at-since', createdAt: SINCE }),
    view({ id: 'after-since', createdAt: SINCE + 1 }),
    view({ id: 'at-now', createdAt: NOW }),
    view({ id: 'after-now', createdAt: NOW + 1 }),
    view({ id: 'invalid', createdAt: 'not-a-time' as any }),
  ]
  const digest = digestOf(views)
  assert.equal(digest.created, 2)
  assert.equal(digest.changed, 2)
  assert.deepEqual(digest.events.map((e) => e.taskId).sort(), ['after-since', 'at-now'])
  assert.equal(digest.since, SINCE)
  assert.equal(digest.now, NOW)
})

test('counts all four event kinds and dedupes changed by task id', () => {
  const views = [
    view({
      id: 't1',
      title: 'One',
      createdAt: SINCE + 1,
      mergedAt: SINCE + 2,
      cleanedAt: SINCE + 3,
      archivedAt: SINCE + 4,
    }),
    view({ id: 't2', title: 'Two', createdAt: SINCE + 5 }),
    view({ id: 't3', title: 'Three', mergedAt: SINCE + 6 }),
  ]
  const digest = digestOf(views)
  assert.equal(digest.created, 2)
  assert.equal(digest.merged, 2)
  assert.equal(digest.cleaned, 1)
  assert.equal(digest.archived, 1)
  assert.equal(digest.changed, 3)
  assert.equal(digest.events.length, 6)
})

test('review counts current review/reviewing rows and ignores archived ones', () => {
  const views = [
    view({ id: 'review' }, 'review'),
    view({ id: 'reviewing' }, 'reviewing'),
    view({ id: 'review-archived', archivedAt: SINCE + 1 }, 'review'),
    view({ id: 'merged' }, 'merged'),
    view({ id: 'cleaned' }, 'cleaned'),
  ]
  const digest = digestOf(views)
  assert.equal(digest.review, 2)
})

test('overdue and stalled only count current open tasks', () => {
  const dueAt = NOW - 3 * DAY
  const views = [
    view({ id: 'open-late', dueAt, updatedAt: NOW - 4 * DAY, createdAt: NOW - 10 * DAY }, 'review'),
    view({ id: 'open-fresh', dueAt, updatedAt: NOW - HOUR }, 'ready'),
    view({ id: 'archived', dueAt, updatedAt: NOW - 10 * DAY, archivedAt: SINCE + 1 }, 'review'),
    view({ id: 'merged', dueAt, updatedAt: NOW - 10 * DAY }, 'merged'),
    view({ id: 'cleaned', dueAt, updatedAt: NOW - 10 * DAY }, 'cleaned'),
  ]
  const digest = digestOf(views)
  assert.equal(digest.overdue, 2)
  assert.equal(digest.stalled, 1)
})

test('stopped and idle timers add no work inside the window', () => {
  const views = [
    view({ id: 'none' }),
    view({ id: 'stopped', workMs: 45 * 60 * 1000 }),
  ]
  assert.equal(digestOf(views).workMs, 0)
})

test('a running timer contributes exactly its window overlap', () => {
  const views = [
    // Started before the window: the whole window counts.
    view({ id: 'running-early', workMs: HOUR, workStartedAt: SINCE - 10 * 60 * 1000 }),
    // Started inside the window: only the part after the start counts.
    view({ id: 'running-inside', workMs: HOUR, workStartedAt: SINCE + 30 * 60 * 1000 }),
    // Stopped before the visit: already recorded, no delta.
    view({ id: 'stopped', workMs: 4 * HOUR }),
  ]
  const digest = digestOf(views)
  assert.equal(digest.workMs, 2 * HOUR + 90 * 60 * 1000)
})

test('invalid or future timer values never produce negative work', () => {
  const views = [
    view({ id: 'future', workMs: HOUR, workStartedAt: NOW + HOUR }),
    view({ id: 'bad-record', workMs: -1, workStartedAt: 'x' as any }),
    view({ id: 'bad-start', workMs: 'oops' as any, workStartedAt: NOW - HOUR }),
  ]
  const digest = digestOf(views)
  assert.equal(digest.workMs, HOUR)
})

test('events sort by time desc, then title, id and fixed kind order', () => {
  const views = [
    view({ id: 'b-task', title: 'Beta', createdAt: SINCE + 10 }),
    view({ id: 'a-task', title: 'Alpha', createdAt: SINCE + 10 }),
    view({ id: 'z-task', title: 'Alpha', createdAt: SINCE + 10 }),
    view({ id: 'newest', title: 'Newest', createdAt: SINCE + 20 }),
    view({ id: 'same-time', title: 'Same', createdAt: SINCE + 5, mergedAt: SINCE + 5 }),
  ]
  const digest = digestOf(views)
  assert.deepEqual(digest.events.map((e) => [e.taskId, e.kind]), [
    ['newest', 'created'],
    ['a-task', 'created'],
    ['z-task', 'created'],
    ['b-task', 'created'],
    ['same-time', 'created'],
    ['same-time', 'merged'],
  ])
})

test('title ordering uses code points, not locale collation', () => {
  // 'B' (0x42) sorts before 'a' (0x61) by code point, while most locale
  // collations put "alpha" first. The digest must not depend on the ICU data
  // available to the browser.
  const views = [
    view({ id: 'lower', title: 'alpha', createdAt: SINCE + 10 }),
    view({ id: 'upper', title: 'Beta', createdAt: SINCE + 10 }),
  ]
  assert.deepEqual(digestOf(views).events.map((e) => e.taskId), ['upper', 'lower'])
})

test('more than the limit truncates events but keeps every count', () => {
  const views = Array.from({ length: 10 }, (_v, i) => view({
    id: 't' + String(i).padStart(2, '0'),
    title: 'Task ' + i,
    createdAt: SINCE + 1 + i,
  }))
  const digest = digestOf(views)
  assert.equal(digest.created, 10)
  assert.equal(digest.changed, 10)
  assert.equal(digest.events.length, VISIT_EVENT_LIMIT)
  assert.equal(digest.truncated, true)
  // Newest first survives the cut.
  assert.equal(digest.events[0].taskId, 't09')
})

test('exactly the limit is not truncated', () => {
  const views = Array.from({ length: VISIT_EVENT_LIMIT }, (_v, i) => view({
    id: 't' + i,
    createdAt: SINCE + 1 + i,
  }))
  const digest = digestOf(views)
  assert.equal(digest.events.length, VISIT_EVENT_LIMIT)
  assert.equal(digest.truncated, false)
})

test('an empty project yields an all-zero digest instead of null', () => {
  const digest = digestOf([])
  assert.deepEqual(digest, {
    since: SINCE,
    now: NOW,
    created: 0,
    merged: 0,
    cleaned: 0,
    archived: 0,
    review: 0,
    overdue: 0,
    stalled: 0,
    workMs: 0,
    changed: 0,
    events: [],
    truncated: false,
  })
})

test('the same input is deep-equal across calls', () => {
  const views = [
    view({ id: 'a', title: 'A', createdAt: SINCE + 3 }),
    view({ id: 'b', title: 'B', createdAt: SINCE + 3, mergedAt: SINCE + 4 }),
    view({ id: 'c', title: 'C', createdAt: SINCE + 4 }, 'review'),
  ]
  assert.deepEqual(digestOf(views), digestOf(views))
})
