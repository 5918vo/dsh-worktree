import test from 'node:test'
import assert from 'node:assert/strict'
import zh from '../locale/zh.json'
import en from '../locale/en.json'
import {
  DIGEST_EVENT_LIMIT,
  DIGEST_WINDOW_DEFAULT,
  buildProjectDigest,
  buildProjectDigestReport,
  digestFilename,
  isDigestWindow,
} from '../src/client/project-digest.js'
import { reportTimestamp } from '../src/client/markdown.js'
import type { Project, TaskView, WorktreeTask } from '../src/models.js'

/** Local noon, so the fixed clock is inside the same local day everywhere. */
const NOW = new Date(2026, 0, 8, 12, 0, 0).getTime()
const DAY = 86_400_000

/** Local midnight `offset` days from NOW (DST-safe by construction). */
function midnight(offset: number): number {
  const date = new Date(NOW)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset).getTime()
}

function project(over: Partial<Project> = {}): Project {
  return {
    id: 'abcdef12-3456-7890-abcd-ef1234567890',
    name: 'Demo Project',
    repoPath: 'C:/repo',
    baseBranch: 'main',
    createdAt: 1,
    ...over,
  }
}

function task(over: Partial<WorktreeTask> = {}): WorktreeTask {
  return {
    id: 't1',
    projectId: 'p1',
    title: 'Task one',
    description: 'd',
    repoPath: 'C:/repo',
    baseBranch: 'main',
    branch: 'dsh/one',
    worktreePath: 'C:/wt',
    sessionId: null,
    firstPrompt: '',
    startOnBind: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  }
}

function snapshot(over: any = {}) {
  return {
    worktree: { exists: true, branch: 'dsh/one', dirtyCount: 0, ahead: 0, commits: [], lastCommitAt: null },
    repo: { exists: true, currentBranch: 'main', dirtyCount: 0 },
    branchExists: true,
    merged: false,
    status: 'review',
    ...over,
  }
}

function view(over: Partial<WorktreeTask> = {}, snap: any = {}): TaskView {
  return { task: task(over), snapshot: snapshot(snap) }
}

function digest(views: TaskView[], windowDays?: unknown, now = NOW) {
  return buildProjectDigest(views, windowDays, now)
}

test('digest: empty project is all zero and still carries a window', () => {
  const result = digest([])
  assert.equal(result.windowDays, DIGEST_WINDOW_DEFAULT)
  assert.equal(result.created, 0)
  assert.equal(result.merged, 0)
  assert.equal(result.cleaned, 0)
  assert.equal(result.archived, 0)
  assert.equal(result.changed, 0)
  assert.equal(result.deliveredWorkMs, 0)
  assert.equal(result.deliveredPoints, 0)
  assert.equal(result.deliveredEstimated, 0)
  assert.equal(result.open, 0)
  assert.equal(result.overdueOpen, 0)
  assert.equal(result.stalledOpen, 0)
  assert.equal(result.acceptanceChecked, 0)
  assert.equal(result.acceptanceTotal, 0)
  assert.deepEqual(result.events, [])
  assert.equal(result.truncated, false)
  assert.ok(result.start < result.end)
  assert.equal(result.start, midnight(-6))
  assert.equal(result.end, midnight(1))
})

test('digest: window is a half-open range of local calendar days', () => {
  const start = midnight(-6)
  const cases: Array<{ at: number; inside: boolean; label: string }> = [
    { at: midnight(0), inside: true, label: "today's midnight" },
    { at: start, inside: true, label: 'first day midnight' },
    { at: start - 1, inside: false, label: 'one ms before the window' },
    { at: midnight(1), inside: false, label: "tomorrow's midnight" },
  ]
  for (const item of cases) {
    const result = digest([view({ createdAt: item.at })])
    assert.equal(result.events.length, item.inside ? 1 : 0, item.label)
    if (item.inside) {
      assert.equal(result.created, 1, item.label)
      assert.equal(result.events[0].at, item.at, item.label)
    } else {
      assert.equal(result.created, 0, item.label)
    }
  }
})

