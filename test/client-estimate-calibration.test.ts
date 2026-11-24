import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildEstimateCalibration,
  CALIBRATION_MIN_SAMPLES,
  CALIBRATION_SAMPLE_LIMIT,
} from '../src/client/estimate-calibration.js'
import type { TaskSnapshot, TaskStatus, TaskView, WorktreeTask } from '../src/models.js'

/** Fixed instant: no DST transition in June for either hemisphere. */
const NOW = new Date(2026, 5, 15, 15, 30, 0, 0).getTime()
const MINUTE = 60 * 1000

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
    createdAt: NOW - 86400000,
    updatedAt: NOW - 86400000,
    ...over,
  }
}

function snapshot(over: Partial<TaskSnapshot> = {}): TaskSnapshot {
  return {
    worktree: { exists: true, branch: 'dsh/t1', dirtyCount: 0, ahead: 0, commits: [], lastCommitAt: null },
    repo: { exists: true, currentBranch: 'main', dirtyCount: 0 },
    branchExists: true,
    merged: false,
    status: 'developing',
    ...over,
  }
}

function view(over: Partial<WorktreeTask> = {}, status: TaskStatus = 'developing'): TaskView {
  return { task: task(over), snapshot: snapshot({ status }) }
}

test('empty project: zeros, null averages, empty recent', () => {
  const r = buildEstimateCalibration([], NOW)
  assert.equal(r.samples, 0)
  assert.equal(r.points, 0)
  assert.equal(r.workMs, 0)
  assert.equal(r.averageMsPerPoint, null)
  assert.equal(r.medianMsPerPoint, null)
  assert.equal(r.estimated, 0)
  assert.equal(r.timed, 0)
  assert.equal(r.both, 0)
  assert.equal(r.estimateCoveragePercent, null)
  assert.equal(r.timingCoveragePercent, null)
  assert.deepEqual(r.recent, [])
  assert.equal(r.truncated, false)
  // A malformed list is treated as empty instead of throwing.
  assert.deepEqual(buildEstimateCalibration(null as any, NOW).recent, [])
})

test('only estimates: estimated counts, no samples, timing coverage is 0', () => {
  const views = [
    view({ id: 'a', estimate: 2 }),
    view({ id: 'b', estimate: '5' as any }),
  ]
  const r = buildEstimateCalibration(views, NOW)
  assert.equal(r.estimated, 2)
  assert.equal(r.timed, 0)
  assert.equal(r.samples, 0)
  assert.equal(r.both, 0)
  assert.equal(r.points, 0)
  assert.equal(r.workMs, 0)
  assert.equal(r.averageMsPerPoint, null)
  assert.equal(r.estimateCoveragePercent, 100)
  assert.equal(r.timingCoveragePercent, 0)
  assert.deepEqual(r.recent, [])
})

test('only work: timed counts, no samples, estimate coverage is 0', () => {
  const views = [
    view({ id: 'a', workMs: 30 * MINUTE }),
    view({ id: 'b', workMs: 45 * MINUTE }),
  ]
  const r = buildEstimateCalibration(views, NOW)
  assert.equal(r.estimated, 0)
  assert.equal(r.timed, 2)
  assert.equal(r.samples, 0)
  assert.equal(r.estimateCoveragePercent, 0)
  assert.equal(r.timingCoveragePercent, 100)
})

test('both fields: one sample per task, totals summed once', () => {
  const views = [
    view({ id: 'a', title: 'A', estimate: 2, workMs: 2 * 60 * MINUTE }),
    view({ id: 'b', title: 'B', estimate: 3, workMs: 90 * MINUTE }),
    view({ id: 'c', title: 'C', estimate: 2 }), // estimate only
    view({ id: 'd', title: 'D', workMs: 15 * MINUTE }), // work only
  ]
  const r = buildEstimateCalibration(views, NOW)
  assert.equal(r.samples, 2)
  assert.equal(r.both, 2)
  assert.equal(r.estimated, 3)
  assert.equal(r.timed, 3)
  assert.equal(r.points, 5)
  assert.equal(r.workMs, 210 * MINUTE)
  assert.equal(r.recent.length, 2)
  assert.equal(r.estimateCoveragePercent, 75)
  assert.equal(r.timingCoveragePercent, 75)
})

