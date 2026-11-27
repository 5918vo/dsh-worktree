import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import en from '../locale/en.json'
import zh from '../locale/zh.json'
import { buildHandoffBrief, type HandoffInput } from '../src/client/handoff.js'
import { buildAcceptanceReport, diffReasonText } from '../src/client/report.js'
import { boardStatus, boardStatusLabel } from '../src/client/model.js'
import { Stage, type StageProps } from '../src/client/stage.js'
import { initReact } from '../src/client/ui.js'
import type { DiffFile, TaskDiff, TaskSnapshot, WorktreeTask } from '../src/models.js'

function makeTask(overrides: Partial<WorktreeTask> = {}): WorktreeTask {
  return {
    id: '32bee859-738a-41cd-9940-96d999999999',
    projectId: 'p1',
    title: '交接简报',
    description: '为下一个 Agent 准备交接说明。',
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

const NOW = new Date(2026, 0, 5, 9, 7).getTime()

function makeInput(overrides: Partial<HandoffInput> = {}): HandoffInput {
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
    now: NOW,
    ...overrides,
  }
}

const brief = (overrides: Partial<HandoffInput> = {}) => buildHandoffBrief(makeInput(overrides))

/** Bullets under one `## heading`, in document order. */
function section(report: string, heading: string): string[] {
  const lines = report.split('\n')
  const start = lines.indexOf('## ' + heading)
  assert.ok(start >= 0, 'missing section: ' + heading)
  const out: string[] = []
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('## ')) break
    if (line.startsWith('- ')) out.push(line.slice(2))
  }
  return out
}

test('the brief opens with the title and lists the headline facts', () => {
  const input = makeInput({
    task: makeTask({ sessionId: 's-1' }),
    snapshot: makeSnapshot(),
  })
  const report = buildHandoffBrief(input)
  const lines = report.split('\n')
  assert.equal(lines[0], '# 交接简报：交接简报')
  assert.ok(report.includes('- 项目: demo'))
  assert.ok(report.includes('- 任务分支: `dsh/report`'))
  assert.ok(report.includes('- 基线分支: `main`'))
  assert.ok(report.includes('- 工作区: `C:/wt`'))
  assert.ok(report.includes('- 状态: ' + input.statusLabel))
  assert.ok(report.includes('- 任务 HEAD: `abcdef1234567890`'))
  assert.ok(report.includes('- 会话: `s-1`'))
  assert.ok(report.includes('- 生成时间: 2026-01-05 09:07'))
  assert.ok(report.endsWith('\n'))
})

test('the five sections keep their order', () => {
  const report = brief()
  const order = [
    '## ' + zh.handoffGoal,
    '## ' + zh.handoffProgress,
    '## ' + zh.handoffCode,
    '## ' + zh.handoffNext,
    '## ' + zh.handoffCaution,
  ]
  const indices = order.map((heading) => report.indexOf(heading))
  assert.ok(indices.every((index) => index >= 0), 'every section is present')
  assert.deepEqual(indices, [...indices].sort((a, b) => a - b), 'sections stay in the fixed order')
})

test('headline facts reuse the acceptance report wording', () => {
  const input = makeInput({
    task: makeTask({
      sessionId: 's-1',
      estimate: 5,
      workMs: 90 * 60_000,
      dueAt: new Date(2026, 0, 2).getTime(),
      pendingStashes: ['aaa', 'bbb'],
    }),
    snapshot: makeSnapshot({
      worktree: {
        exists: true,
        branch: 'dsh/report',
        dirtyCount: 2,
        ahead: 1,
        commits: [{ hash: 'abcdef1234567890', subject: 'add report' }],
        lastCommitAt: null,
      },
    }),
  })
  const report = buildAcceptanceReport(input)
  const handoff = buildHandoffBrief(input)
  const shared = [
    zh.reportProject,
    zh.reportTaskBranch,
    zh.reportBaseBranch,
    zh.reportStatus,
    zh.reportHead,
    zh.reportSession,
    zh.taskEstimate,
    zh.taskWork,
    zh.reportDue,
    zh.reportUncommitted,
    zh.reportStashes,
  ]
  for (const label of shared) {
    const line = handoff.split('\n').find((item) => item.startsWith('- ' + label + ':'))
    assert.ok(line, 'handoff is missing ' + label)
    assert.ok(report.includes(line as string), 'report disagrees about ' + label + ': ' + line)
  }
})

