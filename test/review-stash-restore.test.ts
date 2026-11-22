import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { Runtime } from '../src/runtime.js'
import { Store } from '../src/store.js'
import { commitFile, git, initRepo, mkTempDir, rmrf } from './helpers/git.js'

const CONFIG = { dirName: '.dsh-worktrees', branchPrefix: 'dsh-wt/', gitPath: 'git' }

interface Fixture {
  root: string
  repo: string
  store: Store
  runtime: Runtime
}

async function fixture(): Promise<Fixture> {
  const root = await mkTempDir()
  const repo = join(root, 'repo')
  await fs.mkdir(repo, { recursive: true })
  await initRepo(repo)
  const store = new Store(join(root, 'state'))
  await store.load()
  const runtime = new Runtime({ store, config: CONFIG })
  return { root, repo, store, runtime }
}

async function teardown(f: Fixture): Promise<void> {
  f.store.dispose()
  await f.store.flush()
  await new Promise((resolve) => setTimeout(resolve, 100))
  await rmrf(f.root)
}

/** Publish a task, commit inside its worktree, and leave a main-repo edit. */
async function dirtyReviewFixture(f: Fixture) {
  await commitFile(f.repo, 'a.txt', 'base\n', 'base')
  const task = await f.runtime.publish({ repoPath: f.repo, title: 'stash', description: 'd' })
  await commitFile(task.worktreePath, 'w.txt', 'work\n', 'work')
  // Edit a path the task commit also touches, so switching really needs a stash.
  await fs.writeFile(join(f.repo, 'w.txt'), 'local edit\n', 'utf8')
  return task
}

test('back auto-restores the review stash and drops the record', async () => {
  const f = await fixture()
  try {
    const task = await dirtyReviewFixture(f)
    const checked = await f.runtime.checkout(task.id, { strategy: 'stash' })
    assert.equal((checked.pendingStashes || []).length, 1, 'review stash should be recorded')
    assert.equal((await git(f.repo, ['status', '--porcelain'])).trim(), '', 'checkout should stash the edit')

    const back = await f.runtime.back(task.id)
    assert.equal((back.pendingStashes || []).length, 0, 'restoring consumes the record')
    // The applied stash entry is dropped too: nothing should be left to re-apply.
    assert.equal((await git(f.repo, ['stash', 'list', '--format=%H'])).trim(), '')
    assert.equal(back.reviewStash, undefined)
    assert.equal((await fs.readFile(join(f.repo, 'w.txt'), 'utf8')).trim(), 'local edit')
    assert.equal(f.runtime.takeWarning(task.id), undefined, 'a clean restore needs no warning')

    // The record is gone, so a second back has nothing left to apply.
    const again = await f.runtime.back(task.id)
    assert.equal((again.pendingStashes || []).length, 0)
  } finally {
    await teardown(f)
  }
})

test('back keeps the record and warns when the repo is dirty', async () => {
  const f = await fixture()
  try {
    const task = await dirtyReviewFixture(f)
    await f.runtime.checkout(task.id, { strategy: 'stash' })
    // A tracked edit that does not block the switch back: the repo is dirty
    // when the auto-restore would run, so it must not touch the worktree.
    await fs.writeFile(join(f.repo, 'a.txt'), 'scratch\n', 'utf8')

    const back = await f.runtime.back(task.id)
    assert.equal((back.pendingStashes || []).length, 1, 'record survives an unsafe restore')
    const warning = f.runtime.takeWarning(task.id)
    assert.ok(warning, 'the UI must learn why nothing was restored')
    assert.match(String(warning), /未自动恢复/)
  } finally {
    await teardown(f)
  }
})

test('manual apply consumes the stash record', async () => {
  const f = await fixture()
  try {
    const task = await dirtyReviewFixture(f)
    await f.runtime.checkout(task.id, { strategy: 'stash' })
    // Make the auto-restore skip (dirty repo) so the stash stays pending.
    await fs.writeFile(join(f.repo, 'a.txt'), 'scratch\n', 'utf8')
    const pending = await f.runtime.back(task.id)
    assert.ok(pending.pendingStashes?.[0]?.sha)
    await git(f.repo, ['checkout', '--', 'a.txt'])

    const applied = await f.runtime.applyStash(task.id)
    assert.equal((applied.pendingStashes || []).length, 0, 'apply is a consume, not a copy')
    assert.equal((await fs.readFile(join(f.repo, 'w.txt'), 'utf8')).trim(), 'local edit')

    // A second apply must not find the record again.
    await assert.rejects(() => f.runtime.applyStash(task.id), /没有可恢复的暂存/)
  } finally {
    await teardown(f)
  }
})

test('delete is gated on the agent run state', async () => {
  const f = await fixture()
  try {
    const task = await dirtyReviewFixture(f)
    await f.runtime.back(task.id).catch(() => undefined)
    const bound = f.runtime.bind(task.id, 'sess-1')
    assert.equal(bound.sessionId, 'sess-1')

    for (const [label, state] of [['running', 'running'], ['unknown', 'unknown']] as const) {
      const blocked = new Runtime({ store: f.store, config: CONFIG, sessionState: () => state })
      await assert.rejects(
        () => blocked.delete(task.id),
        (error: any) => error.status === 409 && error.code === `agent-${label}`,
      )
      assert.ok(f.store.getTask(task.id), 'the record must survive a blocked delete')
    }

    const idle = new Runtime({ store: f.store, config: CONFIG, sessionState: () => 'idle' })
    await idle.delete(task.id)
    assert.equal(f.store.getTask(task.id), undefined)
  } finally {
    await teardown(f)
  }
})