test('1 and 2 samples: averages stay null below the threshold', () => {
  const one = buildEstimateCalibration([view({ id: 'a', estimate: 1, workMs: 50 * MINUTE })], NOW)
  assert.equal(one.samples, 1)
  assert.equal(one.averageMsPerPoint, null)
  assert.equal(one.medianMsPerPoint, null)

  const two = buildEstimateCalibration([
    view({ id: 'a', estimate: 1, workMs: 50 * MINUTE }),
    view({ id: 'b', estimate: 2, workMs: 3 * 60 * MINUTE }),
  ], NOW)
  assert.equal(two.samples, 2)
  assert.equal(two.averageMsPerPoint, null)
  assert.equal(two.medianMsPerPoint, null)
})

test('3 samples: average and odd median use the shared totals', () => {
  const views = [
    view({ id: 'a', estimate: 1, workMs: 1000 }),
    view({ id: 'b', estimate: 2, workMs: 3000 }),
    view({ id: 'c', estimate: 3, workMs: 4000 }),
  ]
  const r = buildEstimateCalibration(views, NOW)
  assert.equal(r.samples, CALIBRATION_MIN_SAMPLES)
  // 8000 ms / 6 points = 1333.33 -> 1333
  assert.equal(r.averageMsPerPoint, 1333)
  // msPerPoint 1000, 1500, 1333.33 -> median 1333.33 -> 1333
  assert.equal(r.medianMsPerPoint, 1333)
})

test('4 samples: even median averages the middle two and rounds', () => {
  const views = [
    view({ id: 'a', estimate: 1, workMs: 1000 }),
    view({ id: 'b', estimate: 1, workMs: 2000 }),
    view({ id: 'c', estimate: 1, workMs: 3000 }),
    view({ id: 'd', estimate: 1, workMs: 4000 }),
  ]
  const r = buildEstimateCalibration(views, NOW)
  assert.equal(r.samples, 4)
  assert.equal(r.averageMsPerPoint, 2500)
  assert.equal(r.medianMsPerPoint, 2500)

  // Odd sums: (2001 + 3000) / 2 = 2500.5 -> 2501 (Math.round).
  const odd = buildEstimateCalibration([
    view({ id: 'a', estimate: 1, workMs: 1000 }),
    view({ id: 'b', estimate: 1, workMs: 2001 }),
    view({ id: 'c', estimate: 1, workMs: 3000 }),
    view({ id: 'd', estimate: 1, workMs: 9999 }),
  ], NOW)
  assert.equal(odd.medianMsPerPoint, 2501)
})

test('rounding: average is rounded to whole milliseconds', () => {
  const views = [
    view({ id: 'a', estimate: 1, workMs: 1000 }),
    view({ id: 'b', estimate: 1, workMs: 1001 }),
    view({ id: 'c', estimate: 1, workMs: 1001 }),
  ]
  const r = buildEstimateCalibration(views, NOW)
  assert.equal(r.averageMsPerPoint, 1001) // 3002 / 3 = 1000.66 -> 1001
  assert.ok(Number.isInteger(r.averageMsPerPoint))
  assert.ok(Number.isInteger(r.medianMsPerPoint))
})

test('running timer: the live interval is included and the sample is marked', () => {
  const views = [
    view({ id: 'a', estimate: 1, workMs: 30 * MINUTE, workStartedAt: NOW - 15 * MINUTE }),
    view({ id: 'b', estimate: 1, workMs: 20 * MINUTE }),
    view({ id: 'c', estimate: 1, workMs: 10 * MINUTE }),
  ]
  const r = buildEstimateCalibration(views, NOW)
  assert.equal(r.samples, 3)
  assert.equal(r.workMs, 75 * MINUTE)
  const running = r.recent.filter((sample) => sample.running)
  assert.equal(running.length, 1)
  assert.equal(running[0].taskId, 'a')
  assert.equal(running[0].workMs, 45 * MINUTE)
  assert.equal(running[0].msPerPoint, 45 * MINUTE)
})

test('invalid estimates are ignored by name and by sample', () => {
  const views = [
    view({ id: 'zero', estimate: 0 as any }),
    view({ id: 'four', estimate: 4 as any }),
    view({ id: 'text', estimate: 'abc' as any }),
    view({ id: 'bool', estimate: true as any }),
    view({ id: 'empty', estimate: null as any }),
    view({ id: 'ok', estimate: 2 }),
  ]
  const r = buildEstimateCalibration(views, NOW)
  assert.equal(r.estimated, 1)
  assert.equal(r.samples, 0)
  assert.equal(r.estimateCoveragePercent, 17) // 1 / 6
})

