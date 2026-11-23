import test from 'node:test'
import assert from 'node:assert/strict'
import en from '../locale/en.json'
import zh from '../locale/zh.json'
import { buildAcceptanceReport, reportFilename, type ReportInput } from '../src/client/report.js'
import { boardStatus, boardStatusLabel } from '../src/client/model.js'
import { Stage, type StageProps } from '../src/client/stage.js'
import { initReact } from '../src/client/ui.js'
import type { DiffFile, TaskDiff, TaskSnapshot, WorktreeTask } from '../src/models.js'

function makeTask(overrides: Partial<WorktreeTask> = {}): WorktreeTask {
  return {
    id: '32bee859-738a-41cd-9940-96d999999999',
    projectId: 'p1',
    title: '验收报告',
    description: '实现复制与下载。',
    repoPath: 'C:/repo',
    baseBranch: 'main',
    branch: 'dsh/report',
    worktreePath: 'C:/wt',
    sessionId: null,
    firstPrompt: '',
    startOnBind: false,
    ...overrides,
  }
}

function makeSnapshot(overrides: Partial<TaskSnapshot> = {}): TaskSnapshot {
  return {
    worktree: {
      exists: true,
      branch: 'dsh/report',
      dirtyCount: 0,
      ahead: 1,
      commits: [{ hash: 'abcdef1234567890', subject: 'add report' }],
      lastCommitAt: null,
    },
    repo: { exists: true, currentBranch: 'main', dirtyCount: 0 },
    branchExists: true,
    merged: false,
    status: 'review',
    ...overrides,
  }
}

function makeFile(overrides: Partial<DiffFile> = {}): DiffFile {
  return {
    path: 'src/client/report.ts',
    status: 'added',
    additions: 3,
    deletions: 0,
    binary: false,
    patch: '+export function buildAcceptanceReport() {}',
    ...overrides,
  }
}

function makeDiff(overrides: Partial<TaskDiff> = {}): TaskDiff {
  const files = overrides.files ?? [makeFile()]
  return {
    base: 'main',
    mergeBase: 'abc123',
    files,
    totalAdditions: files.reduce((sum, file) => sum + file.additions, 0),
    totalDeletions: files.reduce((sum, file) => sum + file.deletions, 0),
    truncated: false,
    ...overrides,
  }
}

function makeInput(overrides: Partial<ReportInput> = {}): ReportInput {
  const task = overrides.task ?? makeTask()
  const snapshot = overrides.snapshot ?? makeSnapshot()
  const status = boardStatus(snapshot.status, false)
  return {
    task,
    snapshot,
    diff: makeDiff(),
    projectName: 'demo',
    statusLabel: boardStatusLabel(zh, status),
    t: zh,
    now: new Date(2026, 0, 5, 9, 7).getTime(),
    ...overrides,
  }
}

test('reportFilename uses 8 safe id characters plus a local timestamp', () => {
  const now = new Date(2026, 0, 5, 9, 7).getTime()
  assert.equal(reportFilename(makeTask(), now), 'acceptance-32bee859-20260105-0907.md')
})

test('reportFilename strips unsafe characters and falls back for an empty id', () => {
  const now = new Date(2026, 10, 22, 23, 59).getTime()
  assert.equal(reportFilename(makeTask({ id: 'AB__cd--12345678' }), now), 'acceptance-abcd1234-20261122-2359.md')
  assert.equal(reportFilename(makeTask({ id: '' }), now), 'acceptance-task-20261122-2359.md')
  assert.match(reportFilename(makeTask({ id: '-----' })), /^acceptance-task-\d{8}-\d{4}\.md$/)
})

test('reportFilename stays stable within one minute and changes on the next', () => {
  const base = new Date(2026, 2, 1, 12, 0, 5).getTime()
  assert.equal(reportFilename(makeTask(), base), reportFilename(makeTask(), base + 54_000))
  assert.notEqual(reportFilename(makeTask(), base), reportFilename(makeTask(), base + 60_000))
})

