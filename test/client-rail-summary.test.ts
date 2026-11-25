import test from 'node:test'
import assert from 'node:assert/strict'
import { SIGNAL_RANK, alertText, alertTone, railRowSignals, railSignals, signalIcon, type RailSignalsInput } from '../src/client/rail-summary.js'

const T: any = {
  boardReady: '待开始',
  developing: '进行中',
  reviewing: '验收中',
  review: '待验收',
  merged: '已合并',
  cleaned: '已清理',
  broken: '异常',
  pendingApproval: '待批准',
  pendingPlanReview: '待审计划',
  pendingQuestion: '待回答',
  attentionRecovery: '需要恢复',
  attentionBroken: '异常任务',
  attentionStalledDays: '停滞 {n} 天',
  sessionRunning: '会话运行中',
  sessionIdle: '空闲',
  sessionInterrupted: '会话中断',
  sessionError: '会话异常',
  taskDueOverdue: '逾期 {n} 天',
  taskDueToday: '今天到期',
  taskDueSoon: '{n} 天后到期',
  taskDueHint: '按本地日历日计算；逾期任务会进入「逾期」筛选。',
  taskDepsBlocked: '等待 {n} 项前置',
  acceptanceCriteria: '验收标准',
  'boardCriteriaProgress': '已核对 {n}/{total}',
  taskWorkTiming: '计时中',
  taskWorkTimingHint: '从 {time} 开始计时',
  taskEstimate: '规模估算',
  taskEstimatePoints: '{n} 点',
  priorityHigh: '高',
  priorityLow: '低',
  postMergeBadge: '基线已前移 {n} 个提交',
}

function input(over: Partial<RailSignalsInput> = {}): RailSignalsInput {
  return {
    t: T,
    statusLabel: '待验收',
    statusTone: 'warn',
    pendingKind: '',
    health: null,
    running: false,
    attention: {},
    deps: null,
    due: null,
    criteria: { checked: 0, total: 0 },
    estimate: null,
    tags: [],
    timerClock: '',
    postMergeAhead: 0,
    priority: 'normal',
    ...over,
  }
}

test('a quiet task shows only its status chip and no popover', () => {
  const row = railRowSignals(input())
  assert.equal(row.status.label, '待验收')
  assert.equal(row.status.kind, 'status')
  assert.equal(row.lead, null)
  assert.deepEqual(row.more, [])
})

test('a pending decision replaces the status chip and keeps its tone', () => {
  const row = railRowSignals(input({ pendingKind: 'approval' }))
  assert.deepEqual(row.status, { kind: 'pending', label: '待批准', tone: 'warn', title: '待批准' })
})

test('the single alarm slot goes to the most urgent signal', () => {
  // broken (12) wins over overdue (22), dependencies (40) and a high priority (60).
  const row = railRowSignals(input({
    attention: { primaryAlert: 'broken', extraAlerts: ['stalled'], stalledDays: 4 },
    due: { kind: 'overdue', days: 2 },
    deps: { blocked: true, open: [{ title: '接上 API' }, { title: '补测试' }] },
    priority: 'high',
  }))
  assert.equal(row.lead?.kind, 'broken')
  assert.deepEqual(row.more.map((signal) => signal.kind), ['overdue', 'deps', 'stalled', 'priority-high'])
})

test('severity order is stable and independent of candidate order', () => {
  const row = railRowSignals(input({
    priority: 'high',
    timerClock: '09:30',
    deps: { blocked: true, open: [{ title: 'a' }] },
    due: { kind: 'soon', days: 2 },
    postMergeAhead: 3,
  }))
  // Blocks (40) outrank the deadline (44), a stall (46), the timer and priority.
  assert.deepEqual(row.more.map((signal) => signal.kind), ['deps', 'due-soon', 'timer', 'priority-high'])
  const ranks = row.more.map((signal) => SIGNAL_RANK[signal.kind])
  assert.deepEqual([...ranks].sort((a, b) => a - b), ranks)
})

test('a running turn hides the historical session health', () => {
  const stale = input({ health: { kind: 'error', message: 'boom' }, attention: { primaryAlert: 'session' } })
  assert.equal(railRowSignals(stale).lead?.kind, 'session')
  assert.equal(railRowSignals({ ...stale, running: true }).lead, null)
})

test('post-merge drift is derived from the snapshot, not duplicated by an alert', () => {
  const row = railRowSignals(input({ attention: { primaryAlert: 'post-merge' }, postMergeAhead: 2 }))
  assert.deepEqual(row.more, [])
  assert.equal(row.lead?.kind, 'post-merge')
  assert.match(row.lead?.label || '', /2/)
})

test('acceptance progress only stands in as an alarm while awaiting review', () => {
  const review = railRowSignals(input({ pendingKind: 'review', criteria: { checked: 2, total: 3 } }))
  assert.equal(review.status.kind, 'pending')
  assert.equal(review.lead?.kind, 'criteria')
  assert.equal(review.lead?.label, '已核对 2/3')
  // Complete, unset, or not waiting for review: nothing to nag about.
  assert.equal(railRowSignals(input({ pendingKind: 'review', criteria: { checked: 3, total: 3 } })).lead, null)
  assert.equal(railRowSignals(input({ pendingKind: 'review' })).lead, null)
  assert.equal(railRowSignals(input({ criteria: { checked: 1, total: 3 } })).lead, null)
})

test('static metadata stays out of the row but survives in the candidate list', () => {
  const row = railRowSignals(input({ tags: ['api', 'ui', 'docs'], estimate: 5, priority: 'low' }))
  assert.equal(row.lead, null)
  assert.deepEqual(row.more, [])
  const candidates = railSignals(input({ tags: ['api', 'ui', 'docs'], estimate: 5, priority: 'low' }))
  const tags = candidates.find((signal) => signal.kind === 'tags')
  assert.equal(tags?.label, '#api #ui')
  assert.equal(tags?.title, 'api, ui, docs')
  assert.equal(candidates.find((signal) => signal.kind === 'estimate')?.label, '5 点')
  assert.equal(candidates.find((signal) => signal.kind === 'priority-low')?.label, '低')
})

test('a low priority with an alarm keeps the alarm and drops the quiet chip', () => {
  const row = railRowSignals(input({ priority: 'low', due: { kind: 'today', days: 0 } }))
  assert.equal(row.lead?.kind, 'due-today')
  assert.deepEqual(row.more, [])
})

test('dependencies keep every blocking title in the hover text', () => {
  const row = railRowSignals(input({ deps: { blocked: true, open: [{ title: '接上 API' }, { title: '补测试' }] } }))
  assert.equal(row.lead?.label, '等待 2 项前置')
  assert.equal(row.lead?.title, '接上 API, 补测试')
})

test('empty values never produce an empty chip', () => {
  const row = railRowSignals(input({ tags: ['', '  '], estimate: null, deps: { blocked: true, open: [] } }))
  assert.equal(row.lead, null)
  assert.deepEqual(row.more, [])
  assert.equal(alertText(T, 'stalled', '', null, undefined), '停滞 0 天')
})

test('tones and icons do not rely on colour alone', () => {
  assert.equal(alertTone('broken'), 'err')
  assert.equal(alertTone('session'), 'err')
  assert.equal(alertTone('deps'), 'warn')
  assert.equal(signalIcon('criteria'), 'checkCircle')
  assert.equal(signalIcon('timer'), 'clock')
  assert.equal(signalIcon('priority-high'), 'arrowUp')
  assert.equal(signalIcon('broken'), 'alert')
  assert.equal(signalIcon('tags'), 'circle')
})
