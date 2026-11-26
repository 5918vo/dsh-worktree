import test from 'node:test'
import assert from 'node:assert/strict'
import { buildEstimateCalibration } from '../src/client/estimate-calibration.js'
import type { TaskView } from '../src/models.js'

const HOUR = 3600000
/** Fixed local wall-clock base: no DST transition in June for either hemisphere. */
const NOW = new Date(2026, 5, 15, 12, 0, 0, 0).getTime()

/** Minimal view: the calibration builder only reads `view.task`. */
function view(id: string, estimate: unknown, workMs?: unknown, extra: Record<string, unknown> = {}): TaskView {
  return {
    task: Object.assign({ id, title: 'Task ' + id, estimate, workMs }, extra),
    snapshot: {},
  } as unknown as TaskView
}

function closeTo(actual: number, expected: number, epsilon = 1e-9): void {
  assert.ok(Math.abs(actual - expected) <= epsilon, 'expected ' + actual + ' ~= ' + expected)
}

function assertFiniteNumbers(result: any): void {
  assert.ok(Number.isFinite(result.totalPoints), 'totalPoints must be finite')
  assert.ok(Number.isFinite(result.totalWorkMs), 'totalWorkMs must be finite')
  assert.ok(result.totalWorkMs >= 0, 'totalWorkMs must not be negative')
  if (result.hoursPerPoint != null) assert.ok(Number.isFinite(result.hoursPerPoint), 'hoursPerPoint must be finite')
  for (const sample of result.samples) {
    for (const key of ['estimate', 'workMs', 'hours', 'expectedHours', 'variancePercent']) {
      assert.ok(Number.isFinite(sample[key]), key + ' must be finite')
    }
    assert.ok(sample.workMs > 0, 'workMs must be positive')
    assert.ok(sample.hours > 0, 'hours must be positive')
    assert.ok(sample.expectedHours >= 0, 'expectedHours must not be negative')
  }
}

test('empty and non-array input: no samples, null ratios, low confidence', () => {
  for (const input of [[], null, undefined, 'views', 42, {}]) {
    const r = buildEstimateCalibration(input as any, NOW)
    assert.equal(r.sampleCount, 0)
    assert.deepEqual(r.samples, [])
    assert.equal(r.totalPoints, 0)
    assert.equal(r.totalWorkMs, 0)
    assert.equal(r.hoursPerPoint, null)
    assert.equal(r.confidence, 'low')
    assert.equal(r.estimatedTasks, 0)
    assert.equal(r.totalTasks, 0)
    assert.equal(r.coveragePercent, null)
  }
})

test('invalid estimates are neither samples nor estimated tasks', () => {
  const invalid = ['4', 0, -1, 4.5, 7, NaN, Infinity, true, {}, 'abc', null, undefined, '']
  const views = invalid.map((estimate, index) => view('t' + index, estimate, 2 * HOUR))
  const r = buildEstimateCalibration(views, NOW)
  assert.equal(r.sampleCount, 0)
  assert.equal(r.estimatedTasks, 0)
  assert.equal(r.totalTasks, invalid.length)
  assert.equal(r.coveragePercent, 0)
  assert.equal(r.hoursPerPoint, null)
})

test('a valid estimate without recorded work counts toward coverage but is not a sample', () => {
  const r = buildEstimateCalibration([view('t1', 3, 0), view('t2', 2)], NOW)
  assert.equal(r.sampleCount, 0)
  assert.equal(r.estimatedTasks, 2)
  assert.equal(r.totalTasks, 2)
  assert.equal(r.coveragePercent, 100)
  assert.equal(r.hoursPerPoint, null)
})

test('a running timer contributes its elapsed stretch through the injected clock', () => {
  const r = buildEstimateCalibration([view('t1', 2, 0, { workStartedAt: NOW - 1.5 * HOUR })], NOW)
  assert.equal(r.sampleCount, 1)
  closeTo(r.totalPoints, 2)
  closeTo(r.totalWorkMs, 1.5 * HOUR)
  closeTo(r.hoursPerPoint as number, 0.75)
  closeTo(r.samples[0].hours, 1.5)
  closeTo(r.samples[0].expectedHours, 1.5)
  assert.equal(r.samples[0].variancePercent, 0)
})

test('pooled totals: total points, total work and hours per point', () => {
  const r = buildEstimateCalibration([view('a', 3, 2 * HOUR), view('b', 5, 4 * HOUR)], NOW)
  assert.equal(r.sampleCount, 2)
  assert.equal(r.totalPoints, 8)
  assert.equal(r.totalWorkMs, 6 * HOUR)
  closeTo(r.hoursPerPoint as number, 0.75)
  closeTo(r.samples[0].expectedHours + r.samples[1].expectedHours, 6)
})