test('the report opens with the title and every headline fact', () => {
  const report = buildAcceptanceReport(makeInput({
    task: makeTask({ mergedCommit: 'deadbeef', sessionId: 's-1' }),
    snapshot: makeSnapshot({ status: 'merged' }),
  }))
  const lines = report.split('\n')
  assert.equal(lines[0], '# 验收报告：验收报告')
  assert.ok(report.includes('- 项目: demo'))
  assert.ok(report.includes('- 任务分支: `dsh/report`'))
  assert.ok(report.includes('- 基线分支: `main`'))
  assert.ok(report.includes('- 状态: 已合并'))
  assert.ok(report.includes('- 任务 HEAD: `abcdef1234567890`'))
  assert.ok(report.includes('- 合并提交: `deadbeef`'))
  assert.ok(report.includes('- 会话: `s-1`'))
  assert.ok(report.includes('- 生成时间: 2026-01-05 09:07'))
  assert.ok(report.endsWith('\n'))
})

test('optional metadata rows are omitted when absent', () => {
  const report = buildAcceptanceReport(makeInput())
  assert.ok(!report.includes('合并提交'))
  assert.ok(!report.includes('- 会话:'))
})

test('criteria render as a checklist with progress', () => {
  const report = buildAcceptanceReport(makeInput({
    task: makeTask({ acceptanceCriteria: ['第一个', '第二个'], checkedCriteria: ['第一个'] }),
  }))
  assert.ok(report.includes('## 验收标准'))
  assert.ok(report.includes('- [x] 第一个'))
  assert.ok(report.includes('- [ ] 第二个'))
  assert.ok(report.includes('进度：已核对 1/2'))
})

test('merged and cleaned tasks list every criterion as checked', () => {
  for (const status of ['merged', 'cleaned'] as const) {
    const report = buildAcceptanceReport(makeInput({
      task: makeTask({ acceptanceCriteria: ['a', 'b'] }),
      snapshot: makeSnapshot({ status }),
      statusLabel: boardStatusLabel(zh, boardStatus(status, false)),
    }))
    assert.ok(report.includes('- [x] a'))
    assert.ok(report.includes('- [x] b'))
    assert.ok(!report.includes('- [ ]'))
  }
})

test('a task without criteria keeps the section and says so', () => {
  const report = buildAcceptanceReport(makeInput({ task: makeTask({ acceptanceCriteria: [] }) }))
  assert.ok(report.includes('## 验收标准'))
  assert.ok(report.includes(zh.boardNoCriteria))
  assert.ok(!report.includes('进度：'))
})

test('commits are one line each and keep unusual subjects readable', () => {
  const report = buildAcceptanceReport(makeInput({
    snapshot: makeSnapshot({
      worktree: {
        exists: true,
        branch: 'dsh/report',
        dirtyCount: 0,
        ahead: 2,
        commits: [
          { hash: '1111111222222222', subject: 'feat: 复制 | 下载\n第二行' },
          { hash: '3333333444444444', subject: '`code` 说明' },
        ],
        lastCommitAt: null,
      },
    }),
  }))
  assert.ok(report.includes('## 提交'))
  assert.ok(report.includes('- `1111111` feat: 复制 | 下载 第二行'))
  assert.ok(report.includes('- `3333333` \\`code\\` 说明'))
  // Overview bullets are not inside a table, so pipes there need no escape.
  assert.ok(!report.includes('复制 \\| 下载'))
})

test('a task without commits says so', () => {
  const report = buildAcceptanceReport(makeInput({
    snapshot: makeSnapshot({
      worktree: { exists: true, branch: null, dirtyCount: 0, ahead: 0, commits: [], lastCommitAt: null },
    }),
  }))
  assert.ok(report.includes(zh.reportNoCommits))
})

