import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SYNC_FILE_LIMIT,
  manualSyncCommand,
  mergeDialogSections,
  mergePreviewFiles,
  mergeRiskChip,
  postMergeCount,
  previewFilesText,
  previewNoCheck,
  reviewStaleCount,
  syncApplicable,
  syncPromptText,
} from '../src/client/review-surfaces'

const t: any = {
  branchLabel: 'branch',
  boardTargetBase: 'base',
  commits: 'commits',
  uncommitted: 'dirty',
  changesUnit: 'changes',
  mergeNoAutoStash: 'no auto-stash',
  clean: 'clean',
  acceptanceCriteria: 'acceptance',
  'boardCriteriaProgress': '{n}/{total}',
  mergeSectionObject: 'object',
  mergeSectionRisk: 'risk',
  mergeRiskConflictFiles: 'conflicts',
  mergeOverlapLabel: 'overlapping',
  mergeRiskBaseline: 'baseline',
  syncPrompt: 'sync {base} into {branch}: {files}',
  mergePreviewConflict: 'conflict {n}',
  mergePreviewOverlap: 'overlap {n}',
  mergePreviewBaseAhead: 'ahead {n}',
}

const task = { baseBranch: 'master', branch: 'feat/x' }

test('manualSyncCommand walks into the worktree and merges the base', () => {
  assert.equal(
    manualSyncCommand({ worktreePath: 'D:\\wt\\repo\\96aa88c3', baseBranch: 'main' }),
    'cd /d "D:\\wt\\repo\\96aa88c3"\ngit merge "main"',
  )
})

// cmd.exe refuses a plain `cd` across drives; `/d` is a no-op for PowerShell and
// POSIX shells, so one copied command works in every terminal the user may have.
test('manualSyncCommand changes drive and quotes both arguments', () => {
  const command = manualSyncCommand({ worktreePath: 'C:\\Users\\liang\\wt\\a', baseBranch: 'release/1.2' })
  assert.equal(command.split('\n')[0], 'cd /d "C:\\Users\\liang\\wt\\a"')
  assert.equal(command.split('\n')[1], 'git merge "release/1.2"')
})

test('manualSyncCommand keeps the two steps separate for old shells', () => {
  const command = manualSyncCommand({ worktreePath: '/srv/wt/a', baseBranch: 'trunk' })
  assert.equal(command.split('\n').length, 2)
  assert.equal(command.includes('&&'), false)
  assert.match(command, /\ngit merge "trunk"$/)
})

test('manualSyncCommand stays empty without a worktree', () => {
  assert.equal(manualSyncCommand({ baseBranch: 'main' }), '')
  assert.equal(manualSyncCommand(null), '')
})

test('manualSyncCommand falls back to main only when the base is missing', () => {
  assert.match(manualSyncCommand({ worktreePath: '/srv/wt/a' }), /\ngit merge "main"$/)
  assert.match(manualSyncCommand({ worktreePath: '/srv/wt/a', baseBranch: '  ' }), /\ngit merge "main"$/)
})

test('sync prompt fills the placeholders and quotes file names', () => {
  const text = syncPromptText(t, task, ['src/a.ts', 'docs/b.md'])
  assert.equal(text, 'sync master into feat/x: `src/a.ts`、`docs/b.md`')
})

test('sync prompt renders an em dash when there is nothing to list', () => {
  assert.equal(syncPromptText(t, task, []), 'sync master into feat/x: —')
})

test('sync prompt strips backticks so a file name cannot escape its code span', () => {
  const text = syncPromptText(t, task, ['a`rm -rf`b', 'c``d'])
  assert.equal(text, 'sync master into feat/x: `arm -rfb`、`cd`')
})

test('sync prompt flattens control characters and keeps dollar patterns literal', () => {
  const text = syncPromptText(t, { baseBranch: 'm$1', branch: 'feat/$&x' }, ['a\nb.md'])
  assert.equal(text, 'sync m$1 into feat/$&x: `a b.md`')
})

