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

test('estimate workload sums only open tasks with a valid estimate', () => {
  const r = buildProjectInsights([
    view({ estimate: 1 }, 'review'),
    view({ estimate: 3 }, 'broken'),
    view({ estimate: '5' as any }, 'developing'),
    view({}, 'review'),
    view({ estimate: 4 as any }, 'review'),
    view({ estimate: 8 }, 'merged'),
    view({ estimate: 8 }, 'cleaned'),
    view({ estimate: 8, archivedAt: NOW }, 'review'),
  ], NOW)
  // open = review x3 + broken + developing = 5; merged/cleaned/archived excluded.
  assert.equal(r.open, 5)
  assert.equal(r.openEstimatePoints, 9)
  assert.equal(r.estimatedOpen, 3)
  assert.equal(r.unestimatedOpen, 2, 'missing and invalid estimates both count as unestimated')
  assert.equal(r.estimateCoveragePercent, 60)
})

test('estimate coverage is null with no open tasks and rounds to a whole percent', () => {
  const none = buildProjectInsights([mergedTask(1), view({ estimate: 3 }, 'cleaned')], NOW)
  assert.equal(none.open, 0)
  assert.equal(none.openEstimatePoints, 0)
  assert.equal(none.estimatedOpen, 0)
  assert.equal(none.unestimatedOpen, 0)
  assert.equal(none.estimateCoveragePercent, null)

  const third = buildProjectInsights([
    view({ estimate: 2 }, 'review'),
    view({}, 'review'),
    view({}, 'review'),
  ], NOW)
  assert.equal(third.estimateCoveragePercent, 33)
})

/* ---------- estimate calibration ---------------------------------------- */

const HOUR = 3600000

function hours(n: number): number {
  return n * HOUR
}

test('calibration: no samples yields nulls and five empty buckets', () => {
  const empty = buildProjectInsights([], NOW)
  assert.equal(empty.calibration.samples, 0)
  assert.equal(empty.calibration.points, 0)
  assert.equal(empty.calibration.workMs, 0)
  assert.equal(empty.calibration.hours, 0)
  assert.equal(empty.calibration.hoursPerPoint, null)
  assert.equal(empty.calibration.medianHoursPerPoint, null)
  assert.deepEqual(empty.calibration.buckets.map((b) => b.points), [1, 2, 3, 5, 8])
  for (const bucket of empty.calibration.buckets) {
    assert.equal(bucket.samples, 0)
    assert.equal(bucket.workMs, 0)
    assert.equal(bucket.hours, 0)
    assert.equal(bucket.averageHours, null)
  }

  // Estimates without work time, and work time without estimates, are not samples.
  const noWork = buildProjectInsights([mergedTask(1, { estimate: 3 })], NOW)
  assert.equal(noWork.merged, 1)
  assert.equal(noWork.calibration.samples, 0)
  assert.equal(noWork.calibration.hoursPerPoint, null)

  const noEstimate = buildProjectInsights([mergedTask(1, { workMs: hours(4) })], NOW)
  assert.equal(noEstimate.calibration.samples, 0)
})

test('calibration: a single sample makes weighted and median values identical', () => {
  const r = buildProjectInsights([mergedTask(2, { estimate: 3, workMs: hours(6) })], NOW)
  const c = r.calibration
  assert.equal(c.samples, 1)
  assert.equal(c.points, 3)
  assert.equal(c.workMs, hours(6))
  assert.equal(c.hours, 6)
  assert.equal(c.hoursPerPoint, 2)
  assert.equal(c.medianHoursPerPoint, 2)
  assert.deepEqual(c.buckets.find((b) => b.points === 3), {
    points: 3,
    samples: 1,
    workMs: hours(6),
    hours: 6,
    averageHours: 6,
  })
  assert.equal(c.buckets.find((b) => b.points === 1)?.averageHours, null)
})

test('calibration: weighted hours-per-point differs from the median of ratios', () => {
  const r = buildProjectInsights([
    mergedTask(1, { estimate: 1, workMs: hours(1) }),
    mergedTask(1, { estimate: 8, workMs: hours(16) }),
  ], NOW)
  const c = r.calibration
  assert.equal(c.samples, 2)
  assert.equal(c.points, 9)
  assert.equal(c.workMs, hours(17))
  assert.equal(c.hours, 17)
  // Weighted: 17h / 9pt ≈ 1.888 -> 1.9. Median of ratios [1, 2] = 1.5.
  assert.equal(c.hoursPerPoint, 1.9)
  assert.equal(c.medianHoursPerPoint, 1.5)
})

test('calibration: median of an even count averages the middle pair, odd count takes the middle', () => {
  const even = buildProjectInsights([
    mergedTask(1, { estimate: 1, workMs: hours(1) }),
    mergedTask(1, { estimate: 1, workMs: hours(2) }),
    mergedTask(1, { estimate: 1, workMs: hours(5) }),
    mergedTask(1, { estimate: 1, workMs: hours(8) }),
  ], NOW)
  assert.equal(even.calibration.medianHoursPerPoint, 3.5)

  const odd = buildProjectInsights([
    mergedTask(1, { estimate: 1, workMs: hours(9) }),
    mergedTask(1, { estimate: 1, workMs: hours(1) }),
    mergedTask(1, { estimate: 1, workMs: hours(5) }),
  ], NOW)
  assert.equal(odd.calibration.medianHoursPerPoint, 5)
})

