import test from 'node:test'
import assert from 'node:assert/strict'
import en from '../locale/en.json'
import zh from '../locale/zh.json'
import { buildHandoverBrief, handoverFilename, type HandoverInput } from '../src/client/handover.js'
import { boardStatus, boardStatusLabel } from '../src/client/model.js'
import { Stage, type StageProps } from '../src/client/stage.js'
import { initReact } from '../src/client/ui.js'
import type { TaskSnapshot, TaskView, WorktreeTask } from '../src/models.js'

const NOW = new Date(2026, 0, 5, 9, 7).getTime()

function makeTask(overrides: Partial<WorktreeTask> = {}): WorktreeTask {
  return {
    id: '32bee859-738a-41cd-9940-96d999999999',
    projectId: 'p1',
    title: '任务交接摘要',
    description: '实现复制与下载。',
    repoPath: 'C:/repo',
    baseBranch: 'main',
    branch: 'dsh/report',
    worktreePath: 'C:/wt',
    sessionId: null,
    firstPrompt: '',
    startOnBind: false,
    dependsOn: [],
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
      commits: [{ hash: 'abcdef1234567890', subject: 'add handover' }],
      lastCommitAt: null,
    },
    repo: { exists: true, currentBranch: 'main', dirtyCount: 0 },
    branchExists: true,
    merged: false,
    status: 'review',
    ...overrides,
  }
}

function viewOf(task: WorktreeTask, snapshot: TaskSnapshot = makeSnapshot()): TaskView {
  return { task, snapshot }
}

function makeInput(overrides: Partial<HandoverInput> = {}): HandoverInput {
  const task = overrides.task ?? makeTask()
  const snapshot = overrides.snapshot ?? makeSnapshot()
  return {
    task,
    snapshot,
    views: [viewOf(task, snapshot)],
    projectName: 'demo',
    statusLabel: boardStatusLabel(zh, boardStatus(snapshot.status, false)),
    t: zh,
    now: NOW,
    ...overrides,
  }
}

const build = (overrides: Partial<HandoverInput> = {}) => buildHandoverBrief(makeInput(overrides))

/* ── file name ─────────────────────────────────────────────────────────── */

test('handoverFilename uses 8 safe id characters plus a local timestamp', () => {
  assert.equal(handoverFilename(makeTask(), NOW), 'handover-32bee859-20260105-0907.md')
})

test('handoverFilename strips unsafe characters and falls back for an empty id', () => {
  const now = new Date(2026, 10, 22, 23, 59).getTime()
  assert.equal(handoverFilename(makeTask({ id: 'AB__cd--12345678' }), now), 'handover-abcd1234-20261122-2359.md')
  assert.equal(handoverFilename(makeTask({ id: '' }), now), 'handover-task-20261122-2359.md')
  assert.match(handoverFilename(makeTask({ id: '-----' })), /^handover-task-\d{8}-\d{4}\.md$/)
})

test('handoverFilename stays stable within one minute and changes on the next', () => {
  const base = new Date(2026, 2, 1, 12, 0, 5).getTime()
  assert.equal(handoverFilename(makeTask(), base), handoverFilename(makeTask(), base + 54_000))
  assert.notEqual(handoverFilename(makeTask(), base), handoverFilename(makeTask(), base + 60_000))
})

/* ── document shape ────────────────────────────────────────────────────── */

test('the brief opens with the title and fixed section order', () => {
  const text = build()
  const lines = text.split('\n')
  assert.equal(lines[0], `# ${zh.handoverReportTitle.replace('{title}', '任务交接摘要')}`)
  assert.ok(text.endsWith('\n'))

  const order = [
    `## ${zh.taskInfo}`,
    `## ${zh.handoverSectionPlan}`,
    `## ${zh.reportNotes}`,
    `## ${zh.handoverSectionDeps}`,
    `## ${zh.handoverSectionDependents}`,
    `## ${zh.acceptanceCriteria}`,
    `## ${zh.reportCommits}`,
    `## ${zh.handoverSectionNext}`,
    zh.handoverReportNote,
  ]
  let at = -1
  for (const heading of order) {
    const next = text.indexOf(heading)
    assert.ok(next > at, `${heading} is out of order`)
    at = next
  }
})

