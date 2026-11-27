import test from 'node:test'
import assert from 'node:assert/strict'
import { FOCUS_LIMIT, FOCUS_SCORE_MAX, buildFocusQueue } from '../src/client/focus-queue.js'
import { buildProjectRisk } from '../src/client/project-risk.js'
import type { ProjectView, TaskSnapshot, TaskStatus, TaskView, WorktreeTask } from '../src/models.js'

const DAY = 86400000
/** Fixed local wall-clock base: no DST transition in June for either hemisphere. */
const NOW = new Date(2026, 5, 15, 15, 30, 0, 0).getTime()

/** Local midnight `offset` days from NOW. */
function due(offset: number): number {
  const base = new Date(NOW)
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset).getTime()
}

function task(over: Partial<WorktreeTask> = {}): WorktreeTask {
  return {
    id: 't1',
    projectId: 'p1',
    title: 'Task',
    description: '',
    repoPath: 'C:/repo',
    baseBranch: 'main',
    branch: 'dsh/t1',
    worktreePath: 'C:/wt',
    createdAt: NOW - DAY,
    updatedAt: NOW - DAY,
    ...over,
  }
}

function snapshot(over: Partial<TaskSnapshot> = {}): TaskSnapshot {
  return {
    worktree: { exists: true, branch: 'dsh/t1', dirtyCount: 0, ahead: 0, commits: [], lastCommitAt: null },
    repo: { exists: true, currentBranch: 'main', dirtyCount: 0 },
    branchExists: true,
    merged: false,
    status: 'ready',
    ...over,
  }
}

function view(over: Partial<WorktreeTask> = {}, status: TaskStatus = 'ready'): TaskView {
  return { task: task(over), snapshot: snapshot({ status }) }
}

function project(id: string, name: string, tasks: TaskView[]): ProjectView {
  return {
    project: { id, name } as any,
    stats: { tasks: tasks.length, byStatus: {}, running: 0 },
    tasks,
  }
}

/** Reasons only, so assertions stay readable. */
function codes(item: any): string[] {
  return item.reasons.map((reason: any) => reason.code)
}

function ids(queue: any): string[] {
  return queue.items.map((item: any) => item.taskId)
}

const PENDING = () => ({ categories: new Set(['pending']) })

test('empty input: no items, zero counts, malformed list tolerated', () => {
  const empty = buildFocusQueue({ views: [], now: NOW })
  assert.deepEqual(empty.items, [])
  assert.equal(empty.ready, 0)
  assert.equal(empty.waiting, 0)
  assert.equal(empty.total, 0)

  const broken = buildFocusQueue({ views: null as any, now: NOW })
  assert.deepEqual(broken, { items: [], ready: 0, waiting: 0, total: 0 })
})

test('closed tasks never enter the queue', () => {
  const queue = buildFocusQueue({
    now: NOW,
    views: [
      project('p1', 'Alpha', [
        view({ id: 'arch', archivedAt: NOW - DAY }),
        view({ id: 'merged', mergedAt: NOW - DAY }, 'merged'),
        view({ id: 'cleaned', cleanedAt: NOW - DAY }, 'cleaned'),
        view({ id: 'live' }),
      ]),
    ],
  })
  assert.equal(queue.total, 1)
  assert.equal(queue.ready, 1)
  assert.deepEqual(ids(queue), ['live'])
})

test('a calm task scores zero and carries no reason chip', () => {
  const queue = buildFocusQueue({ now: NOW, views: [project('p1', 'Alpha', [view({ id: 't1', title: 'Calm' })])] })
  const item = queue.items[0]
  assert.equal(item.taskId, 't1')
  assert.equal(item.projectId, 'p1')
  assert.equal(item.projectName, 'Alpha')
  assert.equal(item.title, 'Calm')
  assert.equal(item.score, 0)
  assert.deepEqual(item.reasons, [])
})