test('the code state lists at most five commits with short SHAs', () => {
  const commits = [
    { hash: '1111111222222222', subject: 'newest change' },
    { hash: '2222222333333333', subject: 'second change' },
    { hash: '3333333444444444', subject: 'third change' },
    { hash: '4444444555555555', subject: 'fourth change' },
    { hash: '5555555666666666', subject: 'fifth change' },
    { hash: '6666666777777777', subject: 'oldest change' },
  ]
  const report = brief({
    snapshot: makeSnapshot({
      worktree: { exists: true, branch: 'dsh/report', dirtyCount: 0, ahead: 6, commits, lastCommitAt: null },
    }),
  })
  const rows = report.split('\n').filter((line) => /^ {2}- `[0-9a-f]{7}` /.test(line))
  assert.equal(rows.length, 5)
  assert.equal(rows[0], '  - `1111111` newest change')
  assert.ok(report.includes('  - `5555555` fifth change'))
  assert.ok(!report.includes('oldest change'), 'the sixth commit is beyond the limit')
  assert.ok(rows.every((row) => !row.includes('1111111222222222')), 'commit rows use short SHAs')

  const empty = brief({ snapshot: makeSnapshot({ worktree: { exists: false, branch: '', dirtyCount: 0, ahead: 0, commits: [], lastCommitAt: null } }) })
  assert.ok(empty.includes('- ' + zh.handoffCommits + ': ' + zh.reportNoCommits))
})

test('the diff overview reports totals and at most ten files, never bodies', () => {
  const files = Array.from({ length: 12 }, (_, index) => makeFile({
    path: 'src/file-' + String(index).padStart(2, '0') + '.ts',
    additions: index + 1,
    deletions: index,
    patch: 'SECRET_PATCH_BODY ' + index,
  }))
  const report = brief({ diff: makeDiff({ files }) })
  assert.ok(report.includes('- ' + zh.handoffDiff + ': 合计：12 个文件，+78 -66'))
  const rows = report.split('\n').filter((line) => line.startsWith('  - `src/file-'))
  assert.equal(rows.length, 10)
  assert.equal(rows[0], '  - `src/file-00.ts` +1 / -0')
  assert.ok(!report.includes('SECRET_PATCH_BODY'), 'diff bodies never reach the clipboard')
  assert.ok(!report.includes('src/file-10.ts'), 'only the first ten paths are listed')
})

test('an unavailable or failed diff is explained instead of numbered', () => {
  assert.ok(brief({ diff: null }).includes('- ' + zh.handoffDiff + ': ' + zh.reportNoDiff))
  const failed = makeDiff({ reason: 'worktreeMissing' })
  assert.ok(brief({ diff: failed }).includes('- ' + zh.handoffDiff + ': ' + diffReasonText(zh, failed)))
  const empty = brief({ diff: makeDiff({ files: [] }) })
  assert.ok(empty.includes('- ' + zh.handoffDiff + ': ' + zh.reportNoFiles))
})

test('next steps follow the task status', () => {
  const next = (overrides: Partial<HandoffInput>) => section(brief(overrides), zh.handoffNext)

  assert.deepEqual(next({ snapshot: makeSnapshot({ status: 'broken' }) }), [zh.handoffNextBroken])
  assert.deepEqual(next({ snapshot: makeSnapshot({ status: 'ready' }) }), [zh.handoffNextReady])
  assert.deepEqual(next({ snapshot: makeSnapshot({ status: 'ready' }), task: makeTask({ sessionId: 's-1' }) }), [zh.handoffNextEmpty])
  assert.deepEqual(next({ snapshot: makeSnapshot({ status: 'developing' }) }), [zh.handoffNextDeveloping])
  assert.deepEqual(next({ snapshot: makeSnapshot({ status: 'reviewing' }) }), [zh.handoffNextDeveloping, zh.handoffNextReviewing])
  assert.deepEqual(next({ snapshot: makeSnapshot({ status: 'review' }) }), [zh.handoffNextReview])
  assert.deepEqual(
    next({ snapshot: makeSnapshot({ status: 'merged', merged: true, postMergeAhead: 2 }) }),
    ['分支在合并后又有 2 个提交，需要再次合并。', zh.handoffNextMerged],
  )
})

test('next steps put prerequisites first and name them', () => {
  const open = makeTask({ id: 'dep-open', title: '前置任务 A' })
  const report = brief({
    task: makeTask({ dependsOn: ['dep-open'] }),
    tasks: [open],
  })
  const bullets = section(report, zh.handoffNext)
  assert.equal(bullets[0], '先完成前置任务：前置任务 A')
  assert.ok(report.includes('- ' + zh.taskDeps + ': 仍有 1 项未完成：前置任务 A'))
})