test('every headline fact is present, with Git numbers never blank', () => {
  const text = build({
    task: makeTask({ branch: 'dsh/handover', baseBranch: 'trunk', worktreePath: 'C:/wt/handover' }),
    snapshot: makeSnapshot({ worktree: {
      exists: true,
      branch: 'dsh/handover',
      dirtyCount: 3,
      ahead: 2,
      commits: [{ hash: 'abcdef1234567890', subject: 'add handover' }],
      lastCommitAt: null,
    } }),
  })
  assert.ok(text.includes(`- ${zh.reportProject}: demo`))
  assert.ok(text.includes(`- ${zh.reportStatus}: ${zh.review}`))
  assert.ok(text.includes(`- ${zh.reportTaskBranch}: \`dsh/handover\``))
  assert.ok(text.includes(`- ${zh.reportBaseBranch}: \`trunk\``))
  assert.ok(text.includes(`- ${zh.handoverWorktree}: \`C:/wt/handover\``))
  assert.ok(text.includes(`- ${zh.reportHead}: \`abcdef1234567890\``))
  assert.ok(text.includes(`- ${zh.handoverAhead}: 2`))
  assert.ok(text.includes(`- ${zh.reportUncommitted}: 3`))
  assert.ok(text.includes(`- ${zh.reportGeneratedAt}: 2026-01-05 09:07`))
})

test('an empty project name, status and head render as placeholders instead of blanks', () => {
  const text = build({
    projectName: '',
    statusLabel: '',
    snapshot: makeSnapshot({ status: 'ready', worktree: {
      exists: false, branch: '', dirtyCount: 0, ahead: 0, commits: [], lastCommitAt: null,
    } }),
  })
  assert.ok(text.includes(`- ${zh.reportProject}: —`))
  assert.ok(text.includes(`- ${zh.reportStatus}: —`))
  assert.ok(text.includes(`- ${zh.reportHead}: \`—\``))
  assert.ok(text.includes(`- ${zh.handoverAhead}: 0`))
  assert.ok(text.includes(`- ${zh.reportUncommitted}: 0`))
})

test('planning fields carry priority, tags, due date, estimate and work time', () => {
  const text = build({
    task: makeTask({
      priority: 'high',
      tags: ['ui', 'api'],
      dueAt: new Date(2026, 0, 10).getTime(),
      estimate: 5,
      workMs: 90 * 60_000,
    }),
  })
  assert.ok(text.includes(`- ${zh.taskPriority}: ${zh.priorityHigh}`))
  assert.ok(text.includes(`- ${zh.taskTags}: ui, api`))
  assert.ok(text.includes(`- ${zh.reportDue}: 2026-01-10`))
  assert.ok(text.includes(`- ${zh.taskEstimate}: 5 点`))
  assert.ok(text.includes(`- ${zh.taskWork}: 1 小时 30 分`))
})

test('missing planning fields fall back instead of printing raw values', () => {
  const text = build({ task: makeTask({ estimate: 4 as any }) })
  assert.ok(text.includes(`- ${zh.taskPriority}: ${zh.priorityNormal}`))
  assert.ok(text.includes(`- ${zh.taskTags}: —`))
  assert.ok(text.includes(`- ${zh.reportDue}: ${zh.reportDueNone}`))
  assert.ok(text.includes(`- ${zh.taskEstimate}: ${zh.taskEstimateEmpty}`))
  assert.ok(text.includes(`- ${zh.taskWork}: ${zh.taskWorkEmpty}`))
})

test('a running timer keeps the timing marker', () => {
  const text = build({ task: makeTask({ workMs: 30 * 60_000, workStartedAt: NOW - 60_000 }) })
  assert.ok(text.includes(`- ${zh.taskWork}: 31 分${zh.taskWorkTimingSuffix}`))
})

/* ── next step: six states plus archived ───────────────────────────────── */

