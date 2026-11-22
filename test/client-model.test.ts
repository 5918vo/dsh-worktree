import test from 'node:test'
import assert from 'node:assert/strict'
import {
  criteria,
  criteriaProgress,
  boardBranch,
  boardCta,
  boardStat,
  boardStatus,
  diffBaseSha,
  diffCount,
  diffHeadSha,
  diffLineKind,
  filterProjectViews,
  matchesSearch,
  mergeSummary,
  mergeSummaryText,
  pathPreview,
  railEmptyKind,
  shortSha,
  switchConfirmText,
  taskMergeSummary,
  themeFor,
  type BoardStatus,
} from '../src/client/model.js'

const T = {
  boardReady: '待开始',
  developing: '进行中',
  boardAgentRunning: 'Agent 正在运行',
  review: '待验收',
  reviewing: '验收中',
  merged: '已合并',
  cleaned: '已清理',
  broken: '异常',
  boardDirectMerge: '直接合并',
  boardCheckoutReview: '切到主仓库验收',
  boardViewLogs: '查看日志',
  boardBack: '返回原分支',
  boardOpenSession: '打开原生会话',
  boardCreateSession: '创建并启动会话',
  boardStartAgent: '启动 Agent 会话',
  boardFollowUp: '派生后续任务',
  boardCleanup: '清理 Worktree',
  boardPreviewChecking: '检查中',
  boardPreviewConflict: '冲突 {n}',
  boardPreviewOverlap: '同文件 {n}',
  boardPreviewBaseAhead: '基线前进 {n}',
  boardPreviewSafe: '安全',
  boardPreviewIdle: '等待',
  boardPreviewBlocked: '阻塞',
}

const task = (over: any = {}) => ({
  id: 't1',
  projectId: 'p1',
  title: 'Fix login',
  description: '',
  repoPath: '/repo',
  baseBranch: 'main',
  branch: 'dsh-wt/fix-login',
  worktreePath: '/repo/.dsh-worktrees/t1',
  sessionId: '',
  firstPrompt: '',
  createdAt: 1,
  updatedAt: 2,
  ...over,
})

const view = (over: any = {}) => ({
  task: task(over.task),
  snapshot: {
    status: 'review',
    branchExists: true,
    merged: false,
    postMergeAhead: 0,
    reviewBehind: 0,
    worktree: { branch: 'fix-login', dirtyCount: 0, ahead: 2, commits: [{ hash: 'abcdef123456' }], lastCommitAt: 10 },
    repo: { currentBranch: 'main', headSha: '9999999', dirtyCount: 0, inProgress: false },
    ...over.snapshot,
  },
})

test('boardStatus promotes a running review to the running state', () => {
  assert.equal(boardStatus('review', true).key, 'running')
  assert.equal(boardStatus('review', false).key, 'review')
  assert.equal(boardStatus('developing', true).key, 'running')
  assert.equal(boardStatus('merged', false).chip, 'ok')
})

test('boardCta mirrors the board primary/secondary actions', () => {
  const review: BoardStatus = boardStatus('review', false)
  assert.equal(boardCta(review, false).primary.action, 'checkout')
  assert.equal(boardCta(review, false).secondary?.action, 'merge')
  assert.equal(boardCta(boardStatus('reviewing', false), true).primary.action, 'back')
  assert.equal(boardCta(boardStatus('developing', false), false).primary.action, 'create')
  assert.equal(boardCta(boardStatus('developing', false), true).primary.action, 'open')
  assert.equal(boardCta(boardStatus('merged', false), true).secondary?.action, 'continue')
  assert.equal(boardCta(boardStatus('cleaned', false), true).primary.action, 'none')
  assert.equal(boardCta(boardStatus('broken', false), true).primary.action, 'retry')
})

test('criteria are read-only and derive checked state from the lifecycle', () => {
  const t = task({ acceptanceCriteria: ['a', 'b'] })
  assert.deepEqual(criteria(t, 'merged'), [{ text: 'a', checked: true }, { text: 'b', checked: true }])
  assert.deepEqual(criteria(t, 'cleaned'), [{ text: 'a', checked: true }, { text: 'b', checked: true }])
  assert.deepEqual(criteria(t, 'review'), [{ text: 'a', checked: false }, { text: 'b', checked: false }])
})

test('criteria merge recorded checks with the current standards', () => {
  const t = task({ acceptanceCriteria: ['a', 'b', 'c'], checkedCriteria: ['b', 'gone'] })
  // Review shows only the criteria the user actually verified; a recorded text
  // that no longer exists in the standard list never renders.
  assert.deepEqual(criteria(t, 'review'), [
    { text: 'a', checked: false },
    { text: 'b', checked: true },
    { text: 'c', checked: false },
  ])
  // Merged / cleaned keep the historical "all done" semantics.
  assert.deepEqual(criteria(t, 'merged'), [
    { text: 'a', checked: true },
    { text: 'b', checked: true },
    { text: 'c', checked: true },
  ])
  assert.deepEqual(criteria(t, 'cleaned'), [
    { text: 'a', checked: true },
    { text: 'b', checked: true },
    { text: 'c', checked: true },
  ])
})