test('next steps stay unique and stop at four', () => {
  const open = makeTask({ id: 'dep-open', title: '前置任务 A' })
  const report = brief({
    snapshot: makeSnapshot({ status: 'reviewing' }),
    task: makeTask({
      dependsOn: ['dep-open'],
      acceptanceCriteria: ['one', 'two', 'three'],
      checkedCriteria: ['one'],
    }),
    tasks: [open],
  })
  const bullets = section(report, zh.handoffNext)
  assert.equal(bullets.length, 4)
  assert.equal(new Set(bullets).size, bullets.length, 'no repeated suggestion')
  assert.ok(bullets.includes('还有 2 条验收标准未勾选。'))
})

test('progress mirrors the acceptance criteria and the dependency state', () => {
  const partial = brief({
    task: makeTask({ acceptanceCriteria: ['one', 'two'], checkedCriteria: ['one'] }),
  })
  assert.ok(partial.includes('- 验收标准：1/2'))
  assert.ok(partial.includes('- 未完成：two'))
  assert.ok(brief().includes('- 尚未设置验收标准。'))
  assert.ok(brief().includes('- ' + zh.taskDeps + ': 无前置任务'))
  assert.ok(brief({ task: makeTask({ estimate: 3 }) }).includes('- 规模估算: 3 点'))
})

test('dependencies are unknown without a task list and state why', () => {
  const input = makeInput({ task: makeTask({ dependsOn: ['dep-open'] }) })
  assert.equal(input.tasks, undefined)
  const report = buildHandoffBrief(input)
  assert.ok(report.includes('- ' + zh.taskDeps + ': ' + zh.handoffDepsUnknown))
  assert.deepEqual(section(report, zh.handoffNext), [zh.handoffNextReview], 'a missing task list adds no dependency suggestion')
})

test('dependencies report open, missing and done states', () => {
  const open = makeTask({ id: 'dep-open', title: '前置任务 A' })
  const done = makeTask({ id: 'dep-done', title: '前置任务 B', mergedAt: 1 })
  const withOpen = brief({ task: makeTask({ dependsOn: ['dep-open'] }), tasks: [open] })
  assert.ok(withOpen.includes('- ' + zh.taskDeps + ': 仍有 1 项未完成：前置任务 A'))

  const withMissing = brief({ task: makeTask({ dependsOn: ['ghost'] }), tasks: [open] })
  assert.ok(withMissing.includes('- ' + zh.taskDeps + ': 有 1 项缺失：ghost'))

  const allDone = brief({ task: makeTask({ dependsOn: ['dep-done'] }), tasks: [done] })
  assert.ok(allDone.includes('- ' + zh.taskDeps + ': 已完成'))
})

test('cautions list the traps the code cannot show', () => {
  const report = brief({
    task: makeTask({
      notes: 'rotate the token after deploy',
      pendingStashes: ['aaa', 'bbb'],
      dependsOn: ['ghost'],
      reviewSha: 'fedcba9876543210',
    }),
    snapshot: makeSnapshot({
      status: 'merged',
      merged: true,
      postMergeAhead: 2,
      reviewBehind: 1,
      worktree: {
        exists: true,
        branch: 'dsh/report',
        dirtyCount: 3,
        ahead: 1,
        commits: [{ hash: 'abcdef1234567890', subject: 'add report' }],
        lastCommitAt: null,
      },
    }),
    tasks: [],
  })
  const bullets = section(report, zh.handoffCaution)
  assert.ok(bullets.includes('任务备注：rotate the token after deploy'))
  assert.ok(bullets.includes('分支在合并后还有 2 个提交，尚未合并。'))
  assert.ok(bullets.includes('验收基于旧提交（fedcba9），分支已有更新。'))
  assert.ok(bullets.includes('工作区有 3 处未提交改动。'))
  assert.ok(bullets.includes('有 2 个待恢复 stash，接手前先确认如何处理。'))
  assert.ok(bullets.includes('前置任务缺失：ghost'))
})

test('cautions fall back when nothing is wrong', () => {
  const lines = brief().split('\n')
  assert.equal(lines[lines.indexOf('## ' + zh.handoffCaution) + 1], zh.handoffCautionNone)
})

test('the goal falls back when the description is empty', () => {
  const lines = brief({ task: makeTask({ description: '' }) }).split('\n')
  const start = lines.indexOf('## ' + zh.handoffGoal)
  assert.equal(lines[start + 1], '—')
})

test('markdown characters cannot break the brief', () => {
  const report = brief({
    task: makeTask({
      title: 'fix `a|b` *now*',
      notes: 'first line\nsecond `line`',
      description: 'keep `ticks`',
    }),
  })
  assert.equal(report.split('\n')[0], '# 交接简报：fix \\`a|b\\` *now*')
  assert.ok(report.includes('keep \\`ticks\\`'), 'descriptions escape backticks')
  assert.ok(report.includes('任务备注：first line second \\`line\\`'), 'notes collapse to one line')
  assert.ok(!report.includes('first line\nsecond'), 'notes never split a bullet')
})