test('negative, NaN and non-numeric work never produce a sample', () => {
  const views = [
    view({ id: 'neg', estimate: 2, workMs: -5000 }),
    view({ id: 'nan', estimate: 2, workMs: Number.NaN }),
    view({ id: 'inf', estimate: 2, workMs: Number.POSITIVE_INFINITY }),
    view({ id: 'text', estimate: 2, workMs: '9000' as any }),
    view({ id: 'zero', estimate: 2, workMs: 0 }),
  ]
  const r = buildEstimateCalibration(views, NOW)
  assert.equal(r.timed, 0)
  assert.equal(r.samples, 0)
  assert.equal(r.workMs, 0)
  assert.deepEqual(r.recent, [])
  for (const sample of r.recent) assert.ok(sample.workMs > 0)
})

test('future timer start is ignored and never yields a negative interval', () => {
  const views = [
    view({ id: 'future', estimate: 2, workStartedAt: NOW + 60 * MINUTE }),
    view({ id: 'futureWithRecord', estimate: 1, workMs: 10 * MINUTE, workStartedAt: NOW + 60 * MINUTE }),
    view({ id: 'ok', estimate: 1, workMs: 20 * MINUTE }),
  ]
  const r = buildEstimateCalibration(views, NOW)
  assert.equal(r.timed, 2) // the future-only timer has 0 elapsed work
  assert.equal(r.samples, 2)
  assert.equal(r.workMs, 30 * MINUTE)
  for (const sample of r.recent) assert.ok(sample.workMs > 0 && sample.msPerPoint > 0)
  assert.equal(r.recent.find((sample) => sample.taskId === 'futureWithRecord').workMs, 10 * MINUTE)
})

test('sample sorting: msPerPoint desc, then points desc, title, id', () => {
  const views = [
    view({ id: 'a', title: 'Beta', estimate: 1, workMs: 5000 }),
    view({ id: 'b', title: 'Alpha', estimate: 2, workMs: 10000 }), // same rate, more points -> first
    view({ id: 'c', title: 'Gamma', estimate: 1, workMs: 9000 }),
    view({ id: 'd', title: 'Alpha', estimate: 1, workMs: 5000 }), // same rate/points/title as a -> id order
    view({ id: 'e', title: 'Delta', estimate: 1, workMs: 5000 }),
  ]
  const r = buildEstimateCalibration(views, NOW)
  assert.deepEqual(r.recent.map((sample) => sample.taskId), ['c', 'b', 'd', 'a', 'e'])
})

test('truncation: totals keep every sample, recent stops at the limit', () => {
  const views = Array.from({ length: 8 }, (_, index) => view({
    id: 't' + index,
    title: 'T' + index,
    estimate: 1,
    workMs: (index + 1) * MINUTE,
  }))
  const r = buildEstimateCalibration(views, NOW)
  assert.equal(r.samples, 8)
  assert.equal(r.both, 8)
  assert.equal(r.recent.length, CALIBRATION_SAMPLE_LIMIT)
  assert.equal(r.truncated, true)
  assert.equal(r.workMs, 36 * MINUTE)
  // Nine or fewer samples never truncate.
  const five = buildEstimateCalibration(views.slice(0, 5), NOW)
  assert.equal(five.recent.length, 5)
  assert.equal(five.truncated, false)
})

test('coverage: null without tasks, otherwise integer percentages', () => {
  const empty = buildEstimateCalibration([], NOW)
  assert.equal(empty.estimateCoveragePercent, null)
  assert.equal(empty.timingCoveragePercent, null)

  const views = [
    view({ id: 'a', estimate: 1, workMs: 1000 }),
    view({ id: 'b', estimate: 2, workMs: 2000 }),
    view({ id: 'c', estimate: 3 }),
    view({ id: 'd' }),
    view({ id: 'e' }),
    view({ id: 'f' }),
  ]
  const r = buildEstimateCalibration(views, NOW)
  assert.equal(r.estimateCoveragePercent, 50)
  assert.equal(r.timingCoveragePercent, 33) // 2 / 6
  for (const percent of [r.estimateCoveragePercent, r.timingCoveragePercent]) {
    assert.ok(Number.isInteger(percent))
    assert.ok(percent >= 0 && percent <= 100)
  }
})

test('determinism: identical input yields deep-equal output', () => {
  const views = [
    view({ id: 'a', title: 'A', estimate: 2, workMs: 3 * MINUTE }),
    view({ id: 'b', title: 'B', estimate: 3, workMs: 4 * MINUTE }),
    view({ id: 'c', title: 'C', estimate: 5, workMs: 9 * MINUTE }),
  ]
  assert.deepEqual(buildEstimateCalibration(views, NOW), buildEstimateCalibration(views, NOW))
})
