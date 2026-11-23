import test from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { bootHost } from './helpers/host.js'
import { mkTempDir, rmrf } from './helpers/git.js'
import type { WorktreeTask } from '../src/models.js'

function task(id: string): WorktreeTask {
  return {
    id,
    projectId: 'p',
    title: 't-' + id,
    description: 'd',
    repoPath: 'C:/repo',
    baseBranch: 'main',
    branch: 'b-' + id,
    worktreePath: 'C:/repo/.dsh-worktrees/' + id,
    sessionId: null,
    firstPrompt: '',
    startOnBind: true,
    createdAt: 1,
    updatedAt: 1,
  }
}

// F3: worktree_act delete must await the runtime, so failures come back as
// ok:false instead of an unhandled rejection that can take the host down.
test('worktree_act delete reports missing tasks and pending stashes', async () => {
  const root = await mkTempDir('dshw-act-')
  const host = bootHost({}, { stateDir: join(root, 'state') })
  const tool = host.tools.find((def: any) => def.name === 'worktree_act')
  assert.ok(tool, 'worktree_act is registered')
  const unhandled: unknown[] = []
  const onUnhandled = (reason: unknown) => unhandled.push(reason)
  process.on('unhandledRejection', onUnhandled)
  try {
    const missing: any = await tool.execute({ id: 'nope', action: 'delete' })
    assert.equal(missing.ok, false)
    assert.match(String(missing.error), /任务不存在/)

    const blocked = task('stashed')
    blocked.pendingStashes = [{ sha: 'abc123', source: 'review', ref: 'ref', createdAt: 1, files: [] }]
    host.app.store.putTask(blocked)
    const refused: any = await tool.execute({ id: 'stashed', action: 'delete' })
    assert.equal(refused.ok, false)
    assert.match(String(refused.error), /未处理的暂存/)
    assert.ok(host.app.store.getTask('stashed'), 'the record is kept')

    // Give a missed rejection time to surface before asserting none did.
    await new Promise((resolve) => setTimeout(resolve, 20))
    assert.deepEqual(unhandled, [])
  } finally {
    process.off('unhandledRejection', onUnhandled)
    await rmrf(root)
  }
})

test('worktree_act meta patches only the fields it receives', async () => {
  const root = await mkTempDir('dshw-act-meta-')
  const host = bootHost({}, { stateDir: join(root, 'state') })
  const tool = host.tools.find((def: any) => def.name === 'worktree_act')
  assert.ok(tool, 'worktree_act is registered')
  try {
    host.app.store.putTask(task('meta'))

    const seeded: any = await tool.execute({ id: 'meta', action: 'meta', tags: ['ui', 'api'], priority: 'high', notes: 'first' })
    assert.equal(seeded.ok, true, JSON.stringify(seeded))
    assert.deepEqual(seeded.task.tags, ['ui', 'api'])
    assert.equal(seeded.task.priority, 'high')
    assert.equal(seeded.task.notes, 'first')

    // Omitting tags/priority must not clear them.
    const notesOnly: any = await tool.execute({ id: 'meta', action: 'meta', notes: 'second' })
    assert.equal(notesOnly.ok, true, JSON.stringify(notesOnly))
    assert.deepEqual(notesOnly.task.tags, ['ui', 'api'])
    assert.equal(notesOnly.task.priority, 'high')
    assert.equal(notesOnly.task.notes, 'second')

    const cleared: any = await tool.execute({ id: 'meta', action: 'meta', tags: [], priority: 'normal', notes: '' })
    assert.equal(cleared.ok, true, JSON.stringify(cleared))
    assert.deepEqual(cleared.task.tags, [])
    assert.equal(cleared.task.priority, 'normal')
    assert.equal(cleared.task.notes, '')

    const missing: any = await tool.execute({ id: 'nope', action: 'meta', notes: 'x' })
    assert.equal(missing.ok, false)
    assert.match(String(missing.error), /任务不存在/)

    const invalid: any = await tool.execute({ id: 'meta', action: 'meta', priority: 'urgent' })
    assert.equal(invalid.ok, false)
    assert.match(String(invalid.error), /优先级/)
  } finally {
    await rmrf(root)
  }
})

test('worktree_act meta writes, keeps and clears the estimate', async () => {
  const root = await mkTempDir('dshw-act-estimate-')
  const host = bootHost({}, { stateDir: join(root, 'state') })
  const tool = host.tools.find((def: any) => def.name === 'worktree_act')
  assert.ok(tool, 'worktree_act is registered')
  try {
    host.app.store.putTask(task('est'))
    assert.equal(tool.parameters.properties.estimate.type.includes('number'), true, 'estimate is a meta parameter')

    const set: any = await tool.execute({ id: 'est', action: 'meta', estimate: 5 })
    assert.equal(set.ok, true, JSON.stringify(set))
    assert.equal(set.task.estimate, 5, 'the brief carries the estimate')

    const notesOnly: any = await tool.execute({ id: 'est', action: 'meta', notes: 'kept' })
    assert.equal(notesOnly.ok, true, JSON.stringify(notesOnly))
    assert.equal(notesOnly.task.estimate, 5, 'omitting estimate must not clear it')

    const rejected: any = await tool.execute({ id: 'est', action: 'meta', estimate: 4 })
    assert.equal(rejected.ok, false)
    assert.match(String(rejected.error), /规模估算/)
    assert.equal(host.app.store.getTask('est')!.estimate, 5, 'a rejected patch keeps the stored size')

    const cleared: any = await tool.execute({ id: 'est', action: 'meta', estimate: null })
    assert.equal(cleared.ok, true, JSON.stringify(cleared))
    assert.equal(cleared.task.estimate, 0, 'the brief reports zero when unestimated')
    assert.equal('estimate' in host.app.store.getTask('est')!, false)
  } finally {
    await rmrf(root)
  }
})

test('worktree_act meta writes depends_on and the brief reports it', async () => {
  const root = await mkTempDir('dshw-act-deps-')
  const host = bootHost({}, { stateDir: join(root, 'state') })
  const tool = host.tools.find((def: any) => def.name === 'worktree_act')
  assert.ok(tool, 'worktree_act is registered')
  try {
    host.app.store.putTask(task('dep-a'))
    host.app.store.putTask(task('dep-b'))

    // A task without dependencies still reports an empty list.
    const untouched: any = await tool.execute({ id: 'dep-a', action: 'meta', notes: 'n' })
    assert.equal(untouched.ok, true, JSON.stringify(untouched))
    assert.deepEqual(untouched.task.dependsOn, [])

    const set: any = await tool.execute({ id: 'dep-a', action: 'meta', depends_on: ['dep-b'] })
    assert.equal(set.ok, true, JSON.stringify(set))
    assert.deepEqual(set.task.dependsOn, ['dep-b'])

    // Omitting depends_on must not clear it.
    const notesOnly: any = await tool.execute({ id: 'dep-a', action: 'meta', notes: 'kept' })
    assert.equal(notesOnly.ok, true, JSON.stringify(notesOnly))
    assert.deepEqual(notesOnly.task.dependsOn, ['dep-b'])

    const rejected: any = await tool.execute({ id: 'dep-a', action: 'meta', depends_on: ['dep-a'] })
    assert.equal(rejected.ok, false)
    assert.match(String(rejected.error), /不能依赖自己/)

    const cleared: any = await tool.execute({ id: 'dep-a', action: 'meta', depends_on: [] })
    assert.equal(cleared.ok, true, JSON.stringify(cleared))
    assert.deepEqual(cleared.task.dependsOn, [])
  } finally {
    await rmrf(root)
  }
})