test('the file table reports paths, change kinds and line counts', () => {
  const report = buildAcceptanceReport(makeInput({
    diff: makeDiff({
      files: [
        makeFile({ path: 'src/a.ts', status: 'added', additions: 3, deletions: 0 }),
        makeFile({ path: 'src/b.ts', status: 'modified', additions: 2, deletions: 1 }),
        makeFile({ path: 'old.ts', status: 'renamed', additions: 0, deletions: 0 }),
        makeFile({ path: 'gone.ts', status: 'deleted', additions: 0, deletions: 9 }),
        makeFile({ path: 'new.txt', status: 'untracked', additions: 1, deletions: 0 }),
      ],
    }),
  }))
  assert.ok(report.includes('## 改动文件'))
  assert.ok(report.includes('| 文件 | 变更 | + | - |'))
  assert.ok(report.includes('| `src/a.ts` | 新增 | 3 | 0 |'))
  assert.ok(report.includes('| `src/b.ts` | 修改 | 2 | 1 |'))
  assert.ok(report.includes('| `old.ts` | 重命名 | 0 | 0 |'))
  assert.ok(report.includes('| `gone.ts` | 删除 | 0 | 9 |'))
  assert.ok(report.includes('| `new.txt` | 未跟踪 | 1 | 0 |'))
  assert.ok(report.includes('合计：5 个文件，+6 -10'))
  // Diff bodies never travel with the report.
  assert.ok(!report.includes('export function buildAcceptanceReport'))
})

test('pipes and line breaks inside file paths cannot break the table', () => {
  const report = buildAcceptanceReport(makeInput({
    diff: makeDiff({ files: [makeFile({ path: 'a|b.ts' }), makeFile({ path: 'c\nd.ts' })] }),
  }))
  assert.ok(report.includes('| `a\\|b.ts` | 新增 | 3 | 0 |'))
  assert.ok(report.includes('| `c d.ts` | 新增 | 3 | 0 |'))
  for (const line of report.split('\n')) {
    if (line.startsWith('| `')) assert.equal(line.split(' | ').length, 4, `broken table row: ${line}`)
  }
})

test('an empty diff keeps the section with an explicit note', () => {
  const report = buildAcceptanceReport(makeInput({ diff: makeDiff({ files: [] }) }))
  assert.ok(report.includes('## 改动文件'))
  assert.ok(report.includes(zh.reportNoFiles))
  assert.ok(!report.includes('| 文件 |'))
})

test('a truncated diff is called out', () => {
  const report = buildAcceptanceReport(makeInput({ diff: makeDiff({ truncated: true }) }))
  assert.ok(report.includes(zh.reportTruncated))
})

test('a missing diff says the changes are unavailable', () => {
  const report = buildAcceptanceReport(makeInput({ diff: null }))
  assert.ok(report.includes(zh.reportNoDiff))
  assert.ok(!report.includes('| 文件 |'))
})

test('every diff failure reason gets its own explanation', () => {
  const cases = [
    ['worktree-missing', zh.reportDiffWorktreeMissing],
    ['no-merge-base', zh.reportDiffNoMergeBase],
  ] as const
  for (const [reason, text] of cases) {
    const report = buildAcceptanceReport(makeInput({ diff: makeDiff({ files: [], reason, mergeBase: null }) }))
    assert.ok(report.includes(text), `missing explanation for ${reason}`)
  }
  const failed = buildAcceptanceReport(makeInput({
    diff: makeDiff({ files: [], reason: 'error', mergeBase: null, error: 'fatal: bad object HEAD' }),
  }))
  assert.ok(failed.includes(zh.reportDiffError))
  assert.ok(failed.includes('fatal: bad object HEAD'))
})

test('an unknown diff reason falls back to the generic note', () => {
  const report = buildAcceptanceReport(makeInput({ diff: makeDiff({ files: [], reason: 'other' as any }) }))
  assert.ok(report.includes(zh.reportNoDiff))
})

