import test from 'node:test'
import assert from 'node:assert/strict'
import zh from '../locale/zh.json'
import {
  WEEKLY_DAYS,
  WEEKLY_MAX_TASKS,
  buildWeeklyDigest,
  weeklyDigestFilename,
} from '../src/client/project-weekly.js'
import { formatWorkDuration } from '../src/task-timer.js'
import { workDurationUnits } from '../src/client/work-format.js'
import type { Project, TaskView, WorktreeTask } from '../src/models.js'

const DAY = 86400000
/** Fixed local wall-clock base: no DST transition in June for either hemisphere. */
const NOW = new Date(2026, 5, 15, 15, 30, 0, 0).getTime()

/** Local midnight `offset` days from NOW. */
function day(offset: number): number {
  const base = new Date(NOW)
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset).getTime()
}

/** The window the digest must derive for NOW. */
const RANGE_START = day(-6)
const RANGE_END = day(1)

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
    description: '',
    repoPath: 'C:/repo',
    baseBranch: 'main',
    branch: 'dsh/one',
    worktreePath: 'C:/wt',
    createdAt: NOW - 2 * DAY,
    updatedAt: NOW - 2 * DAY,
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

function digest(views: TaskView[], now: number = NOW, proj: Project = project()) {
  return buildWeeklyDigest({
    project: proj,
    views,
    t: zh,
    statusLabel: (v) => String(v.snapshot.status),
    now,
  })
}

test('WEEKLY_DAYS and the window are the last seven local calendar days', () => {
  assert.equal(WEEKLY_DAYS, 7)
  const out = digest([])
  assert.equal(out.rangeStart, RANGE_START)
  assert.equal(out.rangeEnd, RANGE_END)
  assert.equal(new Date(out.rangeStart).getHours(), 0)
  assert.equal(new Date(out.rangeEnd).getHours(), 0)
  // Six days before the exclusive end is the inclusive start.
  assert.equal(new Date(out.rangeEnd).getDate() - new Date(out.rangeStart).getDate(), 7)
})