test('each status maps to its own next-step advice', () => {
  const cases: Array<[string, string]> = [
    ['ready', zh.handoverReportNextReady],
    ['developing', zh.handoverReportNextDeveloping],
    ['review', zh.handoverReportNextReview],
    ['reviewing', zh.handoverReportNextReview],
    ['merged', zh.handoverReportNextMerged],
    ['cleaned', zh.handoverReportNextCleaned],
    ['broken', zh.handoverReportNextBroken],
  ]
  for (const [status, expected] of cases) {
    const text = build({ snapshot: makeSnapshot({ status: status as any }) })
    const section = text.slice(text.indexOf(`## ${zh.handoverSectionNext}`))
    assert.ok(section.includes(expected), `${status} should advise its own step`)
  }
})

test('an archived task overrides every status advice', () => {
  const text = build({
    task: makeTask({ archivedAt: NOW }),
    snapshot: makeSnapshot({ status: 'merged' }),
  })
  const section = text.slice(text.indexOf(`## ${zh.handoverSectionNext}`))
  assert.ok(section.includes(zh.handoverReportNextArchived))
  assert.ok(!section.includes(zh.handoverReportNextMerged))
})

test('an unfinished prerequisite is named before the status advice', () => {
  const blocker = makeTask({ id: 'blocker-id', title: '先做前置', dependsOn: [] })
  const task = makeTask({ dependsOn: [blocker.id] })
  const text = build({
    task,
    snapshot: makeSnapshot({ status: 'developing' }),
    views: [viewOf(blocker, makeSnapshot({ status: 'developing' })), viewOf(task)],
  })
  const section = text.slice(text.indexOf(`## ${zh.handoverSectionNext}`))
  const blockedLine = zh.handoverReportBlockedBy.replace('{deps}', '先做前置')
  assert.ok(section.includes(blockedLine))
  assert.ok(section.indexOf(blockedLine) < section.indexOf(zh.handoverReportNextDeveloping))
})

/* ── dependencies ─────────────────────────────────────────────────────── */

test('prerequisites keep done, open and missing states apart', () => {
  const done = makeTask({ id: 'done-id', title: '已完成前置', mergedAt: NOW })
  const open = makeTask({ id: 'open-id', title: '未完成前置', dependsOn: [] })
  const task = makeTask({ dependsOn: [done.id, open.id, 'ghost'] })
  const text = build({
    task,
    views: [
      viewOf(done, makeSnapshot({ status: 'merged' })),
      viewOf(open, makeSnapshot({ status: 'developing' })),
      viewOf(task, makeSnapshot({ status: 'ready' })),
    ],
  })
  const section = text.slice(text.indexOf(`## ${zh.handoverSectionDeps}`), text.indexOf(`## ${zh.handoverSectionDependents}`))
  assert.ok(section.includes('- [x] 已完成前置'))
  assert.ok(section.includes('- [ ] 未完成前置'))
  assert.ok(section.includes(`- [ ] ghost · ${zh.handoverDepMissing}`))
})

test('a task without prerequisites says so, and dependents are listed with their labels', () => {
  const task = makeTask({ id: 'root' })
  const later = makeTask({ id: 'later', title: '后续任务', dependsOn: ['root'] })
  const other = makeTask({ id: 'other', title: '另一个后续', dependsOn: ['root'] })
  const text = build({
    task,
    views: [
      viewOf(task, makeSnapshot({ status: 'merged' })),
      viewOf(later, makeSnapshot({ status: 'developing' })),
      viewOf(other, makeSnapshot({ status: 'ready' })),
    ],
  })
  assert.ok(text.includes(zh.handoverReportNoDeps))
  const section = text.slice(text.indexOf(`## ${zh.handoverSectionDependents}`), text.indexOf(`## ${zh.acceptanceCriteria}`))
  assert.ok(section.includes(`- 后续任务 · ${zh.developing}`))
  assert.ok(section.includes(`- 另一个后续 · ${zh.boardReady}`))
  assert.ok(section.indexOf('另一个后续') < section.indexOf('后续任务'), 'dependents are title-sorted')
})

test('a task without dependents says so', () => {
  assert.ok(build().includes(zh.handoverReportNoDependents))
})

