import test from 'node:test'
import assert from 'node:assert/strict'
import { ACTIVITY_WEEKS, buildProjectActivity } from '../src/client/project-activity.js'
import type { TaskView, WorktreeTask } from '../src/models.js'

const DAY = 86400000
/** Fixed local wall-clock base: mid-June, no DST transition for either hemisphere. */
const NOW = new Date(2026, 5, 17, 15, 30, 0, 0).getTime()

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

function view(over: Partial<WorktreeTask> = {}): TaskView {
  return { task: task(over), snapshot: { status: 'review' } as any }
}

/** Local midnight of the day `offset` days from `now`. */
function localMidnight(now: number, offset: number): number {
  const date = new Date(now)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset).getTime()
}

/** Local noon of the day `offset` days from `now`. */
function noon(now: number, offset: number): number {
  const date = new Date(now)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset, 12).getTime()
}

function keyOf(value: number): string {
  const date = new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

test('84 cells, 12 Monday-first columns, contiguous local midnights', () => {
  const r = buildProjectActivity([], NOW)
  assert.equal(r.weeks, ACTIVITY_WEEKS)
  assert.equal(r.days.length, ACTIVITY_WEEKS * 7)
  assert.equal(r.start, r.days[0].start)
  assert.equal(r.end, r.days[83].start)
  assert.equal(new Date(r.days[0].start).getDay(), 1)
  assert.equal(new Date(r.days[83].start).getDay(), 0)
  for (let i = 0; i < r.days.length; i += 1) {
    const day = r.days[i]
    assert.equal(day.offset, i)
    assert.equal(day.week, Math.floor(i / 7))
    assert.equal(day.weekday, i % 7)
    assert.equal(day.start, localMidnight(r.start, i))
    assert.equal(new Date(day.start).getHours(), 0)
    assert.equal(day.total, day.created + day.merged + day.updated)
  }
  assert.equal(new Date(r.start).getHours(), 0)
})

test('a timestamp near a UTC date boundary still lands on the local day', () => {
  // Local 00:01 is the previous UTC day east of Greenwich; local 23:59 is the
  // next UTC day west of it. At least one of the two crosses the UTC boundary.
  const early = new Date(2026, 5, 10, 0, 1).getTime()
  const late = new Date(2026, 5, 10, 23, 59).getTime()
  const earlyRun = buildProjectActivity([view({ createdAt: early, updatedAt: 1 })], NOW)
  const earlyDay = earlyRun.days.find((day) => day.dateKey === keyOf(early))
  assert.ok(earlyDay, 'early event should land on its local calendar day')
  assert.equal(earlyDay.dateKey, '2026-06-10')
  assert.equal(earlyDay.created, 1)

  const lateRun = buildProjectActivity([view({ createdAt: late, updatedAt: 1 })], NOW)
  const lateDay = lateRun.days.find((day) => day.dateKey === keyOf(late))
  assert.ok(lateDay, 'late event should land on its local calendar day')
  assert.equal(lateDay.dateKey, '2026-06-10')
  assert.equal(lateDay.created, 1)

  // When the UTC calendar day differs, the bucket must follow local time.
  for (const value of [early, late]) {
    const r = buildProjectActivity([view({ createdAt: value, updatedAt: 1 })], NOW)
    const localKey = keyOf(value)
    const utc = new Date(value)
    const utcKey = `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, '0')}-${String(utc.getUTCDate()).padStart(2, '0')}`
    if (utcKey !== localKey) {
      const day = r.days.find((entry) => entry.dateKey === localKey)
      assert.ok(day, `local day ${localKey} should exist in the grid`)
    }
  }
})

test('the grid aligns across a year boundary and starts on a Monday', () => {
  const now = new Date(2027, 0, 5, 9, 0, 0, 0).getTime()
  const r = buildProjectActivity([], now)
  assert.equal(r.days.length, 84)
  assert.equal(new Date(r.days[0].start).getDay(), 1)
  assert.ok(r.days[0].dateKey.startsWith('2026-'))
  assert.ok(r.days[83].dateKey.startsWith('2027-'))
  assert.ok(r.days.some((day) => day.dateKey === '2026-12-31'))
  assert.ok(r.days.some((day) => day.dateKey === '2027-01-01'))
})

test('cells after today are future: hidden, zero counts, trailing only', () => {
  const r = buildProjectActivity([view({ createdAt: noon(NOW, -1), updatedAt: 1 })], NOW)
  const todayKey = keyOf(NOW)
  const todayIndex = r.days.findIndex((day) => day.dateKey === todayKey)
  assert.ok(todayIndex >= 0)
  for (let i = 0; i < r.days.length; i += 1) {
    const day = r.days[i]
    assert.equal(day.future, i > todayIndex)
    if (day.future) {
      assert.equal(day.total, 0)
      assert.equal(day.created, 0)
      assert.equal(day.merged, 0)
      assert.equal(day.updated, 0)
    }
  }
  assert.equal(r.days[todayIndex].future, false)
})

test('created, merged and updated are independent counts on the same day', () => {
  const at = noon(NOW, -2)
  const r = buildProjectActivity([
    view({ createdAt: at, mergedAt: at, updatedAt: at }),
  ], NOW)
  const day = r.days.find((entry) => entry.dateKey === keyOf(at))
  assert.ok(day)
  assert.equal(day.created, 1)
  assert.equal(day.merged, 1)
  assert.equal(day.updated, 1)
  assert.equal(day.total, 3)
  assert.equal(r.total, 3)
})

test('invalid, negative and future timestamps are ignored', () => {
  const r = buildProjectActivity([
    view({ createdAt: -1, mergedAt: NaN, updatedAt: 0 }),
    view({ id: 't2', createdAt: 'nope' as any, mergedAt: Infinity as any, updatedAt: null as any }),
    view({ id: 't3', createdAt: NOW + DAY, mergedAt: NOW + 2 * DAY, updatedAt: NOW + DAY / 2 }),
  ], NOW)
  assert.equal(r.total, 0)
  for (const day of r.days) assert.equal(day.total, 0)
})

test('intensity scales 1..4 against the busiest day', () => {
  const targets = [1, 2, 3, 4]
  const views: TaskView[] = []
  targets.forEach((count, index) => {
    const at = noon(NOW, -(70 + index))
    for (let n = 0; n < count; n += 1) {
      views.push(view({ id: `t-${index}-${n}`, createdAt: at, updatedAt: 1 }))
    }
  })
  const r = buildProjectActivity(views, NOW)
  assert.equal(r.max, 4)
  targets.forEach((count, index) => {
    const day = r.days.find((entry) => entry.dateKey === keyOf(noon(NOW, -(70 + index))))
    assert.ok(day)
    assert.equal(day.total, count)
    assert.equal(day.intensity, count)
  })
  assert.equal(r.days.filter((day) => day.intensity === 0).length, 84 - targets.length)
})

test('max = 0 leaves every intensity at 0', () => {
  const r = buildProjectActivity([], NOW)
  assert.equal(r.total, 0)
  assert.equal(r.max, 0)
  for (const day of r.days) assert.equal(day.intensity, 0)
})

test('injecting now moves the same task to a different column', () => {
  const created = noon(NOW, -20)
  const a = buildProjectActivity([view({ createdAt: created, updatedAt: 1 })], NOW)
  const b = buildProjectActivity([view({ createdAt: created, updatedAt: 1 })], NOW + 7 * DAY)
  const dayA = a.days.find((day) => day.dateKey === keyOf(created))
  const dayB = b.days.find((day) => day.dateKey === keyOf(created))
  assert.ok(dayA && dayB)
  assert.equal(dayA.created, 1)
  assert.equal(dayB.created, 1)
  assert.equal(dayA.offset, dayB.offset + 7)
})

test('empty and non-array inputs are safe', () => {
  for (const input of [[], null as any, undefined as any]) {
    const r = buildProjectActivity(input, NOW)
    assert.equal(r.days.length, 84)
    assert.equal(r.total, 0)
    assert.equal(r.max, 0)
  }
  for (const input of [[null as any, {} as any, { task: null } as any]]) {
    const r = buildProjectActivity(input, NOW)
    assert.equal(r.total, 0)
  }
})

test('a non-finite now falls back to the wall clock without throwing', () => {
  for (const bad of [NaN, Infinity, -Infinity]) {
    const r = buildProjectActivity([], bad)
    assert.equal(r.days.length, 84)
    assert.equal(new Date(r.days[0].start).getDay(), 1)
  }
})
