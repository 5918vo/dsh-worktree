import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildAcceptanceReport, reportFileName } from '../src/client/report.js'

const zh = JSON.parse(readFileSync(new URL('../locale/zh.json', import.meta.url), 'utf8')) as Record<string, string>

const task = (over: Record<string, any> = {}) => ({
  id: 'abcdef12-3456-7890-abcd-ef1234567890',
  projectId: 'p1',
  title: 'Add report export',
  description: 'd',
  branch: 'dsh-wt/report',
  baseBranch: 'main',
  worktreePath: 'C:/tmp/wt',
  status: 'review',
  acceptanceCriteria: ['first item', 'second item'],
  checkedCriteria: ['first item'],
  createdAt: 1000,
  updatedAt: Date.UTC(2026, 0, 2, 3, 4, 5),
  ...over,
})

const snapshot = (over: Record<string, any> = {}) => ({
  status: 'review',
  worktree: {
    exists: true,
    branch: 'dsh-wt/report',
    dirtyCount: 2,
    ahead: 1,
    commits: [{ hash: 'abcdef1234567890', subject: 'feat: report' }],
    lastCommitAt: 1,
  },
  repo: { exists: true, currentBranch: 'main', dirtyCount: 0 },
  branchExists: true,
  ...over,
})

const diff = (over: Record<string, any> = {}) => ({
  base: 'main',
  mergeBase: 'abc',
  files: [
    { path: 'src/report.ts', status: 'added', additions: 12, deletions: 0 },
    { path: 'src/models.ts', status: 'modified', additions: 3, deletions: 1 },
  ],
  totalAdditions: 15,
  totalDeletions: 1,
  truncated: false,
  ...over,
})

test('acceptance report renders header, criteria, commits, files and notes', () => {
  const md = buildAcceptanceReport({ task: task(), snapshot: snapshot(), diff: diff(), t: zh, generatedAt: 5 })

  assert.match(md, /^# 验收报告：Add report export/)
  assert.match(md, /任务 ID：`abcdef12-3456-7890-abcd-ef1234567890`/)
  assert.match(md, /验收标准：1\/2 已核对/)
  assert.match(md, /## 验收标准/)
  assert.match(md, /- \[x\] first item/)
  assert.match(md, /- \[ \] second item/)
  assert.match(md, /## 提交（相对基线）/)
  assert.match(md, /`abcdef12` feat: report/)
  assert.match(md, /## 改动文件/)
  assert.match(md, /\| `src\/report.ts` \| added \| 12 \| 0 \|/)
  assert.match(md, /合计：\+15 -1/)
  assert.match(md, /worktree 未提交改动：2/)
  assert.match(md, /待处理暂存：0/)
  assert.match(md, /> 本报告由 Worktree 看板生成/)
  // The report is a summary, never a raw patch dump.
  assert.equal(md.includes('diff --git'), false)
})

test('acceptance report escapes table separators and marks truncation', () => {
  const md = buildAcceptanceReport({
    task: task(),
    snapshot: snapshot(),
    diff: diff({
      files: [{ path: 'src/a|b.ts', status: 'modified', additions: 1, deletions: 2 }],
      truncated: true,
      totalAdditions: 1,
      totalDeletions: 2,
    }),
    t: zh,
  })
  assert.match(md, /src\/a\\\|b\.ts/)
  assert.match(md, /文件列表已截断/)
})

test('acceptance report degrades gracefully without a diff', () => {
  const missing = buildAcceptanceReport({ task: task(), snapshot: snapshot(), diff: null, t: zh })
  assert.match(missing, /改动统计不可用/)
  assert.equal(missing.includes('| 文件 |'), false)

  const failed = buildAcceptanceReport({
    task: task(),
    snapshot: snapshot(),
    diff: diff({ files: [], reason: 'no-merge-base', error: 'no merge base', totalAdditions: 0, totalDeletions: 0 }),
    t: zh,
  })
  assert.match(failed, /改动统计不可用：no merge base/)
  assert.equal(failed.includes('| 文件 |'), false)

  const empty = buildAcceptanceReport({
    task: task(),
    snapshot: snapshot(),
    diff: diff({ files: [], totalAdditions: 0, totalDeletions: 0 }),
    t: zh,
  })
  assert.match(empty, /没有改动文件/)
})

test('acceptance report hydrates criteria and merge info for merged tasks', () => {
  const md = buildAcceptanceReport({
    task: task({ mergedAt: Date.UTC(2026, 1, 3, 0, 0, 0), mergedCommit: 'deadbeefcafe', mergedBranchTip: 'deadbeefcafe', checkedCriteria: [] }),
    snapshot: snapshot({
      status: 'merged',
      worktree: { ...snapshot().worktree, commits: [] },
    }),
    diff: diff({ files: [], totalAdditions: 0, totalDeletions: 0 }),
    t: zh,
  })
  assert.match(md, /- \[x\] first item/)
  assert.match(md, /- \[x\] second item/)
  assert.match(md, /2\/2 已核对/)
  assert.match(md, /合并：.*deadbeef/)
  assert.match(md, /无提交记录/)
})

test('report file name is stable and date-stamped in local time', () => {
  const now = new Date(2026, 4, 6, 12, 0, 0).getTime()
  assert.equal(reportFileName(task(), now), 'dshw-report-abcdef12-20260506.md')
  assert.equal(reportFileName(task({ id: 'x' }), now), 'dshw-report-x-20260506.md')
})