test('base score is exactly the risk radar score for the same project', () => {
  const views = [project('p1', 'Alpha', [
    view({ id: 'overdue', dueAt: due(-9), updatedAt: NOW - DAY }),
    view({ id: 'broken' }, 'broken'),
    view({ id: 'calm' }),
  ])]
  const risk = buildProjectRisk(views[0].tasks, NOW)
  const queue = buildFocusQueue({ views, now: NOW })
  for (const item of queue.items) {
    const expected = risk.items.find((row) => row.taskId === item.taskId)
    assert.equal(item.score, expected ? expected.score : 0, item.taskId)
  }
  // broken has a risk score but no action weight of its own.
  const broken = queue.items.find((item) => item.taskId === 'broken')!
  assert.equal(broken.score, 4)
  assert.deepEqual(broken.reasons, [{ code: 'risk', n: 4 }])
})

test('waiting on an open prerequisite: counted, not ranked', () => {
  const queue = buildFocusQueue({
    now: NOW,
    views: [project('p1', 'Alpha', [
      view({ id: 'blocker' }, 'developing'),
      view({ id: 'blocked', dependsOn: ['blocker'] }),
    ])],
  })
  assert.equal(queue.total, 2)
  assert.equal(queue.ready, 1)
  assert.equal(queue.waiting, 1)
  assert.deepEqual(ids(queue), ['blocker'])
})

test('a finished or missing prerequisite does not hold a task back', () => {
  const queue = buildFocusQueue({
    now: NOW,
    views: [project('p1', 'Alpha', [
      view({ id: 'done', mergedAt: NOW - DAY }, 'merged'),
      view({ id: 'after-merge', dependsOn: ['done'] }),
      view({ id: 'after-ghost', dependsOn: ['never-existed'] }),
    ])],
  })
  assert.equal(queue.total, 2)
  assert.equal(queue.ready, 1)
  assert.equal(queue.waiting, 1)
  assert.deepEqual(ids(queue), ['after-merge'])
})

test('prerequisites resolve across projects, closed rows included', () => {
  const queue = buildFocusQueue({
    now: NOW,
    views: [
      project('p1', 'Alpha', [view({ id: 'a' }, 'review')]),
      project('p2', 'Beta', [
        view({ id: 'b', dependsOn: ['a'] }),
        view({ id: 'c', dependsOn: ['old'] }),
      ]),
      project('p3', 'Gamma', [view({ id: 'old', mergedAt: NOW - DAY }, 'merged')]),
    ],
  })
  assert.equal(queue.total, 3)
  assert.equal(queue.ready, 2)
  assert.equal(queue.waiting, 1)
  assert.deepEqual(ids(queue).sort(), ['a', 'c'])
})

test('action weights: pending, review, high, pinned, unblocks', () => {
  const views = [project('p1', 'Alpha', [
    view({ id: 'base' }, 'developing'),
    view({ id: 'pend' }, 'developing'),
    view({ id: 'rev' }, 'review'),
    view({ id: 'high', priority: 'high' }, 'developing'),
    view({ id: 'pin', pinnedAt: NOW - DAY }, 'developing'),
    view({ id: 'lever' }, 'developing'),
    view({ id: 'd1', dependsOn: ['lever'] }),
    view({ id: 'd2', dependsOn: ['lever'] }),
    view({ id: 'd3', dependsOn: ['lever'] }),
    view({ id: 'other-open' }, 'developing'),
    view({ id: 'not-lever', dependsOn: ['lever', 'other-open'] }),
  ])]
  const queue = buildFocusQueue({
    views,
    now: NOW,
    attentionOf: (tv) => (tv.task.id === 'pend' ? (PENDING() as any) : null),
  })
  const score = (id: string) => queue.items.find((item) => item.taskId === id)!
  assert.equal(score('base').score, 0)
  assert.equal(score('pend').score, 3)
  assert.deepEqual(score('pend').reasons, [{ code: 'pending' }])
  assert.equal(score('rev').score, 2)
  assert.deepEqual(score('rev').reasons, [{ code: 'review' }])
  assert.equal(score('high').score, 2)
  assert.deepEqual(score('high').reasons, [{ code: 'high-priority' }])
  assert.equal(score('pin').score, 1)
  assert.deepEqual(score('pin').reasons, [])
  // Three dependents, but the weight is capped at +2.
  assert.equal(score('lever').score, 2)
  assert.deepEqual(score('lever').reasons, [{ code: 'unblocks', n: 3 }])
})

