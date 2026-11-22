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