test('criteriaProgress counts checked, total and missing', () => {
  assert.deepEqual(criteriaProgress([]), { checked: 0, total: 0, missing: 0 })
  assert.deepEqual(criteriaProgress([{ checked: true }, { checked: false }, { checked: true }]), { checked: 2, total: 3, missing: 1 })
})

test('rail formatting strips the worktree prefix and summarises the snapshot', () => {
  assert.equal(boardBranch('dsh-wt/fix-login'), 'fix-login')
  assert.equal(boardBranch('feat/x'), 'feat/x')
  assert.equal(boardStat(view().snapshot), '↑2')
  assert.equal(boardStat(view({ snapshot: { worktree: { ahead: 0, dirtyCount: 3 } } }).snapshot), '3•')
  assert.equal(boardStat(view({ snapshot: { worktree: { ahead: 0, dirtyCount: 0 } } }).snapshot), '')
  assert.equal(shortSha('abcdef123456'), 'abcdef1')
  assert.equal(shortSha(''), '—')
})

test('matchesSearch covers title, branch, project and pending text', () => {
  assert.equal(matchesSearch('', ['x']), true)
  assert.equal(matchesSearch('login', ['Fix login']), true)
  assert.equal(matchesSearch('LOGIN', ['fix-login']), true)
  assert.equal(matchesSearch('nope', ['Fix login', null, undefined]), false)
})

test('filterProjectViews intersects attention category with search text', () => {
  const text = (task: any) => String(task.pendingLabel || '')
  const one = { project: { id: 'p1', name: 'Repo', repoPath: '/repo' }, tasks: [view()], stats: {} } as any
  const two = { project: { id: 'p2', name: 'Other', repoPath: '/other' }, tasks: [view({ task: { id: 't2', title: 'Ship it' }, snapshot: { status: 'merged' } })], stats: {} } as any
  // Only t1 carries the review category; t2 stays out of it.
  const categoriesOf = (tv: any) => ({ categories: new Set(tv.task.id === 't1' ? ['review'] : []) } as any)

  // category only: p2's task carries no category, so its group disappears
  const reviewed = filterProjectViews([one, two], 'review', '', categoriesOf, text)
  assert.deepEqual(reviewed.map((v: any) => v.project.id), ['p1'])

  // a project-name hit widens the search but never bypasses the category
  const byProjectName = filterProjectViews([one, two], 'review', 'other', categoriesOf, text)
  assert.deepEqual(byProjectName.map((v: any) => v.project.id), [])

  // search matches the project name, so all of its tasks survive
  const byProject = filterProjectViews([one, two], 'all', 'repo', categoriesOf, text)
  assert.deepEqual(byProject.map((v: any) => v.project.id), ['p1'])

  // search matches a pending label carried by the task
  const withPending = { project: { id: 'p3', name: 'Zed', repoPath: '/zed' }, tasks: [view({ task: { id: 't3', title: 'Alpha', branch: 'a' } })], stats: {} } as any
  const byPending = filterProjectViews([withPending], 'pending', '待审批', () => ({ categories: new Set(['pending']) } as any), (task) => (task.id === 't3' ? '待审批' : ''))
  assert.equal(byPending.length, 1)
  assert.equal(filterProjectViews([withPending], 'pending', 'nope', () => ({ categories: new Set(['pending']) } as any), () => '待审批').length, 0)
})

test('filterProjectViews keeps empty projects only when nothing is filtered', () => {
  const empty = { project: { id: 'p1', name: 'Repo', repoPath: '/repo' }, tasks: [], stats: {} } as any
  const filled = { project: { id: 'p2', name: 'Other', repoPath: '/other' }, tasks: [view()], stats: {} } as any
  const get = () => ({ categories: new Set(['review']) } as any)
  assert.equal(filterProjectViews([empty, filled], 'all', '', get, () => '').length, 2)
  assert.equal(filterProjectViews([empty, filled], 'review', '', get, () => '').length, 1)
  assert.equal(filterProjectViews([empty, filled], 'all', 'login', get, () => '').length, 1)
})

test('diff helpers prefer the recorded review/merge tips', () => {
  assert.equal(diffHeadSha(task({ reviewSha: 'aaaaaaa' }), view().snapshot), 'aaaaaaa')
  assert.equal(diffHeadSha(task(), view().snapshot), 'abcdef123456')
  assert.equal(diffBaseSha(task(), view().snapshot, 'base123'), '9999999')
  assert.equal(diffBaseSha(task(), view({ snapshot: { repo: { currentBranch: 'feature' } } }).snapshot, 'base123'), 'base123')
  assert.equal(diffCount({ files: [{}, {}] } as any), 2)
  assert.equal(diffCount(null), 0)
})

