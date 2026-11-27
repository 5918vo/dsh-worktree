import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPortfolio, PORTFOLIO_DAYS } from '../src/client/portfolio.js'
import { buildProjectRisk } from '../src/client/project-risk.js'
import type { ProjectView, TaskSnapshot, TaskStatus, TaskView, WorktreeTask } from '../src/models.js'

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
    createdAt: NOW - 2 * DAY,
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

function projectView(id: string, tasks: TaskView[], name?: string): ProjectView {
  return {
    project: { id, name: name || id, repoPath: 'C:/' + id, baseBranch: 'main', createdAt: NOW - 30 * DAY },
    stats: {} as any,
    tasks,
  }
}

test('empty portfolio: zero totals and seven empty local-day buckets', () => {
  const r = buildPortfolio({ views: [], now: NOW })
  assert.deepEqual(r.projects, [])
  assert.deepEqual(r.ranked, [])
  assert.deepEqual(r.totals, {
    projects: 0,
    open: 0,
    attention: 0,
    overdue: 0,
    blocked: 0,
    review: 0,
    mergedLast7: 0,
    highRisk: 0,
    mediumRisk: 0,
    estimatePoints: 0,
  })
  assert.equal(r.daily.length, PORTFOLIO_DAYS)
  assert.deepEqual(r.daily.map((day) => day.offset), [-6, -5, -4, -3, -2, -1, 0])
  for (const day of r.daily) {
    assert.equal(day.created, 0)
    assert.equal(day.merged, 0)
    assert.equal(new Date(day.start).getHours(), 0)
    assert.equal(new Date(day.start).getMinutes(), 0)
  }
})

test('open counts every unfinished status and excludes merged, cleaned and archived tasks', () => {
  const r = buildPortfolio({
    views: [projectView('p1', [
      view({}, 'ready'),
      view({}, 'developing'),
      view({}, 'review'),
      view({}, 'reviewing'),
      view({}, 'broken'),
      view({ mergedAt: NOW - DAY }, 'merged'),
      view({ cleanedAt: NOW - DAY }, 'cleaned'),
      view({ archivedAt: NOW - DAY }, 'ready'),
    ])],
    now: NOW,
  })
  const row = r.projects[0]
  // broken still counts as open; merged / cleaned / archived do not.
  assert.equal(row.open, 5)
  assert.equal(row.review, 2)
  assert.equal(row.attention, 0)
})

test('archived tasks are excluded from open but still feed the 7-day activity bars', () => {
  const r = buildPortfolio({
    views: [projectView('p1', [
      view({ archivedAt: NOW - DAY, createdAt: noon(-1), mergedAt: noon(-1) }, 'merged'),
    ])],
    now: NOW,
  })
  assert.equal(r.projects[0].open, 0)
  assert.equal(r.projects[0].mergedLast7, 1)
  assert.equal(r.daily[5].created, 1)
  assert.equal(r.daily[5].merged, 1)
})

test('overdue uses dueStateOf and ignores today, future and invalid due dates', () => {
  const r = buildPortfolio({
    views: [projectView('p1', [
      view({ id: 'a', dueAt: NOW - 2 * DAY }),
      view({ id: 'b', dueAt: NOW }),
      view({ id: 'c', dueAt: NOW + 2 * DAY }),
      view({ id: 'd', dueAt: NaN as any }),
      view({ id: 'e', dueAt: 'not-a-date' as any }),
    ])],
    now: NOW,
  })
  assert.equal(r.projects[0].overdue, 1)
  assert.equal(r.totals.overdue, 1)
})

test('blocked counts unfinished and missing prerequisites once per task', () => {
  const openDep = task({ id: 'dep-open' })
  const doneDep = task({ id: 'dep-done', mergedAt: NOW - DAY })
  const r = buildPortfolio({
    views: [projectView('p1', [
      view({ id: 'a', dependsOn: ['dep-open', 'dep-done'] }),
      view({ id: 'b', dependsOn: ['dep-missing'] }),
      view({ id: 'c', dependsOn: ['dep-done'] }),
      { task: openDep, snapshot: snapshot({ status: 'ready' }) },
      { task: doneDep, snapshot: snapshot({ status: 'merged' }) },
    ])],
    now: NOW,
  })
  assert.equal(r.projects[0].blocked, 2)
})

test('attention comes only from the injected callback and counts a task once', () => {
  const views = [projectView('p1', [view({ id: 'a' }), view({ id: 'b' })])]
  const withCallback = buildPortfolio({
    views,
    now: NOW,
    attentionOf: (tv: TaskView) => ({
      categories: tv.task.id === 'a' ? new Set(['overdue', 'pending', 'review']) : new Set<string>(),
    }),
  })
  assert.equal(withCallback.projects[0].attention, 1)
  assert.equal(withCallback.totals.attention, 1)

  const withoutCallback = buildPortfolio({ views, now: NOW })
  assert.equal(withoutCallback.projects[0].attention, 0)

  const nullCallback = buildPortfolio({ views, now: NOW, attentionOf: () => null })
  assert.equal(nullCallback.projects[0].attention, 0)
})

test('risk counts match buildProjectRisk for the same project', () => {
  const tasks = [
    // Broken plus overdue plus blocked: at least medium.
    view({ id: 'a', dueAt: NOW - 10 * DAY, dependsOn: ['missing'] }, 'broken'),
    view({ id: 'b', dueAt: NOW - DAY }, 'review'),
    view({ id: 'c' }, 'developing'),
  ]
  const r = buildPortfolio({ views: [projectView('p1', tasks)], now: NOW })
  const expected = buildProjectRisk(tasks, NOW)
  assert.equal(r.projects[0].highRisk, expected.high)
  assert.equal(r.projects[0].mediumRisk, expected.medium)
  assert.equal(r.totals.highRisk, expected.high)
  assert.equal(r.totals.mediumRisk, expected.medium)
})

