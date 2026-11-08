import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { Runtime, TaskError } from '../src/runtime.js'
import { Store } from '../src/store.js'
import { WorktreeTask } from '../src/models.js'
import { commitFile, exists, git, initRepo, mkTempDir, rmrf } from './helpers/git.js'

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
  // Let dispose()'s fire-and-forget flush finish before deleting the temp dir,
  // otherwise Windows reports ENOTEMPTY while it is still writing.
  await new Promise((resolve) => setTimeout(resolve, 100))
  await rmrf(f.root)
}

test('publish creates a worktree + hashed branch and a startable task record', async () => {
  const f = await fixture()
  try {
    const task = await f.runtime.publish({ repoPath: f.repo, title: '中文标题', description: '实现一个功能' })
    const id8 = task.id.replace(/-/g, '').slice(0, 8)
    assert.equal(task.branch, 'dsh-wt/' + id8)
    assert.equal(task.sessionId, null)
    assert.equal(task.startOnBind, true)
    assert.ok(await exists(task.worktreePath), 'worktree directory should exist')
    assert.ok((await git(f.repo, ['branch', '--list', task.branch])).includes(task.branch), 'task branch should exist')
    assert.ok(task.firstPrompt.includes(task.worktreePath), 'first prompt points at the worktree')
    assert.ok(task.firstPrompt.includes(task.branch))

    const view = await f.runtime.view(task)
    assert.equal(view.snapshot.status, 'ready')
    assert.equal(view.snapshot.worktree.exists, true)
    assert.equal(view.snapshot.branchExists, true)
  } finally {
    await teardown(f)
  }
})

test('publish honors start/autoBind=false by clearing startOnBind', async () => {
  const f = await fixture()
  try {
    const noStart = await f.runtime.publish({ repoPath: f.repo, title: 'A', description: 'd', start: false })
    assert.equal(noStart.startOnBind, false)
    const noAuto = await f.runtime.publish({ repoPath: f.repo, title: 'B', description: 'd', autoBind: false })
    assert.equal(noAuto.startOnBind, false)
  } finally {
    await teardown(f)
  }
})

test('publish rejects invalid input', async () => {
  const f = await fixture()
  try {
    await assert.rejects(
      () => f.runtime.publish({ repoPath: f.repo, title: '   ', description: 'd' }),
      (e: any) => e instanceof TaskError && /任务标题不能为空/.test(e.message),
    )
    await assert.rejects(
      () => f.runtime.publish({ repoPath: f.repo, title: 't', description: '  ' }),
      (e: any) => e instanceof TaskError && /任务描述不能为空/.test(e.message),
    )
    await assert.rejects(
      () => f.runtime.publish({ repoPath: f.repo, title: 't', description: 'd', branchName: '中文分支' }),
      (e: any) => e instanceof TaskError && /任务分支只能使用/.test(e.message),
    )
    await assert.rejects(
      () => f.runtime.publish({ repoPath: f.repo, title: 't', description: 'd', branchName: 'ok.lock' }),
      (e: any) => e instanceof TaskError && /任务分支只能使用/.test(e.message),
    )
    await assert.rejects(
      () => f.runtime.publish({ repoPath: f.repo, title: 't', description: 'd', baseBranch: 'does-not-exist' }),
      (e: any) => e instanceof TaskError && /基线分支不存在/.test(e.message),
    )
    await assert.rejects(
      () => f.runtime.publish({ title: 't', description: 'd' }),
      (e: any) => e instanceof TaskError && /缺少 projectId 或 repoPath/.test(e.message),
    )
  } finally {
    await teardown(f)
  }
})

test('duplicate explicit branch names get a numeric suffix', async () => {
  const f = await fixture()
  try {
    const first = await f.runtime.publish({ repoPath: f.repo, title: 't1', description: 'd', branchName: 'feat/x' })
    const second = await f.runtime.publish({ repoPath: f.repo, title: 't2', description: 'd', branchName: 'feat/x' })
    assert.equal(first.branch, 'feat/x')
    assert.equal(second.branch, 'feat/x-2')
  } finally {
    await teardown(f)
  }
})

test('bind -> developing -> review -> reviewing -> merged -> cleaned full acceptance flow', async () => {
  const f = await fixture()
  try {
    const task = await f.runtime.publish({ repoPath: f.repo, title: '生命周期', description: '实现并提交' })

    // bind a session -> developing
    f.runtime.bind(task.id, 'sess-1')
    assert.equal((await f.runtime.view(task)).snapshot.status, 'developing')

    // simulate the agent committing inside the worktree -> review
    await commitFile(task.worktreePath, 'src/feature.txt', 'hello\n', 'feat: add feature')
    assert.equal((await f.runtime.view(task)).snapshot.status, 'review')

    // acceptance: switch main repo to the task branch -> reviewing
    await f.runtime.checkout(task.id)
    assert.equal((await f.runtime.view(task)).snapshot.status, 'reviewing')

    // switch back to the original branch -> review again
    await f.runtime.back(task.id)
    assert.equal((await f.runtime.view(task)).snapshot.status, 'review')

    // merge into base -> merged
    await f.runtime.merge(task.id)
    assert.equal((await f.runtime.view(task)).snapshot.status, 'merged')

    // cleanup with branch deletion -> cleaned, worktree+branch gone
    await f.runtime.cleanup(task.id, { deleteBranch: true })
    const final = await f.runtime.view(task)
    assert.equal(final.snapshot.status, 'cleaned')
    assert.equal(await exists(task.worktreePath), false)
    assert.equal((await git(f.repo, ['branch', '--list', task.branch])).includes(task.branch), false)
  } finally {
    await teardown(f)
  }
})

test('bind/unbind manage the session association without throwing', async () => {
  const f = await fixture()
  try {
    const task = await f.runtime.publish({ repoPath: f.repo, title: 't', description: 'd' })
    const bound = f.runtime.bind(task.id, 'sess-xyz')
    assert.equal(bound.sessionId, 'sess-xyz')
    assert.equal(bound.startOnBind, false)
    const unbound = f.runtime.unbindBySession('sess-xyz')
    assert.equal(unbound?.id, task.id)
    assert.equal(f.store.getTask(task.id)!.sessionId, null)
  } finally {
    await teardown(f)
  }
})

test('snapshot of a task whose repo vanished resolves instead of throwing', async () => {
  const f = await fixture()
  try {
    const bogus: WorktreeTask = {
      id: 'lonely',
      projectId: 'p',
      title: 't',
      description: 'd',
      repoPath: join(f.root, 'gone'),
      baseBranch: 'main',
      branch: 'feat',
      worktreePath: join(f.root, 'gone-wt'),
      sessionId: null,
      firstPrompt: '',
      startOnBind: true,
      createdAt: 1,
      updatedAt: 1,
    }
    const snap = await f.runtime.snapshot(bogus)
    assert.equal(typeof snap.status, 'string')
    assert.equal(snap.repo.exists, false)
  } finally {
    await teardown(f)
  }
})