test('calibration: buckets aggregate samples, work time and average hours', () => {
  const r = buildProjectInsights([
    mergedTask(1, { estimate: 1, workMs: hours(2) }),
    mergedTask(1, { estimate: 1, workMs: hours(4) }),
    mergedTask(1, { estimate: 8, workMs: hours(12) }),
  ], NOW)
  const byPoints = new Map(r.calibration.buckets.map((b) => [b.points, b]))
  assert.deepEqual(byPoints.get(1), { points: 1, samples: 2, workMs: hours(6), hours: 6, averageHours: 3 })
  assert.deepEqual(byPoints.get(8), { points: 8, samples: 1, workMs: hours(12), hours: 12, averageHours: 12 })
  for (const points of [2, 3, 5]) {
    const bucket = byPoints.get(points)!
    assert.equal(bucket.samples, 0)
    assert.equal(bucket.averageHours, null)
  }
  assert.equal(r.calibration.buckets.length, 5)
})

test('calibration: open, unmerged and cleaned-without-merge records never count', () => {
  const r = buildProjectInsights([
    // Open task with both fields: still in progress, not a finished sample.
    view({ estimate: 3, workMs: hours(9) }, 'review'),
    // Merged status without any merge stamp still counts.
    view({ estimate: 2, workMs: hours(2) }, 'merged'),
    // Cleaned with no merge record: excluded.
    view({ estimate: 5, workMs: hours(10) }, 'cleaned'),
    // Cleaned with a valid merge stamp: included.
    view({ estimate: 1, workMs: hours(1), mergedAt: NOW - DAY }, 'cleaned'),
  ], NOW)
  assert.equal(r.calibration.samples, 2)
  assert.equal(r.calibration.points, 3)
  assert.equal(r.calibration.workMs, hours(3))
})

test('calibration: invalid estimates and work values are ignored, never NaN or Infinity', () => {
  const r = buildProjectInsights([
    mergedTask(1, { estimate: 0 as any, workMs: hours(1) }),
    mergedTask(1, { estimate: 4 as any, workMs: hours(1) }),
    mergedTask(1, { estimate: 'x' as any, workMs: hours(1) }),
    mergedTask(1, { estimate: 3, workMs: -hours(1) }),
    mergedTask(1, { estimate: 3, workMs: Number.NaN }),
    mergedTask(1, { estimate: 3, workMs: Number.POSITIVE_INFINITY }),
    // A start stamp in the future means a zero interval, so no elapsed work.
    mergedTask(1, { estimate: 3, workStartedAt: NOW + hours(1) }),
  ], NOW)
  assert.equal(r.calibration.samples, 0)
  assert.equal(r.calibration.hoursPerPoint, null)
  assert.equal(r.calibration.medianHoursPerPoint, null)
  assert.ok(Number.isFinite(r.calibration.hours))
  assert.ok(Number.isFinite(r.calibration.workMs))
})

test('calibration: a merged task still timing contributes its elapsed value', () => {
  const r = buildProjectInsights([
    mergedTask(1, { estimate: 2, workMs: hours(1), workStartedAt: NOW - hours(0.5) }),
  ], NOW)
  assert.equal(r.calibration.samples, 1)
  assert.equal(r.calibration.workMs, hours(1.5))
  assert.equal(r.calibration.hours, 1.5)
  assert.equal(r.calibration.hoursPerPoint, 0.8)
})

test('calibration: values round to one decimal and totals stay finite at the safe-integer cap', () => {
  const r = buildProjectInsights([
    mergedTask(1, { estimate: 3, workMs: hours(1) }),
    mergedTask(1, { estimate: 3, workMs: hours(2) }),
    mergedTask(1, { estimate: 3, workMs: hours(2) }),
  ], NOW)
  // 5h / 9pt = 0.5555 -> 0.6; median of [0.333, 0.667, 0.667] = 0.7.
  assert.equal(r.calibration.hoursPerPoint, 0.6)
  assert.equal(r.calibration.medianHoursPerPoint, 0.7)

  const huge = buildProjectInsights([
    mergedTask(1, { estimate: 1, workMs: Number.MAX_SAFE_INTEGER }),
    mergedTask(1, { estimate: 1, workMs: Number.MAX_SAFE_INTEGER }),
  ], NOW)
  assert.ok(Number.isFinite(huge.calibration.workMs))
  assert.ok(huge.calibration.workMs <= Number.MAX_SAFE_INTEGER)
  assert.ok(Number.isFinite(huge.calibration.hours))
  assert.ok(Number.isFinite(huge.calibration.hoursPerPoint as number))
})

test('calibration: legacy tasks without the new fields return a zero calibration', () => {
  const legacy = buildProjectInsights([view({}, 'review'), view({}, 'merged')], NOW)
  assert.equal(legacy.calibration.samples, 0)
  assert.equal(legacy.calibration.points, 0)
  assert.equal(legacy.calibration.workMs, 0)
  assert.equal(legacy.calibration.hoursPerPoint, null)
  assert.equal(legacy.calibration.medianHoursPerPoint, null)
  // Existing figures keep working alongside the new field.
  assert.equal(legacy.total, 2)
  assert.equal(legacy.merged, 1)
  assert.equal(legacy.open, 1)
  assert.equal(legacy.daily.length, INSIGHTS_DAYS)
})