test('the brief is deterministic for an injected clock and never prints NaN', () => {
  assert.equal(brief(), brief())
  const fallback = buildHandoffBrief(makeInput({ now: NaN }))
  assert.ok(!fallback.includes('NaN'))
  assert.match(fallback, /- 生成时间: \d{4}-\d{2}-\d{2} \d{2}:\d{2}/)
})

test('the english brief uses only english labels', () => {
  const report = buildHandoffBrief(makeInput({
    t: en,
    task: makeTask({ title: 'handoff', description: 'prepare the handoff' }),
    statusLabel: 'Review',
  }))
  for (const key of ['handoffGoal', 'handoffProgress', 'handoffCode', 'handoffNext', 'handoffCaution'] as const) {
    assert.ok(report.includes('## ' + en[key]), 'missing english section ' + key)
  }
  assert.ok(report.startsWith('# Handoff brief: handoff'))
  assert.ok(!/[\u4e00-\u9fff]/.test(report), 'no chinese leaks into the english brief')
})

test('every handoff key exists in both locales with matching placeholders', () => {
  const keys = Object.keys(zh).filter((key) => key.startsWith('handoff'))
  assert.ok(keys.length >= 30, 'the feature owns a full key group')
  const placeholders = (value: string) => (value.match(/\{[a-zA-Z]+\}/g) || []).sort()
  for (const key of keys) {
    assert.ok(Object.prototype.hasOwnProperty.call(en, key), 'en is missing ' + key)
    assert.deepEqual(placeholders((en as any)[key]), placeholders((zh as any)[key]), 'placeholder mismatch: ' + key)
  }
})

test('every handoff key used by the client exists in both locales', () => {
  const sources = ['src/client/handoff.ts', 'src/client/stage.ts', 'src/client/board/use-board-actions.ts']
  const used = new Set<string>()
  for (const file of sources) {
    const text = readFileSync(file, 'utf8')
    for (const match of text.matchAll(/t\.(handoff[A-Za-z0-9_]*)/g)) used.add(match[1])
  }
  assert.ok(used.size > 0, 'no handoff keys found in the client sources')
  for (const key of used) {
    assert.ok(Object.prototype.hasOwnProperty.call(zh, key), 'zh is missing ' + key)
    assert.ok(Object.prototype.hasOwnProperty.call(en, key), 'en is missing ' + key)
  }
})

// --- overview rendering -----------------------------------------------------

initReact({
  createElement: (type: any, props: any, ...children: any[]) => {
    if (typeof type === 'function') return type({ ...(props || {}), children })
    return { type, props: props || {}, children }
  },
  useState: (initial: any) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect: () => {},
} as any)

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

const handoffButtons = (tree: any) => flatten(tree).filter((node) =>
  node.type === 'button' && (node.children || []).some((child: any) => child === zh.handoffCopy))

test('the overview renders the handoff block between task info and the lifecycle', () => {
  const nodes = flatten(Stage(stageProps()))
  const labelIndex = (label: string) => nodes.findIndex((node) =>
    (node.props.className || '').includes('dshwd-block-label')
    && (node.children || []).some((child: any) => child === label))

  const info = labelIndex(zh.taskInfo)
  const handoff = labelIndex(zh.handoffTitle)
  const lifecycle = labelIndex(zh.taskLifecycle)
  assert.ok(handoff >= 0, 'the handoff block is rendered')
  assert.ok(info >= 0 && info < handoff, 'the handoff block follows the task info')
  assert.ok(lifecycle > handoff, 'the handoff block precedes the lifecycle')
  assert.ok(nodes.some((node) => (node.props.className || '').includes('dshwd-handoff-hint')
    && (node.children || []).some((child: any) => child === zh.handoffHint)))
})

test('the handoff action calls back and carries the task title', () => {
  let copied = 0
  const tree = Stage(stageProps({ onCopyHandoff: () => { copied += 1 } }))
  const buttons = handoffButtons(tree)
  assert.equal(buttons.length, 1)
  assert.equal(buttons[0].props['aria-label'], zh.handoffCopy + ' · 交接简报')
  buttons[0].props.onClick()
  assert.equal(copied, 1)
})

test('the handoff action hides without a callback and disables while busy', () => {
  assert.equal(handoffButtons(Stage(stageProps())).length, 0)
  const busy = handoffButtons(Stage(stageProps({ onCopyHandoff: () => {}, handoffBusy: true })))
  assert.equal(busy.length, 1)
  assert.equal(busy[0].props.disabled, true)
  assert.equal(busy[0].props.title, zh.working)
})