test('digest: 7 / 14 / 30 day windows include different event ranges', () => {
  const late = view({ id: 'late', title: 'Late', createdAt: midnight(-5) })
  const twoWeeks = view({ id: 'two', title: 'Two weeks', createdAt: midnight(-13) })
  const month = view({ id: 'month', title: 'Month', createdAt: midnight(-29) })
  const ages = view({ id: 'ages', title: 'Ages', createdAt: midnight(-40) })
  const views = [late, twoWeeks, month, ages]

  assert.equal(digest(views, 7).created, 1)
  assert.equal(digest(views, 14).created, 2)
  assert.equal(digest(views, 30).created, 3)
  assert.equal(digest(views, 7).events.length, 1)
  assert.equal(digest(views, 14).events.length, 2)
  assert.equal(digest(views, 30).events.length, 3)
})

test('digest: invalid window values fall back to 7 days', () => {
  for (const value of [undefined, null, 5, 0, -7, 7.5, 'abc', '', {}, [], true]) {
    assert.equal(digest([], value).windowDays, 7, String(value))
  }
  for (const value of [7, 14, 30, '7', ' 14 ', '30']) {
    assert.equal(isDigestWindow(value), true, String(value))
    assert.equal(digest([], value).windowDays, Number(value), String(value))
  }
  assert.equal(isDigestWindow(15), false)
  assert.equal(isDigestWindow('7.0'), true)
})

test('digest: one task created and merged in the window counts once as changed', () => {
  const result = digest([view({ createdAt: midnight(-2), mergedAt: midnight(-1) })])
  assert.equal(result.created, 1)
  assert.equal(result.merged, 1)
  assert.equal(result.changed, 1)
  assert.equal(result.events.length, 2)
  assert.deepEqual(result.events.map((event) => event.kind).sort(), ['created', 'merged'])
})

test('digest: delivery counts accumulated work of window merges only', () => {
  const merged = view({ id: 'm', createdAt: midnight(-3), mergedAt: midnight(-1), workMs: 2 * 3600_000 + 15 * 60_000 })
  const outside = view({ id: 'o', title: 'Old', createdAt: midnight(-20), mergedAt: midnight(-20), workMs: 5 * 3600_000 })
  const unmerged = view({ id: 'u', title: 'Open', createdAt: midnight(-1), workMs: 9 * 3600_000 })

  const result = digest([merged, outside, unmerged])
  assert.equal(result.merged, 1)
  assert.equal(result.deliveredWorkMs, 2 * 3600_000 + 15 * 60_000)
})

test('digest: a running timer is included, invalid work values never go negative', () => {
  const running = view({
    id: 'r',
    createdAt: midnight(-2),
    mergedAt: midnight(-1),
    workMs: 3600_000,
    workStartedAt: NOW - 30 * 60_000,
  })
  const negative = view({ id: 'n', title: 'Negative', createdAt: midnight(-2), mergedAt: midnight(-1), workMs: -5 })
  const broken = view({ id: 'b', title: 'Broken', createdAt: midnight(-2), mergedAt: midnight(-1), workMs: NaN as any })

  const result = digest([running, negative, broken])
  assert.equal(result.deliveredWorkMs, 3600_000 + 30 * 60_000)
  assert.ok(Number.isFinite(result.deliveredWorkMs))
  assert.ok(result.deliveredWorkMs > 0)
})

test('digest: points only count valid estimates on window merges', () => {
  const valid = view({ id: 'v', createdAt: midnight(-2), mergedAt: midnight(-1), estimate: 5 })
  const string = view({ id: 's', title: 'String', createdAt: midnight(-2), mergedAt: midnight(-1), estimate: '3' as any })
  const invalid = view({ id: 'i', title: 'Invalid', createdAt: midnight(-2), mergedAt: midnight(-1), estimate: 4 as any })
  const missing = view({ id: 'x', title: 'Missing', createdAt: midnight(-2), mergedAt: midnight(-1) })
  const outside = view({ id: 'o', title: 'Outside', createdAt: midnight(-20), mergedAt: midnight(-20), estimate: 8 })

  const result = digest([valid, string, invalid, missing, outside])
  assert.equal(result.merged, 4)
  assert.equal(result.deliveredPoints, 8)
  assert.equal(result.deliveredEstimated, 2)
})