test('statusLabelOf takes over the dependent label when supplied', () => {
  const task = makeTask({ id: 'root' })
  const later = makeTask({ id: 'later', title: '后续任务', dependsOn: ['root'] })
  const text = build({
    task,
    views: [viewOf(task), viewOf(later)],
    statusLabelOf: () => '自定义状态',
  })
  assert.ok(text.includes('- 后续任务 · 自定义状态'))
})

/* ── acceptance criteria ──────────────────────────────────────────────── */

test('only unchecked criteria travel, with their progress count', () => {
  const text = build({
    task: makeTask({
      acceptanceCriteria: ['已核对的项', '待核对的项', '另一个待核对'],
      checkedCriteria: ['已核对的项'],
    }),
  })
  const section = text.slice(text.indexOf(`## ${zh.acceptanceCriteria}`), text.indexOf(`## ${zh.reportCommits}`))
  assert.ok(section.includes('- [ ] 待核对的项'))
  assert.ok(section.includes('- [ ] 另一个待核对'))
  assert.ok(!section.includes('已核对的项'))
  assert.equal(section.includes('- [x]'), false)
  assert.ok(section.includes(zh.reportProgress.replace('{n}', '1').replace('{total}', '3')))
})

test('all-verified and no-criteria tasks say so explicitly', () => {
  const all = build({
    task: makeTask({ acceptanceCriteria: ['a', 'b'], checkedCriteria: ['a', 'b'] }),
  })
  assert.ok(all.includes(zh.handoverReportAllChecked))
  assert.ok(!all.includes('- [ ] '))

  const none = build({ task: makeTask({ acceptanceCriteria: [] }) })
  const section = none.slice(none.indexOf(`## ${zh.acceptanceCriteria}`), none.indexOf(`## ${zh.reportCommits}`))
  assert.ok(section.includes(zh.handoverReportNoCriteria))
})

/* ── notes and commits ────────────────────────────────────────────────── */

test('notes keep their line breaks, and an empty note falls back', () => {
  const text = build({ task: makeTask({ notes: '第一行\n第二行' }) })
  assert.ok(text.includes('第一行\n第二行'))
  assert.ok(build({ task: makeTask({ notes: '' }) }).includes(zh.taskNoNotes))
})

test('zero, three and six commits render one list item each, capped at five', () => {
  const commits = (count: number) => Array.from({ length: count }, (_, index) => ({
    hash: `000000${index}ffffffffffff`,
    subject: `提交 ${index}`,
  }))

  const none = build({ snapshot: makeSnapshot({ worktree: {
    exists: true, branch: 'b', dirtyCount: 0, ahead: 0, commits: [], lastCommitAt: null,
  } }) })
  assert.ok(none.includes(zh.handoverReportNoCommits))

  const three = build({ snapshot: makeSnapshot({ worktree: {
    exists: true, branch: 'b', dirtyCount: 0, ahead: 3, commits: commits(3), lastCommitAt: null,
  } }) })
  assert.ok(three.includes('- `0000000` 提交 0'))
  assert.ok(three.includes('- `0000002` 提交 2'))
  assert.equal(three.split('\n').filter((line) => line === '- `0000002` 提交 2').length, 1)

  const six = build({ snapshot: makeSnapshot({ worktree: {
    exists: true, branch: 'b', dirtyCount: 0, ahead: 6, commits: commits(6), lastCommitAt: null,
  } }) })
  const section = six.slice(six.indexOf(`## ${zh.reportCommits}`), six.indexOf(`## ${zh.handoverSectionNext}`))
  assert.equal(section.split('\n').filter((line) => line.startsWith('- `')).length, 5)
  assert.ok(!section.includes('提交 5'), 'the sixth commit is cut off')
})

/* ── purity and robustness ────────────────────────────────────────────── */

test('the brief never leaks undefined, NaN, Infinity or a diff body', () => {
  const text = build({
    task: makeTask({ title: '', tags: [], notes: '', dependsOn: [], acceptanceCriteria: [] }),
    snapshot: { status: 'ready' } as TaskSnapshot,
    views: [],
    projectName: '',
    statusLabel: '',
  })
  assert.doesNotMatch(text, /undefined|NaN|Infinity|\bnull\b/)
  assert.ok(!text.includes('```diff'))
  assert.ok(!text.includes('文件列表:'))
})

