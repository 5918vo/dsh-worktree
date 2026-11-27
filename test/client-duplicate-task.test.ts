import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import zh from '../locale/zh.json'
import en from '../locale/en.json'
import { draftFromTask, initialPublishForm, publishDraftDirty } from '../src/client/publish-state.js'
import { Stage, type StageProps } from '../src/client/stage.js'
import { initReact } from '../src/client/ui.js'
import type { TaskSnapshot, WorktreeTask } from '../src/models.js'

function makeTask(overrides: Partial<WorktreeTask> = {}): WorktreeTask {
  return {
    id: '32bee859-738a-41cd-9940-96d999999999',
    projectId: 'p1',
    title: '复制任务',
    description: '按同样规格再做一个。',
    repoPath: 'C:/repo',
    baseBranch: 'develop',
    branch: 'dsh/copy',
    worktreePath: 'C:/wt',
    sessionId: 's-1',
    firstPrompt: 'do it',
    startOnBind: false,
    acceptanceCriteria: ['one', 'two'],
    checkedCriteria: ['one'],
    tags: ['ui', 'batch'],
    priority: 'high',
    estimate: 5,
    dueAt: 1735689600000,
    notes: 'internal only',
    dependsOn: ['other-id'],
    workMs: 60_000,
    ...overrides,
  }
}

function makeSnapshot(overrides: Partial<TaskSnapshot> = {}): TaskSnapshot {
  return {
    worktree: {
      exists: true,
      branch: 'dsh/copy',
      dirtyCount: 0,
      ahead: 1,
      commits: [],
      lastCommitAt: null,
    },
    repo: { exists: true, currentBranch: 'main', dirtyCount: 0 },
    branchExists: true,
    merged: false,
    status: 'review',
    ...overrides,
  }
}

test('draftFromTask copies the reusable spec of a complete task', () => {
  const draft = draftFromTask(makeTask())
  assert.equal(draft.title, '复制任务')
  assert.equal(draft.description, '按同样规格再做一个。')
  assert.equal(draft.manualCriteria, 'one\ntwo', 'every criterion lands in the manual textarea')
  assert.deepEqual(draft.pickedCriteria, [], 'library picks stay empty')
  assert.equal(draft.tags, 'ui, batch')
  assert.equal(draft.priority, 'high')
  assert.equal(draft.estimate, '5', 'estimate is copied as the select value')
  assert.equal(draft.baseBranch, 'develop')
})

test('draftFromTask leaves one-off fields unset', () => {
  const draft = draftFromTask(makeTask())
  assert.equal(draft.branchName, '', 'a new task must get its own generated branch')
  assert.equal(draft.dueAt, '', 'an old deadline must not make the copy late on day one')
  assert.ok(!('notes' in draft), 'notes never carry over')
  assert.ok(!('checkedCriteria' in draft), 'checked state never carries over')
  assert.ok(!('dependsOn' in draft), 'prerequisites never carry over')
  assert.ok(!('sessionId' in draft))
  assert.ok(!('workMs' in draft))
})

test('draftFromTask never picks up the checked subset', () => {
  const draft = draftFromTask(makeTask({
    acceptanceCriteria: ['one', 'two'],
    checkedCriteria: ['one'],
  }))
  assert.equal(draft.manualCriteria, 'one\ntwo')
  assert.deepEqual(draft.pickedCriteria, [])
})

test('draftFromTask normalizes duplicate and blank criteria', () => {
  const draft = draftFromTask(makeTask({ acceptanceCriteria: ['  one  ', '', 'one', 'two', '   '] }))
  assert.equal(draft.manualCriteria, 'one\ntwo')
  assert.equal(draftFromTask(makeTask({ acceptanceCriteria: undefined })).manualCriteria, '')
  assert.equal(draftFromTask(makeTask({ acceptanceCriteria: { a: 1 } as any })).manualCriteria, '', 'non-array input reads as unset')
  // normalizeCriteria also accepts multiline text, so a stray string is not dropped.
  assert.equal(draftFromTask(makeTask({ acceptanceCriteria: 'oops' as any })).manualCriteria, 'oops')
})

test('draftFromTask keeps only low/high priority and a valid estimate', () => {
  assert.equal(draftFromTask(makeTask({ priority: 'low' })).priority, 'low')
  assert.equal(draftFromTask(makeTask({ priority: 'normal' })).priority, 'normal')
  assert.equal(draftFromTask(makeTask({ priority: 'urgent' as any })).priority, 'normal')
  assert.equal(draftFromTask(makeTask({ priority: undefined })).priority, 'normal')
  assert.equal(draftFromTask(makeTask({ estimate: 8 })).estimate, '8')
  assert.equal(draftFromTask(makeTask({ estimate: '3' })).estimate, '3')
  assert.equal(draftFromTask(makeTask({ estimate: 4 as any })).estimate, '')
  assert.equal(draftFromTask(makeTask({ estimate: '3.5' as any })).estimate, '')
  assert.equal(draftFromTask(makeTask({ estimate: undefined })).estimate, '')
})

test('draftFromTask handles an empty or partial task without throwing', () => {
  const empty = draftFromTask({} as WorktreeTask)
  assert.deepEqual(empty, {
    title: '',
    description: '',
    manualCriteria: '',
    pickedCriteria: [],
    branchName: '',
    tags: '',
    priority: 'normal',
    dueAt: '',
    estimate: '',
    baseBranch: '',
  })
  assert.equal(draftFromTask(null as any).title, '')
  const partial = draftFromTask({ title: 42, tags: [' a ', '', 'b'] } as any)
  assert.equal(partial.title, '42')
  assert.equal(partial.tags, 'a, b')
  assert.equal(draftFromTask({ tags: 'a,b' } as any).tags, '', 'a string is not a tag list')
})