test('sync prompt caps the file list at 20 and marks the overflow', () => {
  const files = Array.from({ length: SYNC_FILE_LIMIT + 3 }, (_, i) => `f${i}.ts`)
  const text = syncPromptText(t, task, files)
  assert.equal(text.includes('`f19.ts`'), true)
  assert.equal(text.includes('f20.ts'), false)
  assert.equal(text.endsWith('…'), true)
  assert.equal(text, 'sync master into feat/x: '
    + Array.from({ length: SYNC_FILE_LIMIT }, (_, i) => '`f' + i + '.ts`').join('、') + '…')
})

test('sync prompt with exactly the cap has no ellipsis', () => {
  const files = Array.from({ length: SYNC_FILE_LIMIT }, (_, i) => `f${i}.ts`)
  assert.equal(syncPromptText(t, task, files).endsWith('…'), false)
})

test('preview file list prefers conflicts, falls back to overlaps, then empty', () => {
  assert.deepEqual(mergePreviewFiles(null), [])
  assert.deepEqual(mergePreviewFiles({ conflictFiles: ['a'], overlapFiles: ['b', 'c'] }), ['a'])
  assert.deepEqual(mergePreviewFiles({ conflictFiles: [], overlapFiles: ['b', 'c'] }), ['b', 'c'])
  // A conflict flag with a missing file list still wins over overlaps.
  assert.deepEqual(mergePreviewFiles({ conflict: true, conflictFiles: [], overlapFiles: ['b'] }), [])
})

test('risk chip prefers conflict, then overlap, then base-ahead', () => {
  assert.deepEqual(
    mergeRiskChip(t, { conflict: true, conflictFiles: ['a', 'b'], overlapFiles: ['a'], baseAhead: 5 }),
    { tone: 'err', label: 'conflict 2' },
  )
  // A bare conflict flag without a file list still reports one file.
  assert.deepEqual(
    mergeRiskChip(t, { conflict: true, conflictFiles: [], baseAhead: 5 }),
    { tone: 'err', label: 'conflict 1' },
  )
  assert.deepEqual(
    mergeRiskChip(t, { conflict: false, conflictFiles: [], overlapFiles: ['a', 'b', 'c'], baseAhead: 5 }),
    { tone: 'warn', label: 'overlap 3' },
  )
  assert.deepEqual(
    mergeRiskChip(t, { overlapFiles: [], baseAhead: 4 }),
    { tone: 'neutral', label: 'ahead 4' },
  )
  assert.equal(mergeRiskChip(t, { overlapFiles: [], baseAhead: 0 }), null)
  assert.equal(mergeRiskChip(t, null), null)
})

test('panel file list shows at most 8 names and marks the overflow', () => {
  const files = Array.from({ length: 11 }, (_, i) => `f${i}.ts`)
  const text = previewFilesText(files)
  assert.equal(text, 'f0.ts、f1.ts、f2.ts、f3.ts、f4.ts、f5.ts、f6.ts、f7.ts…')
  assert.equal(previewFilesText(files, 2), 'f0.ts、f1.ts…')
  assert.equal(previewFilesText([]), '—')
})

test('base sync is only offered when the base moved or files overlap', () => {
  assert.equal(syncApplicable(null), false)
  assert.equal(syncApplicable({ baseAhead: 0, conflictFiles: [], overlapFiles: [] }), false)
  assert.equal(syncApplicable({ baseAhead: 2 }), true)
  assert.equal(syncApplicable({ baseAhead: 0, overlapFiles: ['a'] }), true)
  assert.equal(syncApplicable({ baseAhead: 0, conflict: true, conflictFiles: ['a'] }), true)
})

test('the no-check hint only appears for unsupported or unchecked previews', () => {
  assert.equal(previewNoCheck(null), false)
  assert.equal(previewNoCheck({ supported: true, checked: true }), false)
  assert.equal(previewNoCheck({ supported: false }), true)
  assert.equal(previewNoCheck({ checked: false }), true)
})