test('the workspace section counts uncommitted work and pending stashes', () => {
  const report = buildAcceptanceReport(makeInput({
    task: makeTask({
      pendingStashes: [
        { sha: 'aaa111', source: 'review', ref: 'stash@{0}', createdAt: 1, files: [] },
        { sha: 'bbb222', source: 'merge', ref: 'stash@{1}', createdAt: 2, files: [] },
      ],
    }),
    snapshot: makeSnapshot({
      worktree: {
        exists: true,
        branch: 'dsh/report',
        dirtyCount: 4,
        ahead: 1,
        commits: [{ hash: 'abcdef1', subject: 'x' }],
        lastCommitAt: null,
      },
    }),
  }))
  assert.ok(report.includes('## 工作区'))
  assert.ok(report.includes('- 未提交改动: 4'))
  assert.ok(report.includes('- 待恢复暂存: 2'))
})

test('a cleaned worktree still produces a complete report', () => {
  const report = buildAcceptanceReport(makeInput({
    task: makeTask({ acceptanceCriteria: ['done'] }),
    snapshot: makeSnapshot({
      status: 'cleaned',
      worktree: { exists: false, branch: null, dirtyCount: 0, ahead: 0, commits: [], lastCommitAt: null },
    }),
    diff: makeDiff({ files: [], reason: 'worktree-missing', mergeBase: null }),
    statusLabel: boardStatusLabel(zh, boardStatus('cleaned', false)),
  }))
  assert.ok(report.includes('- 状态: 已清理'))
  assert.ok(report.includes('- [x] done'))
  assert.ok(report.includes('暂无提交'))
  assert.ok(report.includes(zh.reportDiffWorktreeMissing))
})

test('the report follows the interface language and fills every placeholder', () => {
  const report = buildAcceptanceReport(makeInput({
    t: en,
    task: makeTask({ acceptanceCriteria: ['one'] }),
    statusLabel: boardStatusLabel(en, boardStatus('review', false)),
  }))
  assert.ok(report.startsWith('# Acceptance report: 验收报告'))
  assert.ok(report.includes('- Status: Ready for review'))
  assert.ok(report.includes('## Changed files'))
  assert.ok(report.includes('Totals: 1 file(s), +3 -0'))
  assert.ok(report.includes('Progress: 0/1 verified'))
  assert.ok(!/[{]title[}]|[{]n[}]|[{]files[}]|[{]add[}]|[{]del[}]/.test(report))
})

test('both dictionaries keep the exact same report placeholders', () => {
  const placeholders = (value: string) => (value.match(/\{[a-zA-Z]+\}/g) || []).sort().join(',')
  for (const key of Object.keys(zh).filter((name) => name.startsWith('report'))) {
    assert.ok(Object.prototype.hasOwnProperty.call(en, key), `en is missing ${key}`)
    assert.equal(placeholders((en as any)[key]), placeholders((zh as any)[key]), `placeholder mismatch in ${key}`)
  }
})

// The overview is a plain function component; a createElement stub is enough to
// inspect the rendered tree without pulling React or a DOM into the test.
initReact({
  createElement: (type: any, props: any, ...children: any[]) => {
    // Function components are invoked so the overview subtree is inspectable;
    // the overview tab uses no hooks, so no dispatcher is needed.
    if (typeof type === 'function') return type({ ...(props || {}), children })
    return { type, props: props || {}, children }
  },
})

function stageProps(overrides: Partial<StageProps> = {}): StageProps {
  return {
    t: zh,
    taskView: { task: makeTask({ acceptanceCriteria: ['one'] }), snapshot: makeSnapshot() },
    projectName: 'demo',
    running: false,
    tab: 'overview',
    onTab: () => {},
    ctas: {
      secondary: { action: 'merge', label: 'boardDirectMerge' },
      primary: { action: 'checkout', label: 'boardCheckoutReview' },
    },
    disabledActions: {},
    entries: [],
    entriesReady: true,
    sessionId: '',
    onOpenSession: () => {},
    onStartSession: () => {},
    diff: makeDiff(),
    diffLoading: false,
    diffError: '',
    onRetryDiff: () => {},
    baseSha: 'aaaaaaa',
    headSha: 'bbbbbbb',
    onToggleRail: () => {},
    onToggleInspector: () => {},
    ...overrides,
  } as StageProps
}