test('unblocks only counts dependents whose other prerequisites are done', () => {
  const queue = buildFocusQueue({
    now: NOW,
    views: [project('p1', 'Alpha', [
      view({ id: 'a' }, 'developing'),
      view({ id: 'x' }, 'developing'),
      view({ id: 'b', dependsOn: ['a', 'x'] }),
      view({ id: 'c', dependsOn: ['a'] }),
    ])],
  })
  const a = queue.items.find((item) => item.taskId === 'a')!
  assert.equal(a.score, 1)
  assert.deepEqual(a.reasons, [{ code: 'unblocks', n: 1 }])
  const x = queue.items.find((item) => item.taskId === 'x')!
  assert.equal(x.score, 0)
  assert.deepEqual(x.reasons, [])
})

test('total score caps at FOCUS_SCORE_MAX', () => {
  const queue = buildFocusQueue({
    now: NOW,
    attentionOf: () => PENDING() as any,
    views: [project('p1', 'Alpha', [
      view({ id: 'monster', dueAt: due(-1), priority: 'high', pinnedAt: NOW - DAY }, 'review'),
      view({ id: 'd1', dependsOn: ['monster'] }),
      view({ id: 'd2', dependsOn: ['monster'] }),
    ])],
  })
  const monster = queue.items.find((item) => item.taskId === 'monster')!
  // 3 overdue + 3 pending + 2 review + 2 high + 1 pinned + 2 unblocks = 13.
  assert.equal(FOCUS_SCORE_MAX, 12)
  assert.equal(monster.score, 12)
  assert.deepEqual(codes(monster), ['pending', 'overdue', 'review'])
})

test('reason chips follow the documented order and stop at three', () => {
  const queue = buildFocusQueue({
    now: NOW,
    attentionOf: (tv) => (tv.task.id === 'rich' ? (PENDING() as any) : null),
    views: [project('p1', 'Alpha', [
      view({ id: 'rich', dueAt: due(-4), priority: 'high', pinnedAt: NOW - DAY, updatedAt: NOW - 20 * DAY }, 'review'),
      view({ id: 'later-due', dueAt: due(2) }),
      view({ id: 'today-due', dueAt: due(0) }),
      view({ id: 'soon-due', dueAt: due(2) }, 'developing'),
    ])],
  })
  const rich = queue.items.find((item) => item.taskId === 'rich')!
  assert.deepEqual(codes(rich), ['pending', 'overdue', 'review'])
  assert.deepEqual(rich.reasons[1], { code: 'overdue', n: 4 })
  assert.deepEqual(codes(queue.items.find((item) => item.taskId === 'today-due')!), ['due-today'])
  assert.deepEqual(codes(queue.items.find((item) => item.taskId === 'soon-due')!), ['due-soon'])
})

test('stalled and risk reasons appear when nothing more specific does', () => {
  const queue = buildFocusQueue({
    now: NOW,
    views: [project('p1', 'Alpha', [
      view({ id: 'stale', createdAt: NOW - 30 * DAY, updatedAt: NOW - 10 * DAY }, 'developing'),
      view({ id: 'pinned-but-stale', pinnedAt: NOW - DAY, createdAt: NOW - 30 * DAY, updatedAt: NOW - 10 * DAY }, 'developing'),
    ])],
  })
  const stale = queue.items.find((item) => item.taskId === 'stale')!
  assert.deepEqual(stale.reasons, [{ code: 'stalled', n: 10 }])
  // Pinned is an action weight without a chip; the risk base still explains a 3.
  const pinned = queue.items.find((item) => item.taskId === 'pinned-but-stale')!
  assert.equal(pinned.score, 3)
  assert.deepEqual(pinned.reasons, [{ code: 'stalled', n: 10 }])
})

