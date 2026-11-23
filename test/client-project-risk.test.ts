import test from 'node:test'
import assert from 'node:assert/strict'
import { buildProjectRisk, riskLevelOf } from '../src/client/project-risk.js'
import type { TaskSnapshot, TaskStatus, TaskView, WorktreeTask } from '../src/models.js'

const DAY = 86400000
/** Fixed local wall-clock base: no DST transition in June for either hemisphere. */
const NOW = new Date(2026, 5, 15, 15, 30, 0, 0).getTime()

/** Local midnight `offset` days from NOW. */
function due(offset: number): number {
  const base = new Date(NOW)
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset).getTime()
}

function task(over: Partial<WorktreeTask> = {}): WorktreeTask {
  return {
    id: 't1',
    projectId: 'p1',
    title: 'Task',
    description: '',
    repoPath: 'C:/repo',
    baseBranch: 'main',
    branch: 'dsh/t1',
    worktreePath: 'C:/wt',
    createdAt: NOW - DAY,
    updatedAt: NOW - DAY,
    ...over,
  }
}

function snapshot(over: Partial<TaskSnapshot> = {}): TaskSnapshot {
  return {
    worktree: { exists: true, branch: 'dsh/t1', dirtyCount: 0, ahead: 0, commits: [], lastCommitAt: null },
    repo: { exists: true, currentBranch: 'main', dirtyCount: 0 },
    branchExists: true,
    merged: false,
    status: 'review',
    ...over,
  }
}

function view(over: Partial<WorktreeTask> = {}, status: TaskStatus = 'review'): TaskView {
  return { task: task(over), snapshot: snapshot({ status }) }
}

/** Reasons only, so assertions stay readable. */
function codes(item: any): string[] {
  return item.reasons.map((reason: any) => reason.code)
}

test('empty input: no items, zero counts, empty top', () => {
  const r = buildProjectRisk([], NOW)
  assert.deepEqual(r.items, [])
  assert.deepEqual(r.top, [])
  assert.equal(r.high, 0)
  assert.equal(r.medium, 0)
  assert.equal(r.low, 0)
  assert.equal(r.open, 0)
  // A malformed list is treated as empty instead of throwing.
  assert.equal(buildProjectRisk(null as any, NOW).open, 0)
})

test('broken alone: +4, medium, one reason without a number', () => {
  const r = buildProjectRisk([view({}, 'broken')], NOW)
  assert.equal(r.open, 1)
  assert.equal(r.items.length, 1)
  const item = r.items[0]
  assert.equal(item.score, 4)
  assert.equal(item.level, 'medium')
  assert.deepEqual(item.reasons, [{ code: 'broken' }])
  assert.equal(r.high, 0)
  assert.equal(r.medium, 1)
  assert.equal(r.low, 0)
})

test('overdue: +3, then +1 per full week capped at +2', () => {
  const one = buildProjectRisk([view({ dueAt: due(-1) })], NOW)
  assert.equal(one.items[0].score, 3)
  assert.equal(one.items[0].level, 'medium')
  assert.deepEqual(one.items[0].reasons, [{ code: 'overdue', n: 1 }])

  const six = buildProjectRisk([view({ dueAt: due(-6) })], NOW)
  assert.equal(six.items[0].score, 3)
  assert.deepEqual(six.items[0].reasons, [{ code: 'overdue', n: 6 }])

  const week = buildProjectRisk([view({ dueAt: due(-7) })], NOW)
  assert.equal(week.items[0].score, 4)
  assert.deepEqual(week.items[0].reasons, [{ code: 'overdue', n: 7 }])

  const fortnight = buildProjectRisk([view({ dueAt: due(-14) })], NOW)
  assert.equal(fortnight.items[0].score, 5)
  assert.equal(fortnight.items[0].level, 'high')
  assert.deepEqual(fortnight.items[0].reasons, [{ code: 'overdue', n: 14 }])

  // The weekly bonus stops at +2 even when the task is far past due.
  const month = buildProjectRisk([view({ dueAt: due(-30) })], NOW)
  assert.equal(month.items[0].score, 5)
  assert.deepEqual(month.items[0].reasons, [{ code: 'overdue', n: 30 }])
})

