import test from 'node:test'
import assert from 'node:assert/strict'
import {
  criteria,
  demoBranch,
  demoCta,
  demoStat,
  demoStatus,
  diffBaseSha,
  diffCount,
  diffHeadSha,
  diffLineKind,
  filterViews,
  mergeSummary,
  mergeSummaryText,
  pathPreview,
  shortSha,
  taskMatches,
  themeFor,
  type DemoStatus,
} from '../src/client/model.js'

const T = {
  demoReady: '待开始',
  developing: '进行中',
  demoAgentRunning: 'Agent 正在运行',
  review: '待验收',
  reviewing: '验收中',
  merged: '已合并',
  cleaned: '已清理',
  broken: '异常',
  demoDirectMerge: '直接合并',
  demoCheckoutReview: '切到主仓库验收',
  demoViewLogs: '查看日志',
  demoBack: '返回原分支',
  demoOpenSession: '打开原生会话',
  demoCreateSession: '创建并启动会话',
  demoStartAgent: '启动 Agent 会话',
  demoFollowUp: '派生后续任务',
  demoCleanup: '清理 Worktree',
  demoPreviewChecking: '检查中',
  demoPreviewConflict: '冲突 {n}',
  demoPreviewOverlap: '同文件 {n}',
  demoPreviewBaseAhead: '基线前进 {n}',
  demoPreviewSafe: '安全',
  demoPreviewIdle: '等待',
  demoPreviewBlocked: '阻塞',
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

test('demoStatus promotes a running review to the running state', () => {
  assert.equal(demoStatus('review', true).key, 'running')
  assert.equal(demoStatus('review', false).key, 'review')
  assert.equal(demoStatus('developing', true).key, 'running')
  assert.equal(demoStatus('merged', false).chip, 'ok')
})

test('demoCta mirrors the demo primary/secondary actions', () => {
  const review: DemoStatus = demoStatus('review', false)
  assert.equal(demoCta(review, false).primary.action, 'checkout')
  assert.equal(demoCta(review, false).secondary?.action, 'merge')
  assert.equal(demoCta(demoStatus('reviewing', false), true).primary.action, 'back')
  assert.equal(demoCta(demoStatus('developing', false), false).primary.action, 'create')
  assert.equal(demoCta(demoStatus('developing', false), true).primary.action, 'open')
  assert.equal(demoCta(demoStatus('merged', false), true).secondary?.action, 'continue')
  assert.equal(demoCta(demoStatus('cleaned', false), true).primary.action, 'none')
  assert.equal(demoCta(demoStatus('broken', false), true).primary.action, 'retry')
})

test('criteria are read-only and derive checked state from the lifecycle', () => {
  const t = task({ acceptanceCriteria: ['a', 'b'] })
  assert.deepEqual(criteria(t, 'merged'), [{ text: 'a', checked: true }, { text: 'b', checked: true }])
  assert.deepEqual(criteria(t, 'cleaned'), [{ text: 'a', checked: true }, { text: 'b', checked: true }])
  assert.deepEqual(criteria(t, 'review'), [{ text: 'a', checked: false }, { text: 'b', checked: false }])
})

test('rail formatting strips the worktree prefix and summarises the snapshot', () => {
  assert.equal(demoBranch('dsh-wt/fix-login'), 'fix-login')
  assert.equal(demoBranch('feat/x'), 'feat/x')
  assert.equal(demoStat(view().snapshot), '↑2')
  assert.equal(demoStat(view({ snapshot: { worktree: { ahead: 0, dirtyCount: 3 } } }).snapshot), '3•')
  assert.equal(demoStat(view({ snapshot: { worktree: { ahead: 0, dirtyCount: 0 } } }).snapshot), '')
  assert.equal(shortSha('abcdef123456'), 'abcdef1')
  assert.equal(shortSha(''), '—')
})

test('taskMatches filters by status, title and branch', () => {
  const review = view()
  assert.equal(taskMatches(review, 'all', '', false), true)
  assert.equal(taskMatches(review, 'review', '', false), true)
  assert.equal(taskMatches(review, 'developing', '', false), false)
  assert.equal(taskMatches(review, 'review', 'login', false), true)
  assert.equal(taskMatches(review, 'review', 'fix-login', false), true)
  assert.equal(taskMatches(review, 'review', 'nope', false), false)
  assert.equal(taskMatches(view({ snapshot: { status: 'developing' } }), 'developing', '', true), true)
})

test('filterViews removes project groups that lost every task', () => {
  const one = { project: { id: 'p1' }, tasks: [view()], stats: {} } as any
  const two = { project: { id: 'p2' }, tasks: [view({ task: { id: 't2', title: 'Other' }, snapshot: { status: 'merged' } })], stats: {} } as any
  const out = filterViews([one, two], 'review', '', () => false)
  assert.equal(out.length, 1)
  assert.equal(out[0].project.id, 'p1')
})

test('filterViews keeps empty projects only when nothing is filtered', () => {
  const empty = { project: { id: 'p1' }, tasks: [], stats: {} } as any
  const filled = { project: { id: 'p2' }, tasks: [view()], stats: {} } as any
  const all = filterViews([empty, filled], 'all', '', () => false)
  assert.equal(all.length, 2)
  assert.equal(filterViews([empty, filled], 'review', '', () => false).length, 1)
  assert.equal(filterViews([empty, filled], 'all', 'login', () => false).length, 1)
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
  assert.equal(demoStatus('ready', false).key, 'ready')
  assert.equal(taskMatches(bare, 'all', '', false), true)
})