test('initialPublishForm restores a draft base branch', () => {
  assert.equal(initialPublishForm({ baseBranch: 'release' }).baseBranch, 'release')
  assert.equal(initialPublishForm(undefined).baseBranch, '')
  assert.equal(initialPublishForm({ baseBranch: null }).baseBranch, '')
  assert.equal(initialPublishForm(draftFromTask(makeTask())).baseBranch, 'develop')
})

test('publishDraftDirty notices a base branch change but not undefined/empty', () => {
  const base = initialPublishForm({ title: 'x', baseBranch: 'main' })
  assert.equal(publishDraftDirty(base, { ...base, baseBranch: 'develop' }), true)
  assert.equal(publishDraftDirty(base, { ...base, baseBranch: 'main' }), false)
  assert.equal(publishDraftDirty({ ...base, baseBranch: '' }, { ...base, baseBranch: undefined }), false)
  assert.equal(publishDraftDirty(base, { ...base, baseBranch: '' }), true)
})

test('a duplicated draft seeds the initial publish base, blank falls back to the project', () => {
  // Mirrors the publish modal's initial state rule: draft base first, then the
  // project default. A draft without a base never pins the project baseline.
  const seed = (draft: any, projectBase: string) => {
    const form0 = initialPublishForm(draft)
    return form0.baseBranch || projectBase
  }
  assert.equal(seed(draftFromTask(makeTask()), 'main'), 'develop')
  assert.equal(seed(draftFromTask(makeTask({ baseBranch: '' })), 'main'), 'main')
  assert.equal(seed(null, 'main'), 'main')
})

// The Stage header is a plain function component; a createElement stub is enough
// to inspect the rendered tree. Function components are invoked so the header
// subtree is visible, and the hooks the overview tab may use are no-ops here.
initReact({
  createElement: (type: any, props: any, ...children: any[]) => {
    if (typeof type === 'function') return type({ ...(props || {}), children })
    return { type, props: props || {}, children }
  },
  useState: (value: any) => [typeof value === 'function' ? value() : value, () => {}],
  useEffect: () => {},
  useRef: (value: any) => ({ current: value }),
})

function flatten(node: any, out: any[] = []): any[] {
  if (!node || typeof node !== 'object') return out
  out.push(node)
  for (const child of node.children || []) {
    if (Array.isArray(child)) for (const item of child) flatten(item, out)
    else flatten(child, out)
  }
  return out
}

function stageProps(overrides: Partial<StageProps> = {}): StageProps {
  return {
    t: zh,
    taskView: { task: makeTask(), snapshot: makeSnapshot() },
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
    diff: null,
    diffLoading: false,
    diffError: '',
    onRetryDiff: () => {},
    baseSha: '',
    headSha: '',
    onToggleRail: () => {},
    onToggleInspector: () => {},
    ...overrides,
  } as StageProps
}

const duplicateButtons = (tree: any) => flatten(tree).filter((node) =>
  node.type === 'button' && typeof node.props['aria-label'] === 'string'
    && node.props['aria-label'].startsWith(zh.taskDuplicate))

test('the stage header offers duplicate only when the board wires it', () => {
  assert.equal(duplicateButtons(Stage(stageProps())).length, 0)
  const callbacks: number[] = []
  const buttons = duplicateButtons(Stage(stageProps({ onDuplicate: () => { callbacks.push(1) } })))
  assert.equal(buttons.length, 1)
  assert.equal(buttons[0].props.title, zh.taskDuplicateHint)
  assert.equal(buttons[0].props['aria-label'], zh.taskDuplicate + ' · 复制任务')
  buttons[0].props.onClick()
  assert.equal(callbacks.length, 1)
})

test('the duplicate entry sits before the primary CTA row', () => {
  const tree = Stage(stageProps({ onDuplicate: () => {} }))
  const button = duplicateButtons(tree)[0]
  assert.ok(button)
  // The row holding the duplicate button also holds the CTA buttons, and the
  // duplicate entry is its first child (before both CTAs).
  const row = flatten(tree).find((node) => node.type === 'div'
    && (node.children || []).some((child: any) => child === button))
  assert.ok(row, 'the action row exists')
  assert.equal(row.children[0], button)
  assert.ok(row.children.some((child: any) => child && child.type === 'button' && child !== button))
})

test('the board clears the draft on a plain publish and seeds it on duplicate', () => {
  const board = readFileSync(new URL('../src/client/board.ts', import.meta.url), 'utf8')
  assert.match(board, /const openPublish = \(projectId\?: string, parentId = '', draft: any = null\) =>/)
  assert.match(board, /setPublishDraft\(draft\)\r?\n\s*setPublishOpen\(true\)/)
  assert.match(board, /const duplicateTask = \(tv: TaskView\) => \{\r?\n\s*openPublish\(tv\.task\.projectId \|\| selectedProjectId, '', draftFromTask\(tv\.task\)\)/)
  assert.match(board, /onDuplicate: selectedTask \? \(\) => duplicateTask\(selectedTask\) : undefined/)
})

test('locale carries the duplicate copy in both languages', () => {
  for (const key of ['taskDuplicate', 'taskDuplicateHint']) {
    assert.ok(Object.prototype.hasOwnProperty.call(zh, key), `zh is missing ${key}`)
    assert.ok(Object.prototype.hasOwnProperty.call(en, key), `en is missing ${key}`)
    assert.notEqual((zh as any)[key], '')
    assert.notEqual((en as any)[key], '')
  }
})