test('post-merge banner needs newer unmerged commits', () => {
  assert.equal(postMergeCount(null), 0)
  assert.equal(postMergeCount({ postMergeAhead: 0 }), 0)
  assert.equal(postMergeCount({ postMergeAhead: 3 }), 3)
})

test('stale-review warning only applies while reviewing', () => {
  assert.equal(reviewStaleCount('reviewing', { reviewBehind: 2 }), 2)
  assert.equal(reviewStaleCount('reviewing', { reviewBehind: 0 }), 0)
  assert.equal(reviewStaleCount('review', { reviewBehind: 2 }), 0)
  assert.equal(reviewStaleCount('merged', { reviewBehind: 2 }), 0)
  assert.equal(reviewStaleCount('reviewing', null), 0)
})

test('merge dialog reads as object first, risk only when there is one', () => {
  const clean = mergeDialogSections(t, {
    branch: 'task/a',
    baseBranch: 'main',
    ahead: 3,
    dirty: 0,
    criteriaChecked: 2,
    criteriaTotal: 2,
    conflict: false,
    conflictFiles: [],
    overlapFiles: [],
    baseAhead: 0,
  })
  assert.deepEqual(clean.map((section) => section.key), ['object'])
  assert.deepEqual(clean[0].rows.map((row) => row.label), ['branch', 'base', 'commits', 'dirty', 'acceptance'])
  assert.deepEqual(clean[0].rows[2], { label: 'commits', value: '3' })
})

test('a dirty worktree and unchecked criteria are stated, not glossed over', () => {
  const sections = mergeDialogSections(t, {
    branch: 'task/a',
    baseBranch: 'main',
    ahead: 1,
    dirty: 4,
    criteriaChecked: 1,
    criteriaTotal: 3,
    conflict: false,
    conflictFiles: [],
    overlapFiles: [],
    baseAhead: 0,
  })
  const rows = sections[0].rows
  assert.match(rows[3].value, /^4 changes · no auto-stash$/)
  assert.equal(rows[4].value, '1/3')
})

test('overlap, conflicts and a moved baseline collect into one risk section', () => {
  const overlap = mergeDialogSections(t, {
    branch: 'task/a',
    baseBranch: 'main',
    ahead: 1,
    dirty: 0,
    criteriaChecked: 0,
    criteriaTotal: 0,
    conflict: false,
    conflictFiles: [],
    overlapFiles: ['src/a.ts', 'src/b.ts'],
    baseAhead: 2,
  })
  assert.deepEqual(overlap.map((section) => section.key), ['object', 'risk'])
  assert.deepEqual(overlap[1].rows[0], { label: 'overlapping', value: 'src/a.ts、src/b.ts', mono: true })
  assert.deepEqual(overlap[1].rows[1], { label: 'baseline', value: 'ahead 2' })

  const conflict = mergeDialogSections(t, {
    branch: 'task/a',
    baseBranch: 'main',
    ahead: 1,
    dirty: 0,
    criteriaChecked: 0,
    criteriaTotal: 0,
    conflict: true,
    conflictFiles: ['src/c.ts'],
    overlapFiles: [],
    baseAhead: 0,
  })
  assert.equal(conflict[1].rows[0].label, 'conflicts')
  assert.equal(conflict[1].rows[0].value, 'src/c.ts')
})

test('a conflict without a file list still names the risk instead of hiding it', () => {
  const sections = mergeDialogSections(t, {
    branch: 'task/a',
    baseBranch: 'main',
    ahead: 1,
    dirty: 0,
    criteriaChecked: 0,
    criteriaTotal: 0,
    conflict: true,
    conflictFiles: [],
    overlapFiles: ['src/a.ts'],
    baseAhead: 0,
  })
  assert.equal(sections[1].key, 'risk')
  assert.equal(sections[1].rows[0].value, 'src/a.ts')
})