test('sorting: score, then due date, then priority, then creation, then id', () => {
  const sameDue = due(-2)
  const queue = buildFocusQueue({
    now: NOW,
    views: [
      project('p1', 'Alpha', [
        view({ id: 'plain' }),
        view({ id: 'due-later', dueAt: due(-1) }),
        view({ id: 'due-sooner', dueAt: sameDue }),
        view({ id: 'prio-low', dueAt: sameDue, priority: 'low' }),
        view({ id: 'prio-high', dueAt: sameDue, priority: 'high' }),
        view({ id: 'created-old', dueAt: sameDue, createdAt: NOW - 5 * DAY }),
        view({ id: 'zebra', dueAt: sameDue, createdAt: NOW - 5 * DAY }),
        view({ id: 'alpha', dueAt: sameDue, createdAt: NOW - 5 * DAY }),
        view({ id: 'newer', dueAt: sameDue, createdAt: NOW - DAY }),
      ]),
    ],
  })
  // Overdue rows share the score 3 and sort by due date; no due date sorts last.
  assert.deepEqual(ids(queue), [
    'prio-high',
    'alpha',
    'created-old',
    'zebra',
    'due-sooner',
    'newer',
    'prio-low',
    'due-later',
    'plain',
  ])
})

test('items truncate to FOCUS_LIMIT while counts stay complete', () => {
  const tasks: TaskView[] = []
  for (let i = 0; i < 14; i++) tasks.push(view({ id: 't' + i, title: 'T' + i }, 'developing'))
  tasks.push(view({ id: 'waiting', dependsOn: ['t0'] }))
  tasks.push(view({ id: 'waiting-2', dependsOn: ['ghost'] }))
  const queue = buildFocusQueue({ now: NOW, views: [project('p1', 'Alpha', tasks)] })
  assert.equal(FOCUS_LIMIT, 10)
  assert.equal(queue.items.length, 10)
  assert.equal(queue.total, 16)
  assert.equal(queue.ready, 14)
  assert.equal(queue.waiting, 2)
})

test('invalid, negative and future timestamps never produce NaN', () => {
  const queue = buildFocusQueue({
    now: NOW,
    views: [project('p1', 'Alpha', [
      view({ id: 'nan-due', dueAt: NaN }),
      view({ id: 'neg-due', dueAt: -5 }),
      view({ id: 'str-due', dueAt: 'soon' as any }),
      view({ id: 'future-due', dueAt: due(2) }),
      view({ id: 'neg-created', createdAt: -1 }),
      view({ id: 'future-created', createdAt: NOW + 5 * DAY }),
      view({ id: 'bad-pin', pinnedAt: 'yesterday' as any }),
      view({ id: 'zero-created', createdAt: 0 }),
    ])],
  })
  assert.equal(queue.total, 8)
  assert.equal(queue.ready, 8)
  for (const item of queue.items) {
    assert.ok(Number.isFinite(item.score), item.taskId)
    assert.ok(item.score >= 0 && item.score <= FOCUS_SCORE_MAX, item.taskId)
    for (const reason of item.reasons) {
      if (reason.n !== undefined) {
        assert.ok(Number.isFinite(reason.n))
        assert.ok(reason.n >= 0)
      }
    }
  }
  // Future due dates are not "overdue"; negative dues read as absent.
  assert.deepEqual(codes(queue.items.find((item) => item.taskId === 'future-due')!), ['due-soon'])
  const negDue = queue.items.find((item) => item.taskId === 'neg-due')!
  assert.deepEqual(negDue.reasons, [])
  assert.equal(negDue.score, 0)
  // A corrupt pinned stamp is absent, not pinned.
  assert.equal(queue.items.find((item) => item.taskId === 'bad-pin')!.score, 0)
})

test('a missing attention lookup behaves as "nobody is waiting"', () => {
  const views = [project('p1', 'Alpha', [view({ id: 't1' }, 'review')])]
  const withLookup = buildFocusQueue({ views, now: NOW, attentionOf: () => null })
  const withoutLookup = buildFocusQueue({ views, now: NOW })
  assert.equal(withLookup.items[0].score, 2)
  assert.deepEqual(withLookup.items[0], withoutLookup.items[0])
  assert.deepEqual(withoutLookup.items[0].reasons, [{ code: 'review' }])
})
