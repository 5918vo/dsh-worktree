import test from 'node:test'
import assert from 'node:assert/strict'
import { buildProjectInsights, INSIGHTS_DAYS } from '../src/client/project-insights.js'
import type { TaskSnapshot, TaskStatus, TaskView, WorktreeTask } from '../src/models.js'

const DAY = 86400000
/** Fixed local wall-clock base: no DST transition in June for either hemisphere. */
const NOW = new Date(2026, 5, 15, 15, 30, 0, 0).getTime()

/** Noon of a local calendar day relative to NOW (month/day rollover is fine). */
function noon(offset: number): number {
  const base = new Date(NOW)
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset, 12).getTime()
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

function mergedTask(cycleDays: number, over: Partial<WorktreeTask> = {}): TaskView {
  return view({ createdAt: NOW - cycleDays * DAY, mergedAt: NOW, ...over }, 'merged')
}

test('empty project: zero counts, null figures, seven empty local-day buckets', () => {
  const r = buildProjectInsights([], NOW)
  assert.equal(r.total, 0)
  assert.equal(r.open, 0)
  assert.equal(r.merged, 0)
  assert.equal(r.archived, 0)
  assert.equal(r.createdLast7, 0)
  assert.equal(r.mergedLast7, 0)
  assert.equal(r.cycleSamples, 0)
  assert.equal(r.cycleAverageDays, null)
  assert.equal(r.cycleMedianDays, null)
  assert.equal(r.acceptanceChecked, 0)
  assert.equal(r.acceptanceTotal, 0)
  assert.equal(r.acceptancePercent, null)
  assert.equal(r.oldestOpenDays, null)
  assert.deepEqual(r.statusCounts, {})
  assert.equal(r.daily.length, INSIGHTS_DAYS)
  assert.deepEqual(r.daily.map((day) => day.offset), [-6, -5, -4, -3, -2, -1, 0])
  for (const day of r.daily) {
    assert.equal(day.created, 0)
    assert.equal(day.merged, 0)
    assert.equal(new Date(day.start).getHours(), 0)
    assert.equal(new Date(day.start).getMinutes(), 0)
  }
})

test('counts split total / open / merged / archived and never double count', () => {
  const r = buildProjectInsights([
    mergedTask(2),
    view({ archivedAt: NOW - DAY }, 'review'),
    view({}, 'cleaned'),
    view({}, 'broken'),
    view({}, 'developing'),
  ], NOW)
  assert.equal(r.total, 5)
  assert.equal(r.merged, 1)
  assert.equal(r.archived, 1)
  // broken and developing are unfinished; archived, merged and cleaned are not.
  assert.equal(r.open, 2)
  assert.deepEqual(r.statusCounts, { merged: 1, review: 1, cleaned: 1, broken: 1, developing: 1 })
})

test('cycle average and median over an odd number of samples', () => {
  const r = buildProjectInsights([mergedTask(1), mergedTask(2), mergedTask(3)], NOW)
  assert.equal(r.cycleSamples, 3)
  assert.equal(r.cycleAverageDays, 2)
  assert.equal(r.cycleMedianDays, 2)
})

test('cycle median averages the two middle samples for an even count and rounds to one decimal', () => {
  const even = buildProjectInsights([mergedTask(1), mergedTask(2), mergedTask(3), mergedTask(4)], NOW)
  assert.equal(even.cycleSamples, 4)
  assert.equal(even.cycleAverageDays, 2.5)
  assert.equal(even.cycleMedianDays, 2.5)

  const rounded = buildProjectInsights([mergedTask(0.5), mergedTask(1)], NOW)
  assert.equal(rounded.cycleAverageDays, 0.8)
  assert.equal(rounded.cycleMedianDays, 0.8)
})

test('a merge recorded before creation is ignored instead of producing a negative cycle', () => {
  const r = buildProjectInsights([
    view({ createdAt: NOW - DAY, mergedAt: NOW - 3 * DAY }, 'merged'),
  ], NOW)
  assert.equal(r.merged, 1)
  assert.equal(r.cycleSamples, 0)
  assert.equal(r.cycleAverageDays, null)
  assert.equal(r.cycleMedianDays, null)
})

test('future timestamps are ignored for cycles and throughput, and never go negative', () => {
  const r = buildProjectInsights([
    view({ createdAt: NOW - 10 * DAY, mergedAt: NOW + 2 * DAY }, 'merged'),
    view({ createdAt: NOW + 5 * DAY }, 'review'),
  ], NOW)
  assert.equal(r.merged, 1)
  assert.equal(r.cycleSamples, 0)
  assert.equal(r.createdLast7, 0)
  assert.equal(r.mergedLast7, 0)
  // The future-created open task is 0 days old, not negative.
  assert.equal(r.oldestOpenDays, 0)
  assert.ok(r.daily.every((day) => day.created === 0 && day.merged === 0))
})

