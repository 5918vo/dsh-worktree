import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SYNC_FILE_LIMIT,
  manualSyncCommand,
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
  syncPrompt: 'sync {base} into {branch}: {files}',
  mergePreviewConflict: 'conflict {n}',
  mergePreviewOverlap: 'overlap {n}',
  mergePreviewBaseAhead: 'ahead {n}',
}

const task = { baseBranch: 'master', branch: 'feat/x' }

test('manualSyncCommand walks into the worktree and merges the base', () => {
  assert.equal(
    manualSyncCommand({ worktreePath: 'D:\\wt\\repo\\96aa88c3', baseBranch: 'main' }),
    'cd "D:\\wt\\repo\\96aa88c3"\ngit merge main',
  )
})

test('manualSyncCommand keeps the two steps separate for old shells', () => {
  const command = manualSyncCommand({ worktreePath: '/srv/wt/a', baseBranch: 'trunk' })
  assert.equal(command.split('\n').length, 2)
  assert.equal(command.includes('&&'), false)
  assert.match(command, /\ngit merge trunk$/)
})

test('manualSyncCommand stays empty without a worktree', () => {
  assert.equal(manualSyncCommand({ baseBranch: 'main' }), '')
  assert.equal(manualSyncCommand(null), '')
})

test('manualSyncCommand falls back to main only when the base is missing', () => {
  assert.match(manualSyncCommand({ worktreePath: '/srv/wt/a' }), /\ngit merge main$/)
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
