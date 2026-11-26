import test from 'node:test'
import assert from 'node:assert/strict'
import { cloneTaskDraft } from '../src/client/task-clone.js'

const SUFFIX = ' (copy)'

const task = (extra: any = {}) => ({
  id: 't1',
  projectId: 'p1',
  title: 'Fix the parser',
  description: 'Handle empty input.',
  repoPath: '/repo',
  baseBranch: 'main',
  branch: 'dsh-wt/t1',
  worktreePath: '/repo/.worktrees/t1',
  sessionId: 's1',
  firstPrompt: 'go',
  startOnBind: false,
  ...extra,
})

test('cloneTaskDraft copies the publishable fields', () => {
  const draft = cloneTaskDraft(task({
    acceptanceCriteria: ['parses empty input', 'keeps the API stable'],
    tags: ['bug', 'parser'],
    priority: 'high',
    estimate: 3,
  }) as any, SUFFIX)
  assert.deepEqual(draft, {
    title: 'Fix the parser' + SUFFIX,
    description: 'Handle empty input.',
    manualCriteria: 'parses empty input\nkeeps the API stable',
    pickedCriteria: [],
    branchName: '',
    tags: 'bug, parser',
    priority: 'high',
    dueAt: '',
    estimate: '3',
  })
})

test('cloneTaskDraft keeps low priority and string estimates', () => {
  const draft = cloneTaskDraft(task({ priority: 'low', estimate: '5' }) as any, SUFFIX)
  assert.equal(draft.priority, 'low')
  assert.equal(draft.estimate, '5')
})

test('cloneTaskDraft trims the title before appending the suffix', () => {
  const draft = cloneTaskDraft(task({ title: '  Fix the parser  ' }) as any, SUFFIX)
  assert.equal(draft.title, 'Fix the parser' + SUFFIX)
})

test('cloneTaskDraft appends the suffix once for an already-suffixed title', () => {
  const draft = cloneTaskDraft(task({ title: 'Fix the parser' + SUFFIX }) as any, SUFFIX)
  assert.equal(draft.title, 'Fix the parser' + SUFFIX)
})

test('cloneTaskDraft leaves an empty title as just the suffix', () => {
  assert.equal(cloneTaskDraft(task({ title: '' }) as any, SUFFIX).title, SUFFIX)
  assert.equal(cloneTaskDraft(task({ title: '   ' }) as any, SUFFIX).title, SUFFIX)
  assert.equal(cloneTaskDraft(task({ title: null }) as any, SUFFIX).title, SUFFIX)
})

test('cloneTaskDraft with an empty suffix keeps the trimmed title', () => {
  const draft = cloneTaskDraft(task({ title: ' Fix it ' }) as any, '')
  assert.equal(draft.title, 'Fix it')
  assert.equal(draft.dueAt, '')
})

test('cloneTaskDraft drops blank and duplicate criteria', () => {
  const draft = cloneTaskDraft(task({
    acceptanceCriteria: ['  one  ', '', '   ', 'two', 'one', 42 as any],
  }) as any, SUFFIX)
  assert.equal(draft.manualCriteria, 'one\ntwo')
  assert.deepEqual(draft.pickedCriteria, [])
})

test('cloneTaskDraft handles missing or invalid metadata', () => {
  const draft = cloneTaskDraft(task({
    acceptanceCriteria: undefined,
    tags: 'not-an-array' as any,
    priority: 'urgent' as any,
    estimate: 4 as any,
  }) as any, SUFFIX)
  assert.equal(draft.manualCriteria, '')
  assert.equal(draft.tags, '')
  assert.equal(draft.priority, 'normal')
  assert.equal(draft.estimate, '')
})

test('cloneTaskDraft normalizes a missing priority and a boolean estimate', () => {
  const missing = cloneTaskDraft(task({ priority: undefined }) as any, SUFFIX)
  assert.equal(missing.priority, 'normal')
  const boolEstimate = cloneTaskDraft(task({ estimate: true as any }) as any, SUFFIX)
  assert.equal(boolEstimate.estimate, '')
})

test('cloneTaskDraft clears the deadline and the branch', () => {
  const draft = cloneTaskDraft(task({ dueAt: 1767225600000 }) as any, SUFFIX)
  assert.equal(draft.dueAt, '')
  assert.equal(draft.branchName, '')
})

test('cloneTaskDraft does not mutate the task', () => {
  const source = task({
    title: ' Fix the parser ',
    acceptanceCriteria: ['a', 'a', 'b'],
    tags: ['x', 'y'],
    priority: 'high',
    estimate: 8,
    dueAt: 123,
  }) as any
  const before = JSON.parse(JSON.stringify(source))
  cloneTaskDraft(source, SUFFIX)
  assert.deepEqual(source, before)
})

test('cloneTaskDraft is safe on an empty task', () => {
  const draft = cloneTaskDraft({} as any, SUFFIX)
  assert.deepEqual(draft, {
    title: SUFFIX,
    description: '',
    manualCriteria: '',
    pickedCriteria: [],
    branchName: '',
    tags: '',
    priority: 'normal',
    dueAt: '',
    estimate: '',
  })
  assert.deepEqual(cloneTaskDraft(undefined as any, ''), {
    title: '',
    description: '',
    manualCriteria: '',
    pickedCriteria: [],
    branchName: '',
    tags: '',
    priority: 'normal',
    dueAt: '',
    estimate: '',
  })
})