test('digest: current status excludes archived, merged and cleaned tasks', () => {
  const open = view({ id: 'open', title: 'Open', createdAt: midnight(-1) }, { status: 'developing' })
  const archived = view({ id: 'arch', title: 'Archived', createdAt: midnight(-30), archivedAt: midnight(-2) })
  const merged = view({ id: 'merged', title: 'Merged', mergedAt: midnight(-1) }, { status: 'merged' })
  const cleaned = view({ id: 'cleaned', title: 'Cleaned', cleanedAt: midnight(-1) }, { status: 'cleaned' })

  const result = digest([open, archived, merged, cleaned])
  assert.equal(result.open, 1)
  assert.equal(result.archived, 1)
  assert.equal(result.merged, 1)
  assert.equal(result.cleaned, 1)
})

test('digest: overdue and stalled mirror the board helpers', () => {
  const overdue = view({ id: 'due', title: 'Due', createdAt: midnight(-1), dueAt: midnight(-2) }, { status: 'review' })
  const soon = view({ id: 'soon', title: 'Soon', createdAt: midnight(-1), dueAt: midnight(0) }, { status: 'review' })
  const stalled = view({
    id: 'stall',
    title: 'Stalled',
    createdAt: NOW - 10 * DAY,
    updatedAt: NOW - 4 * DAY,
  }, { status: 'ready' })
  const running = view({ id: 'run', title: 'Running', createdAt: midnight(-1), updatedAt: NOW }, { status: 'developing' })

  const result = digest([overdue, soon, stalled, running])
  assert.equal(result.open, 4)
  assert.equal(result.overdueOpen, 1)
  assert.equal(result.stalledOpen, 1)
})

test('digest: acceptance progress covers criteria, none, and merged tasks', () => {
  const partial = view({
    id: 'p',
    title: 'Partial',
    createdAt: midnight(-1),
    acceptanceCriteria: ['a', 'b'],
    checkedCriteria: ['a'],
  }, { status: 'review' })
  const none = view({ id: 'n', title: 'None', createdAt: midnight(-1) })
  const merged = view({
    id: 'm',
    title: 'Merged',
    mergedAt: midnight(-1),
    acceptanceCriteria: ['x', 'y'],
  }, { status: 'merged' })

  const result = digest([partial, none, merged])
  assert.equal(result.acceptanceTotal, 4)
  // Partial: one checked; merged: both criteria read as checked.
  assert.equal(result.acceptanceChecked, 3)
})

test('digest: events sort newest first with stable title / id / kind tie-breaks', () => {
  const same = midnight(-1)
  const views = [
    view({ id: 'b', title: 'Bravo', createdAt: same }),
    view({ id: 'a', title: 'Alpha', createdAt: same, mergedAt: same }),
    view({ id: 'c', title: 'Alpha', createdAt: same }),
    view({ id: 'z', title: 'Zulu', createdAt: midnight(0) }),
  ]
  const first = digest(views, 7)
  const second = digest(views, 7)
  assert.deepEqual(first.events, second.events)
  // Newest day first, then raw title, then id, then the fixed kind order.
  assert.deepEqual(first.events.map((event) => `${event.taskId}:${event.kind}`), [
    'z:created',
    'a:created',
    'a:merged',
    'c:created',
    'b:created',
  ])
})

test('digest: more than the event limit truncates the list', () => {
  const views: TaskView[] = []
  for (let index = 0; index < DIGEST_EVENT_LIMIT + 5; index += 1) {
    views.push(view({ id: 'task-' + String(index).padStart(2, '0'), title: 'T' + index, createdAt: midnight(-1) }))
  }
  const result = digest(views, 7)
  assert.equal(result.created, DIGEST_EVENT_LIMIT + 5)
  assert.equal(result.changed, DIGEST_EVENT_LIMIT + 5)
  assert.equal(result.events.length, DIGEST_EVENT_LIMIT)
  assert.equal(result.truncated, true)
  // Newest first among equal stamps is title order, so the last five titles drop.
  assert.equal(result.events[0].title, 'T0')
})

