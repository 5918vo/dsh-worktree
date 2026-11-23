import test from 'node:test'
import assert from 'node:assert/strict'
import zh from '../locale/zh.json'
import en from '../locale/en.json'
import { buildProjectReport, projectReportFilename } from '../src/client/project-report.js'
import { reportTimestamp, safeSlug } from '../src/client/markdown.js'
import { compareTaskOrder } from '../src/task-meta.js'
import type { Project, TaskView, WorktreeTask } from '../src/models.js'

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
    createdAt: 100,
    updatedAt: 100,
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

function report(views: TaskView[], proj: Project = project(), now = Date.UTC(2026, 0, 2, 3, 4)) {
  return buildProjectReport({
    project: proj,
    views,
    t: zh,
    statusLabel: (v) => String(v.snapshot.status),
    now,
  })
}

test('project report carries metadata, stats, the task table and per-task blocks', () => {
  const text = report([
    view({ id: 'a', title: 'Alpha', acceptanceCriteria: ['one'], checkedCriteria: ['one'] }),
    view({ id: 'b', title: 'Beta', createdAt: 50 }, { status: 'merged' }),
  ])

  assert.match(text, /^# 项目验收报告/)
  assert.match(text, /- 项目: Demo Project/)
  assert.match(text, /- 仓库: `C:\/repo`/)
  assert.match(text, /- 基线分支: `main`/)
  assert.match(text, /- 合并门禁: 关闭/)
  assert.match(text, /## 任务统计/)
  assert.match(text, /- 任务总数：2/)
  assert.match(text, /- review：1/)
  assert.match(text, /- merged：1/)
  assert.match(text, /## 任务清单/)
  assert.match(text, /\| 序号 \| 状态 \| 任务 \| 分支 \| 验收 \| 优先级 \| 截止 \| 标签 \| 最近活动 \|/)
  assert.match(text, /\| 1 \| review \| Alpha \| `dsh\/one` \| 1\/1 \| 普通 \| — \| — \|/)
  assert.match(text, /### 任务 1：Alpha/)
  assert.match(text, /- \[x\] one/)
  assert.match(text, /### 任务 2：Beta/)
})

test('recent activity uses the newest task time or worktree commit', () => {
  const lastCommitAt = Date.UTC(2026, 0, 4, 12)
  const text = report([
    view({ updatedAt: 100, createdAt: 100 }, {
      worktree: { exists: true, branch: 'dsh/one', dirtyCount: 0, ahead: 0, commits: [], lastCommitAt },
    }),
  ])
  assert.ok(text.includes(reportTimestamp(lastCommitAt)), 'the table shows the commit time, not the task age')
})

test('an empty project says so and skips the table header', () => {
  const text = report([])
  assert.match(text, /## 任务清单\n暂无任务\n/)
  assert.doesNotMatch(text, /\| --- \|/)
})

test('a task without criteria or notes renders the fallbacks', () => {
  const text = report([view({ title: 'Plain' })])
  assert.match(text, /- 未设置验收标准/)
  assert.match(text, /\*\*备注\*\*: 无备注/)
})

test('merged and cleaned tasks read their criteria as complete', () => {
  const text = report([
    view({ title: 'Shipped', acceptanceCriteria: ['a', 'b'] }, { status: 'merged' }),
    view({ title: 'Swept', acceptanceCriteria: ['c'] }, { status: 'cleaned' }),
  ])
  assert.match(text, /\| 1 \| merged \| Shipped \| .* \| 2\/2 \|/)
  assert.match(text, /\| 2 \| cleaned \| Swept \| .* \| 1\/1 \|/)
  assert.match(text, /- \[x\] a/)
  assert.match(text, /- \[x\] c/)
})

test('merged commit, archived flag and notes appear in the task block', () => {
  const text = report([
    view(
      {
        title: 'Shipped',
        mergedCommit: 'deadbeef',
        archivedAt: 5,
        notes: 'watch the migration',
      },
      { status: 'merged' },
    ),
  ])
  assert.match(text, /- 合并提交: `deadbeef`/)
  assert.match(text, /- 状态: merged · 已归档/)
  assert.match(text, /\*\*备注\*\*: watch the migration/)
})

test('pipes, newlines and backticks are escaped so the table cannot break', () => {
  const text = report([view({ title: 'a|b\nc', branch: 'x`y', notes: 'one\ntwo' })])
  assert.match(text, /a\\\|b c/, 'pipe escaped and newline collapsed')
  assert.match(text, /``x`y``/, 'branch uses a wider fence')
  assert.match(text, /\*\*备注\*\*:\n\none\ntwo/, 'notes keep their line breaks')
  // The row count matches the header, i.e. the title did not split the table.
  const rows = text.split('\n').filter((line) => line.startsWith('| '))
  assert.equal(rows.length, 3, 'header + divider + one row')
})

test('tasks are ordered with compareTaskOrder', () => {
  const views = [
    view({ id: 'low', title: 'Low', priority: 'low', createdAt: 10 }),
    view({ id: 'high', title: 'High', priority: 'high', createdAt: 10 }),
    view({ id: 'new', title: 'New', createdAt: 99 }),
  ]
  const expected = views.slice().sort((a, b) => compareTaskOrder(a.task, b.task)).map((v) => v.task.title)
  assert.deepEqual(expected, ['High', 'New', 'Low'])
  const text = report(views)
  const order = ['High', 'New', 'Low'].map((title) => text.indexOf('：' + title))
  assert.ok(order[0] >= 0 && order[0] < order[1] && order[1] < order[2], text)
})

test('report filename slugs the name, pads the date and is stable within a minute', () => {
  const at = new Date(2026, 0, 2, 3, 4, 30).getTime()
  const later = new Date(2026, 0, 2, 3, 4, 59).getTime()
  const next = new Date(2026, 0, 2, 3, 5, 0).getTime()
  assert.equal(projectReportFilename(project(), at), 'project-demo-project-20260102-0304.md')
  assert.equal(projectReportFilename(project(), later), projectReportFilename(project(), at))
  assert.equal(projectReportFilename(project(), next), 'project-demo-project-20260102-0305.md')
})

test('a name without ASCII falls back to the project id and stays usable', () => {
  const name = projectReportFilename(project({ id: 'ABCDEF12-3456', name: '中文项目' }))
  assert.match(name, /^project-abcdef12-\d{8}-\d{4}\.md$/)
  const noId = projectReportFilename(project({ id: '---', name: '中文项目' }))
  assert.match(noId, /^project-project-\d{8}-\d{4}\.md$/)
})

test('safeSlug caps the slug at 32 characters', () => {
  assert.equal(safeSlug('A'.repeat(50)).length, 32)
  assert.equal(safeSlug('  --Hello, World! --  '), 'hello-world')
  assert.equal(safeSlug('中文'), 'project')
  assert.equal(safeSlug('中文', 'abcd1234'), 'abcd1234')
})

test('a due date shows in the table and the per-task block, with overdue days', () => {
  const dueAt = new Date(2026, 0, 1).getTime()
  const text = report([
    view({ id: 'a', title: 'Late', dueAt }),
    view({ id: 'b', title: 'Some day', dueAt: new Date(2026, 1, 15).getTime() }),
  ], project(), new Date(2026, 0, 3, 10).getTime())
  // 2026-01-01 against now 2026-01-03 is two days late, but the project table
  // keeps the plain date; only the per-task block repeats the deadline.
  assert.match(text, /\| 1 \| review \| Late \| `dsh\/one` \| — \| 普通 \| 2026-01-01 \|/)
  assert.match(text, /\| 2 \| review \| Some day \|.*\| 2026-02-15 \|/)
  assert.match(text, /- 截止日期: 2026-01-01/)
  assert.match(text, /- 截止日期: 2026-02-15/)
  assert.equal(/逾期/.test(text), false, 'the project report does not recompute lateness')
})

test('a project task without a deadline reads as unset', () => {
  const text = report([view({ title: 'No due' })])
  assert.match(text, /\| 1 \| review \| No due \| `dsh\/one` \| — \| 普通 \| — \| — \|/)
  assert.match(text, /- 截止日期: 未设置/)
})

test('English locale produces the same structure', () => {
  const text = buildProjectReport({
    project: project(),
    views: [view({ title: 'Alpha', notes: 'n' })],
    t: en,
    statusLabel: () => 'review',
    now: 0,
  })
  assert.match(text, /^# Project acceptance report/)
  assert.match(text, /## Task list/)
  assert.match(text, /\*\*Notes\*\*: n/)
})
