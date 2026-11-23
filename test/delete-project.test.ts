import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { Runtime, TaskError } from '../src/runtime.js'
import { Store } from '../src/store.js'
import { acquireRepoLock } from '../src/repo-lock.js'
import { WorktreeTask } from '../src/models.js'
import { commitFile, exists, initRepo, mkTempDir, rmrf } from './helpers/git.js'

/**
 * Deleting a project removes worktrees, so it must go through the same gates as
 * deleting a single task: no running agent, no in-flight git operation, no
 * review session, and no concurrent publish under the same repo lock. A partial
 * failure must leave the ledger consistent instead of pointing at deleted dirs.
 */

const CONFIG = { dirName: '.dsh-worktrees', branchPrefix: 'dsh-wt/', gitPath: 'git' }

interface Fixture {
  root: string
  repo: string
  lockDir: string
  store: Store
  runtime: Runtime
  sessionState: { value: 'idle' | 'running' | 'unknown' }
}

async function fixture(): Promise<Fixture> {
  const root = await mkTempDir()
  const repo = join(root, 'repo')
  await fs.mkdir(repo, { recursive: true })
  await initRepo(repo)
  const store = new Store(join(root, 'state'))
  await store.load()
  const sessionState = { value: 'idle' as 'idle' | 'running' | 'unknown' }
  const lockDir = join(root, 'locks')
  const runtime = new Runtime({ store, repoLockDir: lockDir, config: CONFIG, sessionState: () => sessionState.value })
  return { root, repo, lockDir, store, runtime, sessionState }
}

async function teardown(f: Fixture): Promise<void> {
  f.store.dispose()
  await f.store.flush().catch(() => {})
  await new Promise((resolve) => setTimeout(resolve, 100))
  await rmrf(f.root)
}

async function publishTwo(f: Fixture): Promise<{ projectId: string; a: WorktreeTask; b: WorktreeTask }> {
  const a = await f.runtime.publish({ repoPath: f.repo, title: '任务A', description: 'a' })
  await commitFile(f.repo, 'a.txt', 'a')
  const second = await f.runtime.addProject({ repoPath: f.repo, name: '另外的名字' }).catch(() => null)
  const b = second
    ? await f.runtime.publish({ repoPath: f.repo, projectId: second.id, title: '任务B', description: 'b' })
    : await f.runtime.publish({ repoPath: f.repo, title: '任务B', description: 'b' })
  return { projectId: a.projectId, a, b }
}

test('a running agent blocks the project delete before anything is removed', async () => {
  const f = await fixture()
  try {
    const { projectId, a } = await publishTwo(f)
    f.sessionState.value = 'running'
    const bound = { ...f.store.getTask(a.id)! }
    bound.sessionId = 'sess-run'
    f.store.putTask(bound)

    await assert.rejects(
      () => f.runtime.deleteProject(projectId, { withTasks: true, withWorktrees: true }),
      (error: any) => error instanceof TaskError && error.status === 409 && error.code === 'agent-running',
    )
    assert.ok(f.store.getProject(projectId), 'the project still exists')
    assert.ok(f.store.getTask(a.id), 'its tasks still exist')
    assert.ok(await exists(a.worktreePath), 'no worktree was removed')
  } finally {
    await teardown(f)
  }
})

test('an unverifiable agent state blocks the project delete instead of guessing', async () => {
  const f = await fixture()
  try {
    const { projectId, a } = await publishTwo(f)
    f.sessionState.value = 'unknown'
    const bound = { ...f.store.getTask(a.id)! }
    bound.sessionId = 'sess-unknown'
    f.store.putTask(bound)

    await assert.rejects(
      () => f.runtime.deleteProject(projectId, { withTasks: true, withWorktrees: true }),
      (error: any) => error instanceof TaskError && error.status === 409 && error.code === 'agent-unknown',
    )
    assert.ok(f.store.getProject(projectId))
    assert.ok(await exists(a.worktreePath))
  } finally {
    await teardown(f)
  }
})

