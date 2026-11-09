import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { Runtime } from '../src/runtime.js'
import { Store } from '../src/store.js'
import { commitFile, initRepo, mkTempDir, rmrf } from './helpers/git.js'

const CONFIG = { dirName: '.dsh-worktrees', branchPrefix: 'dsh-wt/', gitPath: 'git' }

async function fixture() {
  const root = await mkTempDir('dshw-preview-')
  const repo = join(root, 'repo')
  await fs.mkdir(repo, { recursive: true })
  await initRepo(repo)
  const store = new Store(join(root, 'state'))
  await store.load()
  const runtime = new Runtime({ store, config: CONFIG })
  return { root, repo, store, runtime }
}

async function teardown(f: any) {
  f.store.dispose()
  await f.store.flush()
  await new Promise((resolve) => setTimeout(resolve, 100))
  await rmrf(f.root)
}

test('merge preview is cached by (tip, base) and force bypasses the cache', async () => {
  const f = await fixture()
  try {
    const task = await f.runtime.publish({ repoPath: f.repo, title: 'cache', description: 'd' })
    await commitFile(task.worktreePath, 'src/a.txt', 'a\n', 'feat: a')
    await commitFile(f.repo, 'src/b.txt', 'b\n', 'base: b')

    const first = await f.runtime.mergePreview(task.id)
    assert.equal(first.cached, false)
    assert.equal(first.checked, true)
    assert.ok(first.checkedAt, 'first check records a timestamp')

    // Same tip + base -> served from cache without re-running merge-tree.
    const second = await f.runtime.mergePreview(task.id)
    assert.equal(second.cached, true)
    assert.equal(second.checkedAt, first.checkedAt)
    assert.equal(second.conflict, first.conflict)

    // A forced check must bypass the cache.
    const forced = await f.runtime.mergePreview(task.id, { force: true })
    assert.equal(forced.cached, false)

    // Moving the task branch tip invalidates the cache.
    await commitFile(task.worktreePath, 'src/c.txt', 'c\n', 'feat: c')
    const afterTip = await f.runtime.mergePreview(task.id)
    assert.equal(afterTip.cached, false)
    assert.notEqual(afterTip.expectedTip, first.expectedTip)
  } finally {
    await teardown(f)
  }
})

test('merge preview cache is invalidated when the base branch advances', async () => {
  const f = await fixture()
  try {
    const task = await f.runtime.publish({ repoPath: f.repo, title: 'cache-base', description: 'd' })
    await commitFile(task.worktreePath, 'src/a.txt', 'a\n', 'feat: a')
    await commitFile(f.repo, 'src/b.txt', 'b\n', 'base: b')

    const first = await f.runtime.mergePreview(task.id)
    assert.equal(first.cached, false)

    await commitFile(f.repo, 'src/d.txt', 'd\n', 'base: d')
    const afterBase = await f.runtime.mergePreview(task.id)
    assert.equal(afterBase.cached, false)
    assert.notEqual(afterBase.expectedBase, first.expectedBase)
  } finally {
    await teardown(f)
  }
})