test('diffLineKind classifies patch lines', () => {
  assert.equal(diffLineKind('@@ -1 +1 @@'), 'hunk')
  assert.equal(diffLineKind('+added'), 'add')
  assert.equal(diffLineKind('-removed'), 'del')
  assert.equal(diffLineKind('+++ b/file'), 'context')
  assert.equal(diffLineKind('--- a/file'), 'context')
  assert.equal(diffLineKind('\\ No newline'), 'muted')
})

test('railEmptyKind only reports an empty state for an actually empty result', () => {
  const one = [{ project: { id: 'p1', name: 'repo' }, tasks: [{ task: { id: 't1' } }] }] as any
  const empty = [] as any
  // Filtered rows still exist: no empty state may replace them.
  assert.equal(railEmptyKind(one, one, '', 'all'), '')
  assert.equal(railEmptyKind(one, one, 'repo', 'all'), '')
  assert.equal(railEmptyKind(one, one, '', 'review'), '')
  // Query wins over filter when nothing matched.
  assert.equal(railEmptyKind(one, empty, ' nope ', 'review'), 'search')
  assert.equal(railEmptyKind(one, empty, '', 'review'), 'filter')
  // An all-filter with no rows would mean no projects at all.
  assert.equal(railEmptyKind(one, empty, '', 'all'), '')
  assert.equal(railEmptyKind(empty, empty, 'x', 'all'), 'no-projects')
})

test('switchConfirmText warns about detached HEAD before review checkout', () => {
  const t = { boardCheckoutDetached: 'detached HEAD', boardSwitchDirty: 'stash {n}' }
  assert.equal(switchConfirmText(t, 'checkout', 0), 'detached HEAD')
  assert.equal(switchConfirmText(t, 'checkout', 2), 'detached HEAD stash 2')
  assert.equal(switchConfirmText(t, 'back', 1), 'stash 1')
  assert.equal(switchConfirmText(t, 'back', 0), '')
})

test('taskMergeSummary keeps a cleaned, unmerged branch honest', () => {
  const t = { ...T, boardPreviewMerged: 'merged', boardPreviewCleaned: 'cleaned', boardPreviewCleanedMerged: 'cleaned+merged' }
  const unmerged = taskMergeSummary({ status: 'cleaned', merged: false }, { cleanedAt: 1 }, null, 'idle')
  assert.equal(unmerged.key, 'cleaned')
  assert.equal(mergeSummaryText(t, unmerged), 'cleaned')
  // A deleted branch hides the evidence: the stored merge time still counts.
  const merged = taskMergeSummary({ status: 'cleaned', merged: false }, { mergedAt: 1 }, null, 'idle')
  assert.equal(merged.key, 'cleanedMerged')
  assert.equal(mergeSummaryText(t, merged), 'cleaned+merged')
  // A live merge preview still wins over the stored state.
  assert.equal(taskMergeSummary({ status: 'review' }, {}, { conflict: true, conflictFiles: ['a'] }, 'ready').key, 'conflict')
  assert.equal(taskMergeSummary({ status: 'merged', merged: true }, {}, null, 'idle').key, 'merged')
})

test('mergeSummary maps preview signals to a tone and text', () => {
  assert.equal(mergeSummary(null, 'checking').key, 'checking')
  assert.equal(mergeSummary({ conflict: true, conflictFiles: ['a'] }, 'ready').key, 'conflict')
  assert.equal(mergeSummary({ conflict: false, overlapFiles: ['a', 'b'] }, 'ready').key, 'overlap')
  assert.equal(mergeSummary({ conflict: false, baseAhead: 2 }, 'ready').key, 'baseAhead')
  assert.equal(mergeSummary({ conflict: false }, 'ready').key, 'safe')
  assert.equal(mergeSummary({ applicable: false }, 'ready').key, 'blocked')
  assert.equal(mergeSummaryText(T, mergeSummary({ conflict: true, conflictFiles: ['a'] }, 'ready')), '冲突 1')
})

test('themeFor prefers a stored override, otherwise host or OS preference', () => {
  assert.equal(themeFor('light', true, true), 'light')
  assert.equal(themeFor('dark', false, false), 'dark')
  assert.equal(themeFor(null, true, false), 'dark')
  assert.equal(themeFor('', false, true), 'dark')
  assert.equal(themeFor(null, false, false), 'light')
})

test('pathPreview uses the project worktree directory', () => {
  assert.equal(pathPreview({ name: 'repo', dirName: '.wt' }), 'repo → .wt/<auto-id>')
  assert.equal(pathPreview(null), 'worktree → .dsh-worktrees/…')
})

test('snapshot-less task rows still resolve their CTA', () => {
  const bare = { task: task(), snapshot: null } as any
  assert.equal(boardStatus('ready', false).key, 'ready')
  assert.equal(boardCta(boardStatus('ready', false), false).primary.action, 'create')
  assert.equal(matchesSearch('', [bare.task.title]), true)
})