test('estimate points sum only valid estimates on open tasks', () => {
  const r = buildPortfolio({
    views: [projectView('p1', [
      view({ id: 'a', estimate: 3 }),
      view({ id: 'b', estimate: 8 }),
      view({ id: 'c', estimate: 4 as any }),
      view({ id: 'd', estimate: 'abc' as any }),
      view({ id: 'e', estimate: null as any }),
      view({ id: 'f', estimate: 13, mergedAt: NOW }, 'merged'),
    ])],
    now: NOW,
  })
  assert.equal(r.projects[0].estimatePoints, 11)
  assert.equal(r.totals.estimatePoints, 11)
})

test('7-day window keeps today and 6 days ago, drops 8 days ago and future stamps', () => {
  const r = buildPortfolio({
    views: [projectView('p1', [
      view({ id: 'a', createdAt: noon(0), mergedAt: noon(0) }, 'merged'),
      view({ id: 'b', createdAt: noon(-6) }),
      view({ id: 'c', createdAt: noon(-8) }),
      view({ id: 'd', createdAt: noon(1) }),
      view({ id: 'e', createdAt: -1 }),
    ])],
    now: NOW,
  })
  assert.equal(r.daily[6].created, 1)
  assert.equal(r.daily[6].merged, 1)
  assert.equal(r.daily[0].created, 1)
  assert.equal(r.daily.reduce((sum, day) => sum + day.created, 0), 2)
  assert.equal(r.daily.reduce((sum, day) => sum + day.merged, 0), 1)
})

test('one task counts in both the created and merged bar of the same day', () => {
  const r = buildPortfolio({
    views: [projectView('p1', [
      view({ createdAt: noon(-2), mergedAt: noon(-2) }, 'merged'),
    ])],
    now: NOW,
  })
  const day = r.daily[4]
  assert.equal(day.created, 1)
  assert.equal(day.merged, 1)
})

test('oldest open days ignore merged and archived tasks and clamp future creation to zero', () => {
  const r = buildPortfolio({
    views: [projectView('p1', [
      view({ id: 'open', createdAt: NOW - 3 * DAY }),
      view({ id: 'future', createdAt: NOW + 5 * DAY }),
      view({ id: 'old', createdAt: NOW - 90 * DAY, mergedAt: NOW - DAY }, 'merged'),
      view({ id: 'arch', createdAt: NOW - 120 * DAY, archivedAt: NOW - DAY }),
    ])],
    now: NOW,
  })
  assert.equal(r.projects[0].oldestOpenDays, 3)

  const futureOnly = buildPortfolio({
    views: [projectView('p1', [view({ createdAt: NOW + 5 * DAY })])],
    now: NOW,
  })
  assert.equal(futureOnly.projects[0].oldestOpenDays, 0)
})

test('ranked sorts by attention, overdue, blocked, open then name without mutating input order', () => {
  const views = [
    projectView('p1', [view({ id: 'a' })], 'Zeta'),
    projectView('p2', [view({ id: 'b', dueAt: NOW - DAY }), view({ id: 'c' })], 'Beta'),
    projectView('p3', [view({ id: 'd', dependsOn: ['missing'] })], 'Alpha'),
    projectView('p4', [view({ id: 'e' })], 'Gamma'),
  ]
  const attentionOf = (tv: TaskView) => ({ categories: tv.task.id === 'e' ? new Set(['pending']) : new Set<string>() })
  const r = buildPortfolio({ views, now: NOW, attentionOf })

  assert.deepEqual(r.projects.map((row) => row.projectId), ['p1', 'p2', 'p3', 'p4'])
  assert.deepEqual(r.ranked.map((row) => row.projectId), ['p4', 'p2', 'p3', 'p1'])
  assert.equal(r.projects.length, 4)
})

test('totals are the sum of every project row', () => {
  const r = buildPortfolio({
    views: [
      projectView('p1', [view({ id: 'a', estimate: 5, dueAt: NOW - DAY })]),
      projectView('p2', [view({ id: 'b', estimate: 2, dependsOn: ['missing'] }), view({ id: 'c', mergedAt: NOW }, 'merged')]),
    ],
    now: NOW,
  })
  assert.equal(r.totals.projects, 2)
  assert.equal(r.totals.open, 2)
  assert.equal(r.totals.overdue, 1)
  assert.equal(r.totals.blocked, 1)
  assert.equal(r.totals.mergedLast7, 1)
  assert.equal(r.totals.estimatePoints, 7)
})

test('corrupt records never produce NaN, Infinity or negative numbers', () => {
  const r = buildPortfolio({
    views: [projectView('p1', [
      view({ id: 'a', createdAt: NaN as any, updatedAt: NaN as any, dueAt: NaN as any, estimate: NaN as any }),
      view({ id: 'b', createdAt: -1, dueAt: -1, estimate: '999999999999999999999' as any }),
      { task: null as any, snapshot: null as any },
    ])],
    now: NOW,
  })
  const row = r.projects[0]
  for (const value of [row.open, row.attention, row.overdue, row.blocked, row.review, row.mergedLast7,
    row.highRisk, row.mediumRisk, row.estimatePoints, r.totals.open, r.totals.estimatePoints]) {
    assert.ok(Number.isFinite(value), 'expected a finite number, got ' + value)
    assert.ok(value >= 0, 'expected a non-negative number, got ' + value)
  }
  assert.ok(row.oldestOpenDays == null || row.oldestOpenDays >= 0)
  for (const day of r.daily) {
    assert.ok(Number.isFinite(day.created) && day.created >= 0)
    assert.ok(Number.isFinite(day.merged) && day.merged >= 0)
  }
})