function flatten(node: any, out: any[] = []): any[] {
  if (!node || typeof node !== 'object') return out
  out.push(node)
  for (const child of node.children || []) {
    if (Array.isArray(child)) for (const item of child) flatten(item, out)
    else flatten(child, out)
  }
  return out
}

const reportButtons = (tree: any) => flatten(tree).filter((node) =>
  node.type === 'button' && (node.children || []).some((child: any) => child === zh.reportCopy || child === zh.reportDownload))

test('the overview renders both report actions and calls their callbacks', () => {
  let copied = 0
  let downloaded = 0
  const tree = Stage(stageProps({
    onCopyReport: () => { copied += 1 },
    onDownloadReport: () => { downloaded += 1 },
  }))
  const buttons = reportButtons(tree)
  assert.equal(buttons.length, 2)
  for (const button of buttons) button.props.onClick()
  assert.equal(copied, 1)
  assert.equal(downloaded, 1)
})

test('report actions disappear without callbacks and disable while the board is busy', () => {
  assert.equal(reportButtons(Stage(stageProps())).length, 0)
  const disabled = reportButtons(Stage(stageProps({
    onCopyReport: () => {},
    onDownloadReport: () => {},
    reportBusy: true,
  })))
  assert.equal(disabled.length, 2)
  assert.ok(disabled.every((button) => button.props.disabled === true))
})

test('the report lists tags and priority in the headline facts', () => {
  const report = buildAcceptanceReport(makeInput({
    task: makeTask({ tags: ['ui', 'api'], priority: 'high' }),
  }))
  assert.ok(report.includes('- 标签: ui, api'))
  assert.ok(report.includes('- 优先级: 高'))

  const fallback = buildAcceptanceReport(makeInput())
  assert.ok(fallback.includes('- 标签: —'))
  assert.ok(fallback.includes('- 优先级: 普通'))

  const low = buildAcceptanceReport(makeInput({ task: makeTask({ priority: 'low' }) }))
  assert.ok(low.includes('- 优先级: 低'))
})

test('the report shows the deadline and how late it is', () => {
  const now = new Date(2026, 0, 5, 9, 7).getTime()
  const line = (dueAt?: number) =>
    buildAcceptanceReport(makeInput({ task: makeTask(dueAt === undefined ? {} : { dueAt }), now }))
      .split('\n')
      .find((l) => l.startsWith('- 截止日期:'))

  assert.equal(line(new Date(2026, 0, 10).getTime()), '- 截止日期: 2026-01-10', 'a future deadline is a plain date')
  assert.equal(line(new Date(2026, 0, 5, 23).getTime()), '- 截止日期: 2026-01-05', 'due today is not late yet')
  assert.equal(line(new Date(2026, 0, 2).getTime()), '- 截止日期: 2026-01-02（逾期 3 天）')
  assert.equal(line(), '- 截止日期: 未设置')
})

test('the deadline sits with the other metadata, before the criteria', () => {
  const report = buildAcceptanceReport(makeInput({ task: makeTask({ dueAt: new Date(2026, 0, 10).getTime() }) }))
  assert.ok(report.indexOf('- 优先级:') < report.indexOf('- 截止日期:'))
  assert.ok(report.indexOf('- 截止日期:') < report.indexOf('## 任务描述'))
})

test('the report has a notes section with the saved text or a fallback', () => {
  const withNotes = buildAcceptanceReport(makeInput({ task: makeTask({ notes: 'rotate the token\nafter deploy' }) }))
  assert.ok(withNotes.includes('## 备注'))
  assert.ok(withNotes.includes('rotate the token\nafter deploy'), 'notes keep their line breaks')

  const without = buildAcceptanceReport(makeInput())
  assert.ok(without.includes('## 备注\n无备注'))
})

test('metadata is placed before the criteria so the head stays scannable', () => {
  const report = buildAcceptanceReport(makeInput({ task: makeTask({ tags: ['ui'] }) }))
  assert.ok(report.indexOf('- 标签: ui') < report.indexOf('## 任务描述'))
})