test('due-soon: today and up to 3 days ahead score +1, later days score 0', () => {
  const today = buildProjectRisk([view({ dueAt: due(0) })], NOW)
  assert.equal(today.items[0].score, 1)
  assert.equal(today.items[0].level, 'low')
  assert.deepEqual(today.items[0].reasons, [{ code: 'due-soon' }])

  const three = buildProjectRisk([view({ dueAt: due(3) })], NOW)
  assert.equal(three.items[0].score, 1)
  assert.deepEqual(three.items[0].reasons, [{ code: 'due-soon' }])

  const later = buildProjectRisk([view({ dueAt: due(4) })], NOW)
  assert.equal(later.open, 1)
  assert.deepEqual(later.items, [])
  assert.equal(later.high + later.medium + later.low, 0)
})

test('stalled: +2 once the status threshold is reached', () => {
  const stalled = buildProjectRisk([view({ updatedAt: NOW - 8 * DAY, createdAt: NOW - 20 * DAY }, 'developing')], NOW)
  assert.equal(stalled.items[0].score, 2)
  assert.equal(stalled.items[0].level, 'low')
  assert.deepEqual(stalled.items[0].reasons, [{ code: 'stalled', n: 8 }])

  // developing allows 7 quiet days, so 6 days is not stalled yet.
  const quiet = buildProjectRisk([view({ updatedAt: NOW - 6 * DAY, createdAt: NOW - 20 * DAY }, 'developing')], NOW)
  assert.deepEqual(quiet.items, [])
  assert.equal(quiet.open, 1)
})

test('blocked: unfinished or missing prerequisites add +2 once', () => {
  const depOpen = view({ id: 'dep', title: 'Dep' })
  const blocked = buildProjectRisk([view({ id: 't1', dependsOn: ['dep'] }), depOpen], NOW)
  const item = blocked.items.find((row) => row.taskId === 't1')!
  assert.equal(item.score, 2)
  assert.deepEqual(item.reasons, [{ code: 'blocked', n: 1 }])

  const twoOpen = buildProjectRisk([
    view({ id: 't1', dependsOn: ['dep1', 'dep2'] }),
    view({ id: 'dep1', title: 'Dep 1' }),
    view({ id: 'dep2', title: 'Dep 2' }),
  ], NOW)
  const both = twoOpen.items.find((row) => row.taskId === 't1')!
  assert.equal(both.score, 2)
  assert.deepEqual(both.reasons, [{ code: 'blocked', n: 2 }])

  // A missing row is still a blocker, and the count is reported.
  const missing = buildProjectRisk([view({ id: 't1', dependsOn: ['gone'] })], NOW)
  assert.equal(missing.items[0].score, 2)
  assert.deepEqual(missing.items[0].reasons, [{ code: 'blocked', n: 1 }])

  // A finished prerequisite no longer blocks.
  const done = buildProjectRisk([
    view({ id: 't1', dependsOn: ['dep'] }),
    view({ id: 'dep', title: 'Dep', mergedAt: NOW - DAY }, 'merged'),
  ], NOW)
  assert.equal(done.items.length, 0)
  assert.equal(done.open, 1)
})

test('criteria: review/reviewing with unchecked items scores +1, developing does not', () => {
  const review = buildProjectRisk([view({ acceptanceCriteria: ['a', 'b'], checkedCriteria: ['a'] })], NOW)
  assert.equal(review.items[0].score, 1)
  assert.deepEqual(review.items[0].reasons, [{ code: 'criteria', n: 1 }])

  const reviewing = buildProjectRisk([view({ acceptanceCriteria: ['a'], checkedCriteria: [] }, 'reviewing')], NOW)
  assert.equal(reviewing.items[0].score, 1)
  assert.deepEqual(reviewing.items[0].reasons, [{ code: 'criteria', n: 1 }])

  const developing = buildProjectRisk([view({ acceptanceCriteria: ['a'] }, 'developing')], NOW)
  assert.deepEqual(developing.items, [])

  // Empty / fully checked criteria never count as a gap.
  const empty = buildProjectRisk([view({ acceptanceCriteria: [] })], NOW)
  assert.deepEqual(empty.items, [])
  const checked = buildProjectRisk([view({ acceptanceCriteria: ['a'], checkedCriteria: ['a'] })], NOW)
  assert.deepEqual(checked.items, [])
})

