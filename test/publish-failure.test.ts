import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { Runtime, TaskError } from '../src/runtime.js'
import { Store } from '../src/store.js'
import { git, initRepo, mkTempDir, rmrf } from './helpers/git.js'

/**
 * A publish that cannot create its worktree must fail loudly and leave nothing
 * behind: no task record, no branch, no half-created directory. The board is
 * shared, so an orphan record would show a task that has no worktree.
 */

const CONFIG = { dirName: '.dsh-worktrees', branchPrefix: 'dsh-wt/', gitPath: 'git' }

async function fixture(): Promise<{ root: string; repo: string; store: Store; runtime: Runtime }> {
  const root = await mkTempDir()
  const repo = join(root, 'repo')
  await fs.mkdir(repo, { recursive: true })
  await initRepo(repo)
  const store = new Store(join(root, 'state'))
  await store.load()
  const runtime = new Runtime({ store, repoLockDir: join(root, 'locks'), config: CONFIG, sessionState: () => 'idle' })
  return { root, repo, store, runtime }
}

async function teardown(f: { root: string; store: Store }): Promise<void> {
  f.store.dispose()
  await new Promise((resolve) => setTimeout(resolve, 100))
  await rmrf(f.root)
}

test('a publish that cannot create its worktree leaves no record, branch or shell', async () => {
  const f = await fixture()
  try {
    // A file where the worktree container belongs: every `git worktree add`
    // below it fails, which is what a permissions/locked-folder error looks like.
    await fs.writeFile(join(f.repo, '.dsh-worktrees'), 'not a directory', 'utf8')
    await assert.rejects(
      () => f.runtime.publish({ repoPath: f.repo, title: '任务', description: '说明' }),
      (error: any) => error instanceof TaskError || error instanceof Error,
    )
    assert.deepEqual(f.store.listTasks(), [], 'no task record survives a failed publish')
    const branches = (await git(f.repo, ['branch', '--list', 'dsh-wt/*'])).trim()
    assert.equal(branches, '', 'no task branch is left behind')
    const entries = await fs.readdir(f.repo)
    assert.equal(entries.includes('.dsh-worktrees.json'), false)
  } finally {
    await teardown(f)
  }
})

test('a failed publish does not block the next attempt', async () => {
  const f = await fixture()
  try {
    await fs.writeFile(join(f.repo, '.dsh-worktrees'), 'x', 'utf8')
    await assert.rejects(() => f.runtime.publish({ repoPath: f.repo, title: '失败', description: 'd' }))
    await fs.rm(join(f.repo, '.dsh-worktrees'))
    const task = await f.runtime.publish({ repoPath: f.repo, title: '成功', description: 'd' })
    assert.ok(task.worktreePath.startsWith(join(f.repo, '.dsh-worktrees')))
    assert.equal(f.store.listTasks().length, 1)
    assert.ok(await fs.stat(task.worktreePath).then((s) => s.isDirectory()))
  } finally {
    await teardown(f)
  }
})