test('7-day buckets use local calendar days: today and 6 days ago in, 7 days ago out', () => {
  const r = buildProjectInsights([
    view({ createdAt: noon(0), mergedAt: noon(0) }, 'merged'),
    view({ createdAt: noon(-6) }, 'review'),
    view({ createdAt: noon(-7) }, 'review'),
    view({ createdAt: noon(0), mergedAt: noon(0) }, 'merged'),
    view({ createdAt: noon(-30), mergedAt: noon(-7) }, 'merged'),
  ], NOW)
  assert.equal(r.createdLast7, 3)
  assert.equal(r.mergedLast7, 2)
  assert.equal(r.daily[0].created, 1)
  assert.equal(r.daily[0].merged, 0)
  assert.equal(r.daily[6].created, 2)
  assert.equal(r.daily[6].merged, 2)
})

test('local midnight belongs to the day it starts, not the previous one', () => {
  const midnightToday = new Date(new Date(NOW).getFullYear(), new Date(NOW).getMonth(), new Date(NOW).getDate()).getTime()
  const midnightSixAgo = new Date(new Date(NOW).getFullYear(), new Date(NOW).getMonth(), new Date(NOW).getDate() - 6).getTime()
  const midnightSevenAgo = new Date(new Date(NOW).getFullYear(), new Date(NOW).getMonth(), new Date(NOW).getDate() - 7).getTime()
  const r = buildProjectInsights([
    view({ createdAt: midnightToday }, 'review'),
    view({ createdAt: midnightSixAgo }, 'review'),
    view({ createdAt: midnightSevenAgo }, 'review'),
  ], NOW)
  assert.equal(r.daily[6].created, 1)
  assert.equal(r.daily[0].created, 1)
  assert.equal(r.createdLast7, 2)
})

test('acceptance coverage: none, partial and complete', () => {
  const none = buildProjectInsights([view({ acceptanceCriteria: [] })], NOW)
  assert.equal(none.acceptanceTotal, 0)
  assert.equal(none.acceptancePercent, null)

  const partial = buildProjectInsights([
    view({ acceptanceCriteria: ['a', 'b', 'c'], checkedCriteria: ['a'] }),
  ], NOW)
  assert.equal(partial.acceptanceChecked, 1)
  assert.equal(partial.acceptanceTotal, 3)
  assert.equal(partial.acceptancePercent, 33)

  // A merged task's criteria count as checked, matching the merge gate.
  const complete = buildProjectInsights([
    mergedTask(1, { acceptanceCriteria: ['a', 'b'] }),
  ], NOW)
  assert.equal(complete.acceptanceChecked, 2)
  assert.equal(complete.acceptanceTotal, 2)
  assert.equal(complete.acceptancePercent, 100)
})

test('oldest open task excludes archived, merged and cleaned records', () => {
  const r = buildProjectInsights([
    view({ createdAt: NOW - 10 * DAY }, 'review'),
    view({ createdAt: NOW - 3 * DAY }, 'broken'),
    view({ createdAt: NOW - 100 * DAY, archivedAt: NOW - DAY }, 'review'),
    mergedTask(200),
    view({ createdAt: NOW - 50 * DAY }, 'cleaned'),
  ], NOW)
  assert.equal(r.oldestOpenDays, 10)
})

test('oldest open is null when nothing is open, and missing timestamps do not break it', () => {
  const none = buildProjectInsights([mergedTask(1), view({ archivedAt: NOW }, 'review')], NOW)
  assert.equal(none.oldestOpenDays, null)

  const missing = buildProjectInsights([
    view({ createdAt: undefined as any, updatedAt: undefined as any }, 'review'),
  ], NOW)
  assert.equal(missing.open, 1)
  assert.equal(missing.oldestOpenDays, null)

  const bad = buildProjectInsights([view({ createdAt: Number.NaN }, 'review')], NOW)
  assert.equal(bad.oldestOpenDays, null)
  assert.ok(Number.isFinite(bad.createdLast7))
  assert.ok(Number.isFinite(bad.mergedLast7))
})

test('accepts an omitted now without producing NaN', () => {
  const r = buildProjectInsights([view({ createdAt: Date.now() - 2 * DAY }, 'review')])
  assert.ok(Number.isFinite(r.oldestOpenDays as number))
  assert.equal(r.daily.length, INSIGHTS_DAYS)
  for (const day of r.daily) {
    assert.ok(Number.isFinite(day.start))
    assert.ok(day.created >= 0 && day.merged >= 0)
  }
})
