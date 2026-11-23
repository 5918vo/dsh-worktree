import test from 'node:test'
import assert from 'node:assert/strict'
import {
  elapsedWorkMs,
  formatWorkDuration,
  hasWorkRecord,
  isWorkTiming,
  startWorkTimer,
  stopWorkTimer,
} from '../src/task-timer.js'

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

// Every case injects `now`, so no assertion depends on the real clock.

test('a task without timer fields reads as zero and as never timed', () => {
  assert.equal(elapsedWorkMs({}), 0)
  assert.equal(elapsedWorkMs({ workMs: undefined, workStartedAt: undefined }), 0)
  assert.equal(isWorkTiming({}), false)
  assert.equal(hasWorkRecord({}), false)
})

test('elapsed time is the recorded total plus the running interval', () => {
  assert.equal(elapsedWorkMs({ workMs: 2 * HOUR }), 2 * HOUR)
  assert.equal(elapsedWorkMs({ workStartedAt: 1000 }, 1000 + MINUTE), MINUTE)
  assert.equal(elapsedWorkMs({ workMs: MINUTE, workStartedAt: 1000 }, 1000 + MINUTE), 2 * MINUTE)
  assert.equal(isWorkTiming({ workStartedAt: 1000 }), true)
  assert.equal(hasWorkRecord({ workStartedAt: 1000 }), true)
})

test('a running interval never goes negative when the clock moves backwards', () => {
  // The start stamp is later than `now`: skew must clamp to 0, not subtract.
  assert.equal(elapsedWorkMs({ workMs: MINUTE, workStartedAt: 10 * MINUTE }, 5 * MINUTE), MINUTE)
  assert.equal(elapsedWorkMs({ workStartedAt: 10 * MINUTE }, 0), 0)
})

test('broken timer fields are ignored instead of leaking NaN or Infinity', () => {
  for (const bad of ['soon' as any, NaN, Infinity, -1, null, {} as any, [] as any]) {
    assert.equal(elapsedWorkMs({ workMs: bad }, 1000), 0, `workMs ${String(bad)}`)
    assert.equal(isWorkTiming({ workStartedAt: bad }), false, `workStartedAt ${String(bad)}`)
    assert.equal(elapsedWorkMs({ workStartedAt: bad }, 1000), 0)
    assert.equal(formatWorkDuration(bad), '不足 1 分')
  }
  assert.equal(elapsedWorkMs({ workMs: -MINUTE, workStartedAt: -1 }, 1000), 0)
})

test('totals saturate at the safe integer limit', () => {
  const huge = Number.MAX_SAFE_INTEGER
  assert.equal(elapsedWorkMs({ workMs: huge, workStartedAt: 1 }, 1000), huge)
  assert.equal(elapsedWorkMs({ workMs: Number.MAX_VALUE }, 1000), huge)
  assert.equal(stopWorkTimer({ workMs: huge, workStartedAt: 1 }, 1000).workMs, huge)
})

test('starting stamps the clock once and keeps the accumulated total', () => {
  const first = startWorkTimer({ workMs: MINUTE }, 5000)
  assert.deepEqual(first, { workMs: MINUTE, workStartedAt: 5000 })

  // Starting twice must not restart the interval.
  const again = startWorkTimer({ workMs: MINUTE, workStartedAt: 5000 }, 9000)
  assert.deepEqual(again, { workMs: MINUTE, workStartedAt: 5000 })

  // A corrupt total does not block a fresh start.
  assert.deepEqual(startWorkTimer({ workMs: 'x' as any }, 1000), { workMs: 0, workStartedAt: 1000 })
})

test('stopping folds the interval in and drops the start stamp', () => {
  assert.deepEqual(stopWorkTimer({ workMs: MINUTE, workStartedAt: 1000 }, 1000 + 30 * SECOND), {
    workMs: 90 * SECOND,
    workStartedAt: undefined,
  })
  // Idle: unchanged total, still no start stamp.
  assert.deepEqual(stopWorkTimer({ workMs: MINUTE }, 10 * MINUTE), { workMs: MINUTE, workStartedAt: undefined })
  // Clock skew: this stretch counts as 0, the recorded total survives.
  assert.deepEqual(stopWorkTimer({ workMs: MINUTE, workStartedAt: 10 * MINUTE }, MINUTE), {
    workMs: MINUTE,
    workStartedAt: undefined,
  })
})

test('the timer helpers never mutate the task they are given', () => {
  const task = { workMs: MINUTE, workStartedAt: 1000 }
  startWorkTimer(task, 2000)
  stopWorkTimer(task, 2000)
  elapsedWorkMs(task, 2000)
  assert.deepEqual(task, { workMs: MINUTE, workStartedAt: 1000 })
})

test('two start/stop cycles equal the sum of both stretches', () => {
  const first = startWorkTimer({}, 1000)
  assert.equal(first.workStartedAt, 1000)
  let total: any = stopWorkTimer(first, 1000 + 10 * MINUTE)
  assert.equal(total.workMs, 10 * MINUTE)
  total = startWorkTimer(total, 1000 + 20 * MINUTE)
  assert.equal(total.workStartedAt, 1000 + 20 * MINUTE)
  total = stopWorkTimer(total, 1000 + 25 * MINUTE)
  assert.equal(total.workMs, 15 * MINUTE)
})

test('durations format in whole minutes, hours and days', () => {
  assert.equal(formatWorkDuration(0), '不足 1 分')
  assert.equal(formatWorkDuration(59 * SECOND), '不足 1 分')
  assert.equal(formatWorkDuration(MINUTE), '1 分')
  assert.equal(formatWorkDuration(45 * MINUTE), '45 分')
  assert.equal(formatWorkDuration(59 * MINUTE), '59 分')
  assert.equal(formatWorkDuration(HOUR), '1 小时')
  assert.equal(formatWorkDuration(2 * HOUR + 15 * MINUTE), '2 小时 15 分')
  assert.equal(formatWorkDuration(25 * HOUR), '1 天 1 小时')
  assert.equal(formatWorkDuration(3 * DAY + 4 * HOUR), '3 天 4 小时')
  assert.equal(formatWorkDuration(5 * DAY), '5 天')
  // Sub-minute remainders are dropped, not rounded up.
  assert.equal(formatWorkDuration(HOUR + 59 * SECOND), '1 小时')
})
