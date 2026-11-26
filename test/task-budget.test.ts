import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BUDGET_MAX_HOURS,
  BUDGET_MIN_HOURS,
  budgetHoursText,
  parseWorkBudgetHours,
  workBudgetMsOf,
  workBudgetProgress,
} from '../src/task-budget.js'

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

// Every case injects `now`, so no assertion depends on the real clock.

test('null, undefined and empty input clear the budget', () => {
  for (const value of [null, undefined, '', '   ']) {
    assert.deepEqual(parseWorkBudgetHours(value), { ok: true, value: null }, JSON.stringify(value))
  }
})

test('the accepted range is inclusive at 0.25 and 1000 hours', () => {
  assert.deepEqual(parseWorkBudgetHours(BUDGET_MIN_HOURS), { ok: true, value: 0.25 })
  assert.deepEqual(parseWorkBudgetHours(BUDGET_MAX_HOURS), { ok: true, value: 1000 })
  assert.deepEqual(parseWorkBudgetHours('0.25'), { ok: true, value: 0.25 })
  assert.deepEqual(parseWorkBudgetHours('1000'), { ok: true, value: 1000 })
  assert.deepEqual(parseWorkBudgetHours(0.249), { ok: false })
  assert.deepEqual(parseWorkBudgetHours(1000.01), { ok: false })
})

test('zero, negatives and non-finite numbers are rejected', () => {
  for (const value of [0, -1, -0.25, NaN, Infinity, -Infinity]) {
    assert.deepEqual(parseWorkBudgetHours(value), { ok: false }, String(value))
  }
})

test('booleans, objects, arrays and non-numeric text are rejected', () => {
  for (const value of [true, false, {}, [], { hours: 4 }, [4], 'abc', '4h']) {
    assert.deepEqual(parseWorkBudgetHours(value), { ok: false }, JSON.stringify(value))
  }
})

test('valid hours round to two decimals', () => {
  assert.deepEqual(parseWorkBudgetHours(1.234), { ok: true, value: 1.23 })
  assert.deepEqual(parseWorkBudgetHours(1.235), { ok: true, value: 1.24 })
  assert.deepEqual(parseWorkBudgetHours('3'), { ok: true, value: 3 })
  assert.deepEqual(parseWorkBudgetHours(' 2.5 '), { ok: true, value: 2.5 })
})

test('workBudgetMsOf returns milliseconds only for a valid budget', () => {
  assert.equal(workBudgetMsOf({ workBudgetHours: 2 }), 2 * HOUR)
  assert.equal(workBudgetMsOf({ workBudgetHours: '0.25' }), 15 * MINUTE)
  assert.equal(workBudgetMsOf({}), null)
  assert.equal(workBudgetMsOf(null), null)
  assert.equal(workBudgetMsOf({ workBudgetHours: 0 }), null)
  assert.equal(workBudgetMsOf({ workBudgetHours: 'nope' }), null)
})

test('progress is under when little time is spent', () => {
  const progress = workBudgetProgress({ workBudgetHours: 2 }, 1_000_000)
  assert.ok(progress)
  assert.equal(progress.budgetMs, 2 * HOUR)
  assert.equal(progress.spentMs, 0)
  assert.equal(progress.percent, 0)
  assert.equal(progress.state, 'under')
  assert.equal(progress.remainingMs, 2 * HOUR)
  assert.equal(progress.overMs, 0)

  const half = workBudgetProgress({ workBudgetHours: 1, workMs: 30 * MINUTE }, 1_000_000)
  assert.ok(half)
  assert.equal(half.percent, 50)
  assert.equal(half.state, 'under')
  assert.equal(half.remainingMs, 30 * MINUTE)
})

test('progress is near from 80% but not over at exactly 100%', () => {
  const near = workBudgetProgress({ workBudgetHours: 10, workMs: 8 * HOUR }, 1_000_000)
  assert.ok(near)
  assert.equal(near.percent, 80)
  assert.equal(near.state, 'near')

  const exact = workBudgetProgress({ workBudgetHours: 1, workMs: HOUR }, 1_000_000)
  assert.ok(exact)
  assert.equal(exact.percent, 100)
  assert.equal(exact.state, 'near')
  assert.equal(exact.overMs, 0)
  assert.equal(exact.remainingMs, 0)
})

test('a running timer counts and a spurious future start never goes negative', () => {
  const now = 10 * HOUR
  const running = workBudgetProgress({ workBudgetHours: 1, workMs: 30 * MINUTE, workStartedAt: now - 45 * MINUTE }, now)
  assert.ok(running)
  assert.equal(running.spentMs, 75 * MINUTE)
  assert.equal(running.percent, 125)

  // Clock skew: the start stamp is ahead of `now`, so the interval is 0.
  const skewed = workBudgetProgress({ workBudgetHours: 1, workStartedAt: now + 5 * MINUTE }, now)
  assert.ok(skewed)
  assert.equal(skewed.spentMs, 0)
  assert.equal(skewed.percent, 0)
  assert.equal(skewed.state, 'under')
})

test('over budget reports the percentage and the overrun', () => {
  const progress = workBudgetProgress({ workBudgetHours: 1, workMs: HOUR + 30 * MINUTE }, 1_000_000)
  assert.ok(progress)
  assert.equal(progress.state, 'over')
  assert.equal(progress.percent, 150)
  assert.equal(progress.overMs, 30 * MINUTE)
  assert.equal(progress.remainingMs, 0)
})

test('no budget means no progress at all', () => {
  assert.equal(workBudgetProgress({}), null)
  assert.equal(workBudgetProgress(null), null)
  assert.equal(workBudgetProgress({ workBudgetHours: 'bad', workMs: HOUR }), null)
})

test('budgetHoursText drops trailing zeros', () => {
  assert.equal(budgetHoursText(4), '4')
  assert.equal(budgetHoursText(4.5), '4.5')
  assert.equal(budgetHoursText(0.25), '0.25')
  assert.equal(budgetHoursText(1000), '1000')
  assert.equal(budgetHoursText(0), '')
  assert.equal(budgetHoursText(NaN), '')
})