test('an in-flight git operation blocks the project delete', async () => {
  const f = await fixture()
  try {
    const { projectId, a } = await publishTwo(f)
    // A real in-progress operation in the main repo, the same probe every other
    // destructive action uses.
    await fs.writeFile(join(f.repo, '.git', 'MERGE_HEAD'), 'deadbeef\n', 'utf8')

    await assert.rejects(
      () => f.runtime.deleteProject(projectId, { withTasks: true, withWorktrees: true }),
      (error: any) => error instanceof TaskError && error.status === 409,
    )
    assert.ok(f.store.getTask(a.id))
    assert.ok(await exists(a.worktreePath))
  } finally {
    await teardown(f)
  }
})

test('a concurrent git operation on the same repo wins over the delete', async () => {
  const f = await fixture()
  try {
    const { projectId, a } = await publishTwo(f)
    const identity = await f.runtime.repoIdentity(f.repo)
    const held = acquireRepoLock(f.lockDir, identity, '合并')
    try {
      await assert.rejects(
        () => f.runtime.deleteProject(projectId, { withTasks: true, withWorktrees: true }),
        (error: any) => error instanceof TaskError && error.status === 409,
      )
    } finally {
      held.release()
    }
    assert.ok(f.store.getProject(projectId))
    assert.ok(await exists(a.worktreePath), 'the delete never ran while another action held the repo lock')
  } finally {
    await teardown(f)
  }
})

test(
  'a partial failure keeps the ledger consistent and names what failed',
  // A directory that is another process's cwd cannot be removed on Windows, which
  // is the real "one worktree is busy" case. POSIX allows removing it, so the
  // failure cannot be provoked the same way there.
  { skip: process.platform !== 'win32' },
  async () => {
    const f = await fixture()
    try {
      const { projectId, a, b } = await publishTwo(f)
      // Task B's record points at a directory git does not know and the OS will
      // not delete, so cleanup fails after task A was already removed.
      const busy = join(f.root, 'busy-worktree')
      await fs.mkdir(busy, { recursive: true })
      const busyChild = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 1500)'], { cwd: busy, stdio: 'ignore' })
      const busyExited = new Promise((resolve) => busyChild.on('exit', resolve))
      const broken = { ...f.store.getTask(b.id)! }
      broken.worktreePath = busy
      f.store.putTask(broken)

      await assert.rejects(
        () => f.runtime.deleteProject(projectId, { withTasks: true, withWorktrees: true }),
        (error: any) =>
          error instanceof TaskError && error.status === 409 && error.code === 'partial-delete' && /任务B/.test(error.message),
      )
      assert.ok(f.store.getProject(projectId), 'the project is not half-deleted')
      assert.ok(f.store.getTask(b.id), 'the failed task keeps its record')
      assert.equal(f.store.getTask(a.id), undefined, 'the cleaned task record is gone')
      assert.equal(await exists(a.worktreePath), false)
      assert.ok(await exists(busy), 'the directory we could not clean up is still there, with its record')

      busyChild.kill()
      await busyExited
      // Retry after the lock is gone: the same call finishes the job.
      const retry = await f.runtime.deleteProject(projectId, { withTasks: true, withWorktrees: true })
      assert.equal(retry.deletedTasks, 1)
      assert.equal(f.store.getProject(projectId), undefined)
      assert.equal(await exists(busy), false)
    } finally {
      await teardown(f)
    }
  },
)

test('a clean delete removes worktrees and records together', async () => {
  const f = await fixture()
  try {
    const { projectId, a, b } = await publishTwo(f)
    const result = await f.runtime.deleteProject(projectId, { withTasks: true, withWorktrees: true })
    assert.equal(result.deletedTasks, 2)
    assert.equal(result.deletedWorktrees, 2)
    assert.equal(f.store.getProject(projectId), undefined)
    assert.equal(f.store.listTasksOfProject(projectId).length, 0)
    assert.equal(await exists(a.worktreePath), false)
    assert.equal(await exists(b.worktreePath), false)
  } finally {
    await teardown(f)
  }
})