test('combined factors add up and the total is capped at 10', () => {
  const combined = buildProjectRisk([
    view({
      id: 't1',
      dueAt: due(-14),
      updatedAt: NOW - 4 * DAY,
      createdAt: NOW - 30 * DAY,
      dependsOn: ['dep'],
      acceptanceCriteria: ['a', 'b'],
      checkedCriteria: ['a'],
    }),
    view({ id: 'dep', title: 'Dep' }),
  ], NOW)
  const item = combined.items.find((row) => row.taskId === 't1')!
  // 5 overdue + 2 stalled + 2 blocked + 1 criteria = 10.
  assert.equal(item.score, 10)
  assert.equal(item.level, 'high')
  assert.deepEqual(codes(item), ['overdue', 'stalled', 'blocked', 'criteria'])

  const capped = buildProjectRisk([
    view({ id: 't1', dueAt: due(-14), dependsOn: ['dep'] }, 'broken'),
    view({ id: 'dep', title: 'Dep' }),
  ], NOW)
  const cappedItem = capped.items.find((row) => row.taskId === 't1')!
  // 4 + 5 + 2 = 11, stored as 10.
  assert.equal(cappedItem.score, 10)
  assert.deepEqual(codes(cappedItem), ['broken', 'overdue', 'blocked'])
})

test('level boundaries: 1 low, 2 low, 3 medium, 4 medium, 5 high', () => {
  assert.equal(riskLevelOf(0), 'none')
  assert.equal(riskLevelOf(1), 'low')
  assert.equal(riskLevelOf(2), 'low')
  assert.equal(riskLevelOf(3), 'medium')
  assert.equal(riskLevelOf(4), 'medium')
  assert.equal(riskLevelOf(5), 'high')

  const one = buildProjectRisk([view({ dueAt: due(0) })], NOW)
  assert.equal(one.items[0].level, 'low')
  const two = buildProjectRisk([view({ updatedAt: NOW - 8 * DAY, createdAt: NOW - 20 * DAY }, 'developing')], NOW)
  assert.equal(two.items[0].level, 'low')
  const three = buildProjectRisk([view({ dueAt: due(-1) })], NOW)
  assert.equal(three.items[0].level, 'medium')
  const four = buildProjectRisk([view({}, 'broken')], NOW)
  assert.equal(four.items[0].level, 'medium')
  const five = buildProjectRisk([view({ dueAt: due(-14) })], NOW)
  assert.equal(five.items[0].level, 'high')
})

test('archived, merged and cleaned tasks never take part in scoring', () => {
  const views = [
    view({ id: 'archived', dueAt: due(-20), archivedAt: NOW - DAY }),
    view({ id: 'merged', dueAt: due(-20) }, 'merged'),
    view({ id: 'cleaned', dueAt: due(-20) }, 'cleaned'),
    // Legacy rows may carry the timestamps without the matching status.
    view({ id: 'mergedAt', dueAt: due(-20), mergedAt: NOW - DAY }),
    view({ id: 'cleanedAt', dueAt: due(-20), cleanedAt: NOW - DAY }),
  ]
  const r = buildProjectRisk(views, NOW)
  assert.equal(r.open, 0)
  assert.deepEqual(r.items, [])
  assert.equal(r.high + r.medium + r.low, 0)
})