test('empty window: zero stats, no activity, still a valid digest', () => {
  // A closed row: nothing in the window and nothing that could stall.
  const out = digest([view({ createdAt: NOW - 30 * DAY, updatedAt: NOW - 30 * DAY }, { status: 'merged' })])
  assert.deepEqual(out.stats, {
    newTasks: 0,
    mergedTasks: 0,
    workMs: 0,
    completedEstimatePoints: 0,
    blocked: 0,
    dueSoon: 0,
    stale: 0,
  })
  assert.equal(out.activeCount, 0)
  assert.match(out.markdown, /# 项目周报/)
  assert.match(out.markdown, /本周期没有活动/)
  assert.ok(!out.markdown.includes('| 任务 |'))
  assert.match(out.filename, /^project-demo-project-weekly-\d{8}-\d{4}\.md$/)
})

test('window boundaries: day -6 in, day -7 out, tomorrow out', () => {
  const views = [
    view({ id: 'start', title: 'start', createdAt: RANGE_START, updatedAt: RANGE_START }),
    view({ id: 'before', title: 'before', createdAt: RANGE_START - 1, updatedAt: RANGE_START - 1 }),
    view({ id: 'tomorrow', title: 'tomorrow', createdAt: RANGE_END, updatedAt: RANGE_END }),
    view({ id: 'last-minute', title: 'last-minute', createdAt: RANGE_END - 1, updatedAt: RANGE_END - 1 }),
  ]
  const out = digest(views)
  assert.equal(out.stats.newTasks, 2)
  assert.equal(out.activeCount, 2)
  assert.match(out.markdown, /start/)
  assert.match(out.markdown, /last-minute/)
  assert.ok(!out.markdown.includes('| before |'))
  assert.ok(!out.markdown.includes('| tomorrow |'))
})

test('new and merged counts only track the window', () => {
  const out = digest([
    view({ id: 'n1', createdAt: NOW - DAY, updatedAt: NOW - DAY }),
    view({ id: 'n2', createdAt: NOW - 3 * DAY, updatedAt: NOW - 3 * DAY }),
    view({ id: 'old', createdAt: NOW - 20 * DAY, updatedAt: NOW - 20 * DAY }),
    view({ id: 'm1', createdAt: NOW - 20 * DAY, mergedAt: NOW - DAY, updatedAt: NOW - DAY }, { status: 'merged' }),
    view({ id: 'm-old', createdAt: NOW - 20 * DAY, mergedAt: NOW - 20 * DAY, updatedAt: NOW - 20 * DAY }, { status: 'merged' }),
  ])
  assert.equal(out.stats.newTasks, 2)
  assert.equal(out.stats.mergedTasks, 1)
})

test('completed estimate points sum only tasks merged in the window', () => {
  const out = digest([
    view({ id: 'a', createdAt: NOW - 10 * DAY, mergedAt: NOW - DAY, estimate: 5, updatedAt: NOW - DAY }, { status: 'merged' }),
    view({ id: 'b', createdAt: NOW - 10 * DAY, mergedAt: RANGE_START, estimate: 3, updatedAt: RANGE_START }, { status: 'merged' }),
    // Invalid / missing estimates contribute nothing.
    view({ id: 'c', createdAt: NOW - 10 * DAY, mergedAt: NOW - DAY, estimate: 'many', updatedAt: NOW - DAY }, { status: 'merged' }),
    view({ id: 'd', createdAt: NOW - 10 * DAY, mergedAt: NOW - DAY, estimate: 99, updatedAt: NOW - DAY }, { status: 'merged' }),
    // Merged before the window: its points are already reported elsewhere.
    view({ id: 'e', createdAt: NOW - 30 * DAY, mergedAt: NOW - 30 * DAY, estimate: 8, updatedAt: NOW - 30 * DAY }, { status: 'merged' }),
  ])
  assert.equal(out.stats.mergedTasks, 4)
  assert.equal(out.stats.completedEstimatePoints, 8)
})

test('workMs sums the accumulated total of active tasks, running clock included', () => {
  const out = digest([
    // 60s recorded, 30s still running -> 90s.
    view({ id: 'running', createdAt: NOW - DAY, updatedAt: NOW - DAY, workMs: 60000, workStartedAt: NOW - 30000 }),
    view({ id: 'done', createdAt: NOW - DAY, updatedAt: NOW - DAY, workMs: 120000 }),
    // Inactive rows never add to the weekly effort.
    view({ id: 'old', createdAt: NOW - 20 * DAY, updatedAt: NOW - 20 * DAY, workMs: 900000 }),
  ])
  assert.equal(out.stats.workMs, 210000)
  const label = formatWorkDuration(210000, workDurationUnits(zh))
  assert.ok(out.markdown.includes(`- 记录工时: ${label}`))
})

test('blocked counts open tasks with unfinished prerequisites only', () => {
  const out = digest([
    view({ id: 'a', title: 'Dependent', dependsOn: ['b'] }),
    view({ id: 'b', title: 'Prerequisite' }),
    view({ id: 'c', title: 'Missing dep', dependsOn: ['ghost'] }),
    view({ id: 'd', title: 'Done dep', dependsOn: ['e'] }),
    view({ id: 'e', title: 'Merged prerequisite', mergedAt: NOW - 30 * DAY }, { status: 'merged' }),
    view({ id: 'f', title: 'Overdue dependent', dependsOn: ['b'], archivedAt: NOW - DAY }),
  ])
  assert.equal(out.stats.blocked, 1)
})

test('dueSoon covers today through day seven, not overdue or day eight', () => {
  const out = digest([
    view({ id: 'today', dueAt: NOW }),
    view({ id: 'week', dueAt: day(7) }),
    view({ id: 'eight', dueAt: day(8) }),
    view({ id: 'overdue', dueAt: day(-1) }),
    view({ id: 'closed', dueAt: NOW, mergedAt: NOW - DAY }, { status: 'merged' }),
    view({ id: 'none' }),
  ])
  assert.equal(out.stats.dueSoon, 2)
})

test('stale counts open tasks past their status threshold', () => {
  const out = digest([
    // developing allows 7 quiet days -> 10 is stalled.
    view({ id: 'stale', title: 'Stalled', createdAt: NOW - 20 * DAY, updatedAt: NOW - 10 * DAY }, { status: 'developing' }),
    // ready allows 3 -> 2 is fine.
    view({ id: 'fresh', title: 'Fresh', createdAt: NOW - 2 * DAY, updatedAt: NOW - 2 * DAY }, { status: 'ready' }),
    // Closed rows never stall.
    view({ id: 'done', title: 'Done', createdAt: NOW - 20 * DAY, updatedAt: NOW - 20 * DAY }, { status: 'merged' }),
  ])
  assert.equal(out.stats.stale, 1)
})

test('activeCount and the Markdown table use created / merged / updated', () => {
  const out = digest([
    view({ id: 'created', title: 'Fresh', createdAt: NOW - DAY, updatedAt: NOW - 30 * DAY }),
    view({ id: 'updated', title: 'Touched', createdAt: NOW - 30 * DAY, updatedAt: NOW }),
    view({ id: 'merged', title: 'Landed', createdAt: NOW - 30 * DAY, updatedAt: NOW - 30 * DAY, mergedAt: NOW - DAY }, { status: 'merged' }),
    view({ id: 'quiet', title: 'Quiet', createdAt: NOW - 30 * DAY, updatedAt: NOW - 30 * DAY }),
  ])
  assert.equal(out.activeCount, 3)
  assert.match(out.markdown, /Fresh/)
  assert.match(out.markdown, /Touched/)
  assert.match(out.markdown, /Landed/)
  assert.ok(!out.markdown.includes('Quiet'))
})

test('the table is newest activity first and capped at 30 rows', () => {
  const views: TaskView[] = []
  for (let i = 0; i < WEEKLY_MAX_TASKS + 5; i += 1) {
    views.push(view({ id: `t${i}`, title: `Task ${i}`, createdAt: NOW - 30 * DAY, updatedAt: NOW - i * 1000 }))
  }
  const out = digest(views)
  assert.equal(out.activeCount, WEEKLY_MAX_TASKS + 5)
  const body = out.markdown.split('## 任务明细')[1]
  assert.match(body, /Task 0/)
  assert.ok(!body.includes('Task 34'))
  assert.ok(body.indexOf('Task 1') < body.indexOf('Task 2'))
})

test('Markdown: title, metadata, summary, table, escaping', () => {
  const out = digest([
    view({
      id: 'x',
      title: 'Fix a|b `pipe`',
      createdAt: NOW - DAY,
      updatedAt: NOW - DAY,
      estimate: 3,
      dueAt: day(2),
      tags: ['ui', 'bug'],
      workMs: 3600000,
    }),
  ])
  const lines = out.markdown.split('\n')
  assert.equal(lines[0], '# 项目周报')
  assert.ok(out.markdown.includes('- 项目: Demo Project'))
  assert.ok(out.markdown.includes('- 仓库: `C:/repo`'))
  assert.ok(out.markdown.includes('- 基线分支: `main`'))
  assert.ok(out.markdown.includes('- 统计区间: 2026-06-09 ~ 2026-06-15'))
  assert.ok(out.markdown.includes('- 新建任务: 1'))
  assert.ok(out.markdown.includes('- 完成估算点: 0'))
  assert.ok(out.markdown.includes('## 任务明细'))
  assert.ok(out.markdown.includes('| 任务 | 状态 | 工时 | 估算 | 截止 | 标签 |'))
  assert.ok(out.markdown.includes('| Fix a\\|b \\`pipe\\` | review |'))
  assert.ok(out.markdown.includes('| 3 点 | 2026-06-17 | ui bug |'))
})

test('filename: local time, slug from the name, id8 fallback', () => {
  assert.equal(weeklyDigestFilename(project(), NOW), 'project-demo-project-weekly-20260615-1530.md')
  // No ASCII at all: the project id keeps the file name usable.
  const cjk = weeklyDigestFilename(project({ id: 'aaaaaaaa-bbbb', name: '复盘项目' }), NOW)
  assert.equal(cjk, 'project-aaaaaaaa-weekly-20260615-1530.md')
})

test('now is injectable and a broken value falls back to the clock', () => {
  const earlyNow = new Date(2026, 5, 1, 9, 5).getTime()
  const early = digest([view({ createdAt: earlyNow - 5 * DAY, updatedAt: earlyNow - 5 * DAY })], earlyNow)
  assert.ok(early.markdown.includes('- 统计区间: 2026-05-26 ~ 2026-06-01'))
  assert.match(early.filename, /weekly-20260601-0905\.md$/)
  assert.equal(early.stats.newTasks, 1)

  const fallback = digest([], Number.NaN)
  assert.ok(Number.isFinite(fallback.rangeStart))
  assert.ok(Number.isFinite(fallback.rangeEnd))
  assert.match(fallback.filename, /^project-demo-project-weekly-\d{8}-\d{4}\.md$/)
  assert.ok(!fallback.markdown.includes('NaN'))
})

test('invalid, negative and future timestamps never leak into the digest', () => {
  const out = digest([
    view({ id: 'nan', title: 'NaN stamp', createdAt: Number.NaN, updatedAt: 'nope' as any, mergedAt: -5 }),
    view({ id: 'negative', title: 'Negative', createdAt: -1, updatedAt: -86400000, dueAt: -1 }),
    view({ id: 'future', title: 'Future', createdAt: NOW + 30 * DAY, updatedAt: NOW + 30 * DAY }),
    view({ id: 'broken-estimate', title: 'Bad estimate', createdAt: NOW - DAY, updatedAt: NOW - DAY, estimate: {} as any }),
  ])
  assert.equal(out.stats.newTasks, 1)
  assert.equal(out.stats.mergedTasks, 0)
  assert.equal(out.stats.dueSoon, 0)
  assert.equal(out.activeCount, 1)
  assert.ok(!out.markdown.includes('NaN'))
  assert.ok(!out.markdown.includes('Invalid Date'))
  assert.ok(out.markdown.includes('未估算'))
})

test('pure: the input views are not modified', () => {
  const views = [
    view({ id: 'a', title: 'A', createdAt: NOW - DAY, updatedAt: NOW - DAY, tags: ['x'], dependsOn: ['b'], estimate: 2 }),
    view({ id: 'b', title: 'B', createdAt: NOW - 2 * DAY, updatedAt: NOW - 2 * DAY }),
  ]
  const before = JSON.stringify(views)
  const out = digest(views)
  assert.equal(JSON.stringify(views), before)
  assert.equal(out.stats.newTasks, 2)
})
