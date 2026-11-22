import test from 'node:test'
import assert from 'node:assert/strict'
import {
  acceptanceHintFor,
  boardEmptyKind,
  branchHeadSha,
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
  shortSha,
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
  acceptanceHintClean: 'worktree 已清理',
  acceptanceHintMerged: '已合并进基线',
  acceptanceHintDeveloping: '任务进行中',
  acceptanceHintPostMerge: '还有 {n} 个新提交',
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

test('boardEmptyKind only reports no-match when the filtered list is empty', () => {
  const base = { loaded: true, projectCount: 1, query: '', filter: 'all' as const, taskCount: 0 }
  assert.equal(boardEmptyKind({ ...base, query: 'login', taskCount: 1 }), '')
  assert.equal(boardEmptyKind({ ...base, query: 'login' }), 'search')
  assert.equal(boardEmptyKind({ ...base, query: '  ', taskCount: 0 }), '')
  assert.equal(boardEmptyKind({ ...base, filter: 'review', taskCount: 1 }), '')
  assert.equal(boardEmptyKind({ ...base, filter: 'review' }), 'filter')
  assert.equal(boardEmptyKind({ ...base, loaded: false }), '')
  assert.equal(boardEmptyKind({ ...base, projectCount: 0 }), 'no-projects')
})

test('branchHeadSha pins a detached review and follows the live tip otherwise', () => {
  const reviewing = view({ task: { reviewSha: 'review123456' }, snapshot: { status: 'reviewing' } })
  assert.equal(branchHeadSha(reviewing.task, reviewing.snapshot), 'review123456')
  // A merged task with a stale reviewSha still shows its newest branch commit.
  const merged = view({
    task: { reviewSha: 'stale123456' },
    snapshot: { status: 'merged', worktree: { ahead: 1, commits: [{ hash: 'newtip123456' }] } },
  })
  assert.equal(branchHeadSha(merged.task, merged.snapshot), 'newtip123456')
  const empty = view({ task: { mergedBranchTip: 'merged123456' }, snapshot: { status: 'merged', worktree: { ahead: 0, commits: [] } } })
  assert.equal(branchHeadSha(empty.task, empty.snapshot), diffHeadSha(empty.task, empty.snapshot))
  assert.equal(branchHeadSha(task(), null), '')
})

test('acceptanceHintFor explains the gate for every lifecycle state', () => {
  assert.equal(acceptanceHintFor(T, 'developing', 0), T.acceptanceHintDeveloping)
  assert.equal(acceptanceHintFor(T, 'ready', 0), T.acceptanceHintDeveloping)
  assert.equal(acceptanceHintFor(T, 'merged', 0), T.acceptanceHintMerged)
  assert.equal(acceptanceHintFor(T, 'merged', 2), '还有 2 个新提交')
  assert.equal(acceptanceHintFor(T, 'cleaned', 0), T.acceptanceHintClean)
  assert.equal(acceptanceHintFor(T, 'review', 0), '')
  assert.equal(acceptanceHintFor(T, 'reviewing', 0), '')
})

test('mergeSummaryText reports a cleaned worktree', () => {
  assert.equal(mergeSummaryText(T, { key: 'cleaned', tone: 'neutral' }), T.acceptanceHintClean)
})