test('invalid timestamps read as absent: no NaN, no negative score', () => {
  const r = buildProjectRisk([view({
    dueAt: Number.NaN,
    createdAt: Number.NaN,
    updatedAt: Number.NaN,
  })], NOW)
  assert.equal(r.open, 1)
  assert.deepEqual(r.items, [])

  const zero = buildProjectRisk([view({ dueAt: 0, createdAt: 0, updatedAt: 0 })], NOW)
  assert.equal(zero.open, 1)
  assert.deepEqual(zero.items, [])

  const negative = buildProjectRisk([view({ dueAt: -DAY, createdAt: -DAY, updatedAt: -DAY })], NOW)
  assert.equal(negative.open, 1)
  assert.deepEqual(negative.items, [])

  for (const item of buildProjectRisk([view({ dueAt: due(-30) })], NOW).items) {
    assert.ok(Number.isFinite(item.score) && item.score >= 0 && item.score <= 10)
  }
})

test('future timestamps are absent or clamped, never negative', () => {
  const future = buildProjectRisk([view({
    dueAt: NOW + 10 * DAY,
    createdAt: NOW + 10 * DAY,
    updatedAt: NOW + 10 * DAY,
  }, 'developing')], NOW)
  assert.equal(future.open, 1)
  // A future deadline is not overdue, and a future activity stamp is not stalled.
  assert.deepEqual(future.items, [])

  const invalidNow = buildProjectRisk([view({ dueAt: due(-1) })], Number.NaN)
  assert.ok(invalidNow.items[0].score >= 0)
})

test('now is injectable: the same task moves buckets as time passes', () => {
  const taskView = view({ dueAt: due(0), updatedAt: NOW })
  const soon = buildProjectRisk([taskView], NOW)
  assert.deepEqual(soon.items[0].reasons, [{ code: 'due-soon' }])

  const overdue = buildProjectRisk([taskView], NOW + 2 * DAY)
  assert.deepEqual(overdue.items[0].reasons, [{ code: 'overdue', n: 2 }])
  assert.equal(overdue.items[0].score, 3)
})

test('ordering: score, then due date (none last), then creation, then id', () => {
  const byDue = buildProjectRisk([
    view({ id: 'late1', title: 'Late 1', dueAt: due(-1) }),
    view({ id: 'late6', title: 'Late 6', dueAt: due(-6) }),
  ], NOW)
  // Both score 3; the earlier deadline comes first.
  assert.deepEqual(byDue.items.map((item) => item.taskId), ['late6', 'late1'])

  const noDueLast = buildProjectRisk([
    view({ id: 'nodue', updatedAt: NOW - 4 * DAY, createdAt: NOW - 10 * DAY, acceptanceCriteria: ['a'] }),
    view({ id: 'dated', dueAt: due(-1) }),
  ], NOW)
  assert.deepEqual(noDueLast.items.map((item) => item.taskId), ['dated', 'nodue'])

  const byCreated = buildProjectRisk([
    view({ id: 'newer', createdAt: NOW - 2 * DAY }, 'broken'),
    view({ id: 'older', createdAt: NOW - 5 * DAY }, 'broken'),
  ], NOW)
  assert.deepEqual(byCreated.items.map((item) => item.taskId), ['older', 'newer'])

  const byId = buildProjectRisk([
    view({ id: 'b-task', createdAt: NOW - 2 * DAY }, 'broken'),
    view({ id: 'a-task', createdAt: NOW - 2 * DAY }, 'broken'),
  ], NOW)
  assert.deepEqual(byId.items.map((item) => item.taskId), ['a-task', 'b-task'])
})

test('top keeps the five highest scores and the counts stay consistent', () => {
  const views = Array.from({ length: 7 }, (_, index) => view({
    id: 't' + index,
    title: 'Task ' + index,
    createdAt: NOW - 2 * DAY,
  }, 'broken'))
  const r = buildProjectRisk(views, NOW)
  assert.equal(r.open, 7)
  assert.equal(r.items.length, 7)
  assert.equal(r.top.length, 5)
  assert.deepEqual(r.top.map((item) => item.taskId), ['t0', 't1', 't2', 't3', 't4'])
  assert.equal(r.high + r.medium + r.low, 7)
  assert.equal(r.medium, 7)
})