function reportOf(views: TaskView[], t: Record<string, any> = zh) {
  return buildProjectDigestReport({
    project: project(),
    digest: digest(views),
    t,
    statusLabel: (item) => String(item.snapshot.status),
    now: NOW,
  })
}

test('digest report: fixed sections, counts and delivery figures', () => {
  const merged = view({
    id: 'm',
    title: 'Merged task',
    createdAt: midnight(-3),
    mergedAt: midnight(-1),
    workMs: 2 * 3600_000 + 15 * 60_000,
    estimate: 3,
    acceptanceCriteria: ['criteria text should not leak'],
    notes: 'notes text should not leak',
  }, { status: 'merged' })
  const created = view({ id: 'c', title: 'New task', createdAt: midnight(0) })
  const text = reportOf([merged, created])

  assert.match(text, /^# 项目周报/)
  assert.match(text, /统计窗口/)
  assert.match(text, /近 7 天/)
  assert.match(text, /新建任务：2/)
  assert.match(text, /合并任务：1/)
  assert.match(text, /清理任务：0/)
  assert.match(text, /归档任务：0/)
  assert.match(text, /有变化的任务：2/)
  assert.match(text, /2 小时 15 分/)
  assert.match(text, /交付点数：3/)
  assert.match(text, /1\/1 个合并任务已估算/)
  assert.match(text, /开放任务：1/)
  assert.match(text, /当前逾期：0/)
  assert.match(text, /当前停滞：0/)
  assert.match(text, /验收核对：1\/1/)
  assert.match(text, /Merged task/)
  assert.match(text, /merged/)
  assert.match(text, /说明/)
  // The project report owns per-task criteria, notes, diffs and file lists.
  assert.doesNotMatch(text, /criteria text should not leak/)
  assert.doesNotMatch(text, /notes text should not leak/)
  // No per-task detail headings, so no acceptance body / notes / diff section.
  assert.doesNotMatch(text, /^### /m)
})

test('digest report: empty window keeps the current-state section', () => {
  const open = view({ id: 'o', title: 'Open', createdAt: midnight(-40) }, { status: 'developing' })
  const text = reportOf([open])
  assert.match(text, /窗口内没有变化/)
  assert.match(text, /开放任务：1/)
  assert.match(text, /无（窗口内没有已记录工时的合并任务）/)
})

test('digest report: truncation is stated once the event list is capped', () => {
  const views: TaskView[] = []
  for (let index = 0; index < DIGEST_EVENT_LIMIT + 2; index += 1) {
    views.push(view({ id: 't-' + index, title: 'Task ' + index, createdAt: midnight(-1) }))
  }
  const text = reportOf(views)
  assert.match(text, /仅列出最近 30 条变化/)
})

test('digest report: English dictionary renders English wording', () => {
  const text = reportOf([view({ createdAt: midnight(0) })], en)
  assert.match(text, /^# Project digest/)
  assert.match(text, /Window changes/)
  assert.match(text, /Tasks created: 1/)
  assert.match(text, /Current status/)
})

test('digestFilename: slug, local date, time and non-ASCII fallback', () => {
  assert.equal(digestFilename(project(), NOW), 'digest-demo-project-20260108-1200.md')
  assert.equal(digestFilename(project({ name: '项目周报' }), NOW), 'digest-abcdef12-20260108-1200.md')
  assert.equal(digestFilename(project({ name: '', id: '!!' }), NOW), 'digest-project-20260108-1200.md')
  // The stamp is the local calendar day, matching reportTimestamp.
  const stamp = reportTimestamp(NOW).replace(/[-: ]/g, '')
  assert.ok(digestFilename(project(), NOW).includes(stamp.slice(0, 8) + '-' + stamp.slice(8, 12)))
})