test('the same input always produces the same text', () => {
  const input = makeInput({ task: makeTask({ dependsOn: [], notes: 'x' }) })
  assert.equal(buildHandoverBrief(input), buildHandoverBrief(input))
})

test('English renders the same section count and no placeholder leftovers', () => {
  const text = buildHandoverBrief(makeInput({ t: en, statusLabel: boardStatusLabel(en, boardStatus('review', false)) }))
  assert.match(text, /^# Handover brief: /)
  assert.ok(text.includes(`## ${en.handoverSectionNext}`))
  assert.ok(!text.includes('{title}'))
  assert.doesNotMatch(text, /undefined|NaN/)
})

test('every handover key exists in both locales with matching placeholders', () => {
  const keys = Object.keys(zh).filter((key) => key.startsWith('handover'))
  assert.ok(keys.length >= 20)
  for (const key of keys) {
    assert.ok(typeof (en as any)[key] === 'string', `${key} missing from en`)
    const placeholders = (value: string) => (value.match(/\{[a-zA-Z]+\}/g) || []).sort().join(',')
    assert.equal(placeholders((zh as any)[key]), placeholders((en as any)[key]), `${key} placeholders differ`)
  }
})

/* ── Stage wiring ─────────────────────────────────────────────────────── */

initReact({
  createElement: (type: any, props: any, ...children: any[]) => {
    if (typeof type === 'function') return type({ ...(props || {}), children })
    return { type, props: props || {}, children }
  },
  useState: (value: any) => [typeof value === 'function' ? value() : value, () => {}],
  useEffect: () => {},
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
    diff: {
      base: 'main',
      mergeBase: 'abc123',
      files: [],
      totalAdditions: 0,
      totalDeletions: 0,
      truncated: false,
    },
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

// The visible label becomes `t.working` while busy, so identify the pair by
// their stable accessible names instead of the rendered text.
const handoverButtons = (tree: any) => flatten(tree).filter((node) =>
  node.type === 'button' && (node.props['aria-label'] === zh.handoverCopy || node.props['aria-label'] === zh.handoverDownload))

test('the overview renders both handover actions and calls their callbacks', () => {
  let copied = 0
  let downloaded = 0
  const tree = Stage(stageProps({
    onCopyHandover: () => { copied += 1 },
    onDownloadHandover: () => { downloaded += 1 },
  }))
  const buttons = handoverButtons(tree)
  assert.equal(buttons.length, 2)
  for (const button of buttons) button.props.onClick()
  assert.equal(copied, 1)
  assert.equal(downloaded, 1)
})

test('handover actions disappear without callbacks, stay reachable and disable while busy', () => {
  assert.equal(handoverButtons(Stage(stageProps())).length, 0)

  const buttons = handoverButtons(Stage(stageProps({
    onCopyHandover: () => {},
    onDownloadHandover: () => {},
  })))
  assert.equal(buttons.length, 2)
  for (const button of buttons) {
    assert.equal(button.props.type, 'button')
    assert.equal(button.props.disabled, false)
    assert.ok(button.props['aria-label'])
  }

  const busy = handoverButtons(Stage(stageProps({
    onCopyHandover: () => {},
    onDownloadHandover: () => {},
    handoverBusy: true,
  })))
  assert.equal(busy.length, 2)
  assert.ok(busy.every((button) => button.props.disabled === true))
  assert.ok(busy.every((button) => (button.children || []).includes(zh.working)))
})

test('the handover section sits between the meta block and the lifecycle section', () => {
  const tree = Stage(stageProps({
    onCopyHandover: () => {},
    onDownloadHandover: () => {},
  }))
  const headings = flatten(tree)
    .filter((node) => node.props && node.props.className === 'dshwd-block-label')
    .map((node) => node.children[0])
  const meta = headings.indexOf(zh.taskInfo)
  const handover = headings.indexOf(zh.handoverTitle)
  const lifecycle = headings.indexOf(zh.taskLifecycle)
  assert.ok(meta >= 0 && handover > meta && lifecycle > handover, JSON.stringify(headings))
})