test('confidence ladder: 0/2 low, 3/5 medium, 6 high', () => {
  const build = (n: number) => buildEstimateCalibration(
    Array.from({ length: n }, (_value, index) => view('t' + index, 1, HOUR)),
    NOW,
  )
  assert.equal(build(0).confidence, 'low')
  assert.equal(build(2).confidence, 'low')
  assert.equal(build(3).confidence, 'medium')
  assert.equal(build(5).confidence, 'medium')
  assert.equal(build(6).confidence, 'high')
})

test('variance sign and rounding: above, below and near the average', () => {
  // 8 points over 6 hours -> 0.75 h/point, expectations 2.25 h and 3.75 h.
  const r = buildEstimateCalibration([view('a', 3, 2 * HOUR), view('b', 5, 4 * HOUR)], NOW)
  const byId: Record<string, any> = {}
  for (const sample of r.samples) byId[sample.taskId] = sample
  assert.equal(byId.a.variancePercent, -11)
  assert.equal(byId.b.variancePercent, 7)
  // |−11| outranks |7|, so the undershooting task sorts first.
  assert.equal(r.samples[0].taskId, 'a')
  assert.equal(r.samples[1].taskId, 'b')
})

test('samples sort by |variance| desc, then hours desc, then taskId', () => {
  // 3 points over 6 hours -> 2 h/point: 1 h is -50%, 3 h is +50%, 2 h is 0%.
  const r = buildEstimateCalibration([view('a', 1, HOUR), view('b', 1, 3 * HOUR), view('c', 1, 2 * HOUR)], NOW)
  assert.deepEqual(r.samples.map((sample) => sample.taskId), ['b', 'a', 'c'])
  assert.equal(r.samples[0].variancePercent, 50)
  assert.equal(r.samples[1].variancePercent, -50)
  assert.equal(r.samples[2].variancePercent, 0)

  // Identical variance and hours fall back to an ascending task id.
  const tied = buildEstimateCalibration([view('z', 2, 2 * HOUR), view('a', 2, 2 * HOUR)], NOW)
  assert.deepEqual(tied.samples.map((sample) => sample.taskId), ['a', 'z'])
})

test('coverage percent: estimated tasks over all tasks, rounded, null when empty', () => {
  const partial = buildEstimateCalibration([
    view('t1', 3, HOUR),
    view('t2', 2),
    view('t3', null, HOUR),
    view('t4', 'bad', HOUR),
    view('t5', undefined, HOUR),
  ], NOW)
  assert.equal(partial.estimatedTasks, 2)
  assert.equal(partial.totalTasks, 5)
  assert.equal(partial.coveragePercent, 40)

  const third = buildEstimateCalibration([view('a', 1, HOUR), view('b'), view('c')], NOW)
  assert.equal(third.coveragePercent, 33)

  const none = buildEstimateCalibration([view('a'), view('b'), view('c')], NOW)
  assert.equal(none.coveragePercent, 0)
})

test('corrupt work fields are ignored and never leak NaN, Infinity or negatives', () => {
  const r = buildEstimateCalibration([
    view('ok', 2, 2 * HOUR),
    view('nan', 3, NaN),
    view('text', 3, '120'),
    view('negative', 3, -5),
    view('infinite', 3, Infinity),
    view('future', 3, 0, { workStartedAt: NOW + HOUR }),
    view('broken-start', 3, 0, { workStartedAt: 'later' }),
  ], NOW)
  assert.equal(r.sampleCount, 1)
  assert.equal(r.samples[0].taskId, 'ok')
  assertFiniteNumbers(r)
  // Every corrupt row still carries a valid estimate, so coverage counts them.
  assert.equal(r.estimatedTasks, 7)
  assert.equal(r.totalTasks, 7)
  assert.equal(r.coveragePercent, 100)
})

test('huge work values stay finite and bounded', () => {
  const r = buildEstimateCalibration([view('big', 8, Number.MAX_SAFE_INTEGER)], NOW)
  assertFiniteNumbers(r)
  assert.equal(r.sampleCount, 1)
  assert.ok(r.hoursPerPoint != null)
})

test('an invalid `now` falls back to the real clock instead of throwing', () => {
  const startedAt = Date.now() - HOUR
  const r = buildEstimateCalibration([view('t1', 1, 0, { workStartedAt: startedAt })], NaN)
  assert.equal(r.sampleCount, 1)
  assert.ok(r.samples[0].hours >= 1)
  assert.ok(r.samples[0].hours < 2)
  assertFiniteNumbers(r)
})

test('pure: the input views are never mutated', () => {
  const views = [
    view('a', 3, 2 * HOUR, { tags: ['x'], notes: 'n' }),
    view('b', 5, 4 * HOUR),
  ]
  const before = JSON.stringify(views)
  for (const entry of views) Object.freeze((entry as any).task)
  Object.freeze(views[0])
  Object.freeze(views)
  const r = buildEstimateCalibration(views, NOW)
  assert.equal(r.sampleCount, 2)
  assert.equal(JSON.stringify(views), before)
})