test('the report has a lifecycle section between notes and commits', () => {
  const report = buildAcceptanceReport(makeInput({
    task: makeTask({
      createdAt: new Date(2026, 0, 1, 8, 30).getTime(),
      pinnedAt: new Date(2026, 0, 2, 9, 0).getTime(),
      mergedAt: new Date(2026, 0, 3, 10, 15).getTime(),
      mergedCommit: 'deadbeefcafe',
      updatedAt: new Date(2026, 0, 4, 11, 0).getTime(),
    }),
  }))
  const lifecycleAt = report.indexOf(`## ${zh.reportLifecycle}`)
  assert.ok(lifecycleAt >= 0)
  assert.ok(lifecycleAt > report.indexOf(`## ${zh.reportNotes}`))
  assert.ok(lifecycleAt < report.indexOf(`## ${zh.reportCommits}`))
  assert.ok(report.includes('- 2026-01-01 08:30 · 发布任务'))
  assert.ok(report.includes('- 2026-01-02 09:00 · 置顶任务'))
  assert.ok(report.includes('- 2026-01-03 10:15 · 合并到基线 (deadbee)'))
  assert.ok(report.includes('- 2026-01-04 11:00 · 最近更新'))
  assert.ok(report.includes('发布 → 合并 2.1 天'))
})

test('an unmerged task has no cycle line and no merge row', () => {
  const report = buildAcceptanceReport(makeInput({
    task: makeTask({ createdAt: new Date(2026, 0, 1, 8, 30).getTime() }),
  }))
  assert.ok(report.includes('- 2026-01-01 08:30 · 发布任务'))
  assert.ok(!report.includes('合并到基线'))
  assert.ok(!report.includes('发布 → 合并'))
})

test('a task without a usable timeline falls back to the empty text', () => {
  const report = buildAcceptanceReport(makeInput({ task: makeTask({ createdAt: 0 }) }))
  assert.ok(report.includes(`## ${zh.reportLifecycle}`))
  assert.ok(report.includes(zh.lifecycleEmpty))
})

test('the overview renders the lifecycle timeline with labels, short sha and cycle', () => {
  const task = makeTask({
    createdAt: new Date(2026, 0, 1, 8, 30).getTime(),
    mergedAt: new Date(2026, 0, 3, 10, 15).getTime(),
    mergedCommit: 'deadbeefcafe',
    updatedAt: new Date(2026, 0, 4, 11, 0).getTime(),
  })
  const nodes = flatten(Stage(stageProps({
    taskView: { task, snapshot: makeSnapshot({ status: 'merged' }) },
  })))
  const labels = nodes
    .filter((node) => node.props && node.props.className === 'dshwd-lifecycle-label')
    .map((node) => node.children[0])
  assert.deepEqual(labels, [zh.lifecycleCreated, zh.lifecycleMerged, zh.lifecycleUpdated])
  const sha = nodes.find((node) => node.props && node.props.className === 'dshwd-lifecycle-sha dshwd-mono')
  assert.equal(sha && sha.children[0], 'deadbee')
  const times = nodes.filter((node) => node.props && node.props.className === 'dshwd-lifecycle-time')
  assert.equal(times.length, 3)
  assert.ok(times.every((node) => typeof node.props.title === 'string' && node.props.title.length > 0))
  const cycle = nodes.find((node) => (node.children || [])[0] === '发布 → 合并 2.1 天')
  assert.ok(cycle, 'the merged task shows the publish → merge cycle')
})

test('the overview timeline degrades to the empty text and hides the cycle', () => {
  const nodes = flatten(Stage(stageProps({
    taskView: { task: makeTask({ createdAt: 0 }), snapshot: makeSnapshot() },
  })))
  assert.ok(nodes.some((node) => node.children && node.children.includes(zh.lifecycleEmpty)))
  assert.ok(!nodes.some((node) => node.props && node.props.className === 'dshwd-lifecycle-item'))
  const texts = nodes.flatMap((node) => (node.children || []).filter((child) => typeof child === 'string'))
  assert.ok(!texts.some((text) => text.includes('发布 → 合并')))
})
