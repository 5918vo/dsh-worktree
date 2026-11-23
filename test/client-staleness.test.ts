import test from 'node:test'
import assert from 'node:assert/strict'
import { STALLED_DAY_MS, STALLED_THRESHOLDS, lastActivityAt, stalledDays } from '../src/client/staleness.js'

const DAY = STALLED_DAY_MS
const NOW = 1_700_000_000_000

function snap(status: string, over: any = {}) {
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

function task(over: any = {}) {
  return Object.assign(
    {
      id: 't1',
      createdAt: NOW - 100 * DAY,
      updatedAt: NOW - 100 * DAY,
    },
    over,
  )
}

test('thresholds are 3 days for ready/review/reviewing and 7 for developing', () => {
  assert.deepEqual(STALLED_THRESHOLDS, { ready: 3, developing: 7, review: 3, reviewing: 3 })
})

test('ready stalls at exactly 3 days and not before', () => {
  assert.equal(stalledDays(task({ updatedAt: NOW - 3 * DAY }), snap('ready'), NOW), 3)
  assert.equal(stalledDays(task({ updatedAt: NOW - 3 * DAY + 1 }), snap('ready'), NOW), null)
})

test('developing needs the full 7 days', () => {
  assert.equal(stalledDays(task({ updatedAt: NOW - 7 * DAY }), snap('developing'), NOW), 7)
  assert.equal(stalledDays(task({ updatedAt: NOW - 6 * DAY }), snap('developing'), NOW), null)
})

test('review and reviewing use the 3 day threshold', () => {
  const view = (status: string) => stalledDays(task({ updatedAt: NOW - 4 * DAY }), snap(status), NOW)
  assert.equal(view('review'), 4)
  assert.equal(view('reviewing'), 4)
})

test('days are floored to whole days', () => {
  const at = NOW - (4 * DAY + DAY / 2)
  assert.equal(stalledDays(task({ updatedAt: at }), snap('review'), NOW), 4)
})

test('a recent commit counts as activity', () => {
  const stale = task({ updatedAt: NOW - 30 * DAY })
  const fresh = snap('developing', {
    worktree: { exists: true, branch: 'b', dirtyCount: 0, ahead: 0, commits: [], lastCommitAt: NOW - 1 * DAY },
  })
  assert.equal(stalledDays(stale, fresh, NOW), null)
  assert.equal(lastActivityAt(stale, fresh), NOW - 1 * DAY)
})

test('a clock rollback (activity in the future) is never stalled', () => {
  assert.equal(stalledDays(task({ updatedAt: NOW + DAY }), snap('review'), NOW), null)
})

test('archived and closed tasks never stall', () => {
  const old = task({ updatedAt: NOW - 30 * DAY })
  assert.equal(stalledDays({ ...old, archivedAt: NOW - DAY }, snap('ready'), NOW), null)
  for (const status of ['merged', 'cleaned', 'broken']) {
    assert.equal(stalledDays(old, snap(status), NOW), null, status + ' must not stall')
  }
})

test('unknown status, missing snapshot and missing task read as not stalled', () => {
  const old = task({ updatedAt: NOW - 30 * DAY })
  assert.equal(stalledDays(old, snap('weird'), NOW), null)
  assert.equal(stalledDays(old, null, NOW), null)
  assert.equal(stalledDays(null, snap('ready'), NOW), null)
})

test('missing worktree data falls back to the task timestamps', () => {
  const old = task({ updatedAt: NOW - 5 * DAY })
  const bare: any = { status: 'ready', repo: { exists: true, currentBranch: 'main', dirtyCount: 0 }, branchExists: true, merged: false }
  assert.equal(stalledDays(old, bare, NOW), 5)
})

test('lastActivityAt takes the newest of updatedAt, createdAt and lastCommitAt', () => {
  const t = task({ createdAt: NOW - 10 * DAY, updatedAt: NOW - 5 * DAY })
  assert.equal(lastActivityAt(t, snap('ready')), NOW - 5 * DAY)
  assert.equal(lastActivityAt(null, null), 0)
})
