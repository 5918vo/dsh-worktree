import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
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

test('deleteProject removes task records and worktree folders on request', async () => {
  const f = await fixture()
  try {
    const project = await f.runtime.addProject({ repoPath: f.repo, name: 'proj' })
    const t1 = await f.runtime.publish({ projectId: project.id, title: 'a', description: 'd' })
    const t2 = await f.runtime.publish({ projectId: project.id, title: 'b', description: 'd' })
    assert.ok(await exists(t1.worktreePath))
    assert.ok(await exists(t2.worktreePath))

    // Refuses to drop a project that still has tasks unless withTasks is set.
    await assert.rejects(
      () => f.runtime.deleteProject(project.id, { withWorktrees: true }),
      (e: any) => e instanceof TaskError && /连同任务删除/.test(e.message),
    )

    const res = await f.runtime.deleteProject(project.id, { withTasks: true, withWorktrees: true })
    assert.equal(res.deletedTasks, 2)
    assert.equal(res.deletedWorktrees, 2)
    assert.equal(await exists(t1.worktreePath), false)
    assert.equal(await exists(t2.worktreePath), false)
    assert.equal(await exists(dirname(t1.worktreePath)), false, 'empty worktree container should be removed')
    assert.equal(f.store.getProject(project.id), undefined)
    assert.equal(f.store.listTasksOfProject(project.id).length, 0)
  } finally {
    await teardown(f)
  }
})

test('deleteProject keeps worktree folders when withWorktrees is false', async () => {
  const f = await fixture()
  try {
    const project = await f.runtime.addProject({ repoPath: f.repo, name: 'proj' })
    const task = await f.runtime.publish({ projectId: project.id, title: 'a', description: 'd' })
    const res = await f.runtime.deleteProject(project.id, { withTasks: true })
    assert.equal(res.deletedTasks, 1)
    assert.equal(res.deletedWorktrees, 0)
    assert.ok(await exists(task.worktreePath), 'worktree should stay on disk')
    assert.equal(f.store.getProject(project.id), undefined)
  } finally {
    await teardown(f)
  }
})

test('deleteProject force-removes a dirty worktree when requested', async () => {
  const f = await fixture()
  try {
    const project = await f.runtime.addProject({ repoPath: f.repo, name: 'proj' })
    const task = await f.runtime.publish({ projectId: project.id, title: 'a', description: 'd' })
    await commitFile(task.worktreePath, 'src/feature.txt', 'hello\n', 'feat: wip')
    await fs.writeFile(join(task.worktreePath, 'scratch.txt'), 'uncommitted\n', 'utf8')
    const res = await f.runtime.deleteProject(project.id, { withTasks: true, withWorktrees: true })
    assert.equal(res.deletedWorktrees, 1)
    assert.equal(await exists(task.worktreePath), false)
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

test('a branch left at an older base is not reported as merged', async () => {
  const f = await fixture()
  try {
    const behind = await f.runtime.publish({ repoPath: f.repo, title: 'behind', description: 'd' })
    const merged = await f.runtime.publish({ repoPath: f.repo, title: 'merged', description: 'd' })

    await commitFile(merged.worktreePath, 'src/ahead.txt', 'ahead\n', 'feat: ahead')
    await f.runtime.merge(merged.id)

    const view = await f.runtime.view(behind)
    assert.equal(view.snapshot.merged, false)
    assert.notEqual(view.snapshot.status, 'merged')
  } finally {
    await teardown(f)
  }
})

test('diff reports committed, uncommitted and untracked changes against base', async () => {
  const f = await fixture()
  try {
    const task = await f.runtime.publish({ repoPath: f.repo, title: 'diff', description: 'd' })
    // One committed new file and one committed edit to a base file...
    await commitFile(task.worktreePath, 'src/a.txt', 'one\ntwo\n', 'feat: a')
    await commitFile(task.worktreePath, 'README.md', '# test repo\n\nmore\n', 'docs: readme')
    // ...plus an uncommitted edit to the committed file and an untracked file.
    await fs.writeFile(join(task.worktreePath, 'src/a.txt'), 'one\ntwo\nthree\n', 'utf8')
    await fs.writeFile(join(task.worktreePath, 'src/new.txt'), 'x\ny\n', 'utf8')

    const diff = await f.runtime.diff(task.id)
    assert.equal(diff.base, task.baseBranch)
    assert.ok(diff.mergeBase, 'merge-base should resolve')
    assert.equal(diff.reason, undefined)

    const byPath = new Map(diff.files.map((file) => [file.path, file]))
    const a = byPath.get('src/a.txt')
    assert.ok(a, 'committed new file should appear')
    assert.equal(a!.status, 'added')
    assert.ok(a!.patch.includes('+three'), 'uncommitted edit should be included in the diff')

    const readme = byPath.get('README.md')
    assert.ok(readme, 'edited base file should appear')
    assert.equal(readme!.status, 'modified')

    const untracked = byPath.get('src/new.txt')
    assert.ok(untracked, 'untracked file should appear')
    assert.equal(untracked!.status, 'untracked')
    assert.equal(untracked!.additions, 2)
    assert.ok(diff.totalAdditions >= 4)
  } finally {
    await teardown(f)
  }
})

test('diff falls back to the recorded branch when the worktree is gone', async () => {
  const f = await fixture()
  try {
    const task = await f.runtime.publish({ repoPath: f.repo, title: 'gone', description: 'd' })
    await fs.rm(task.worktreePath, { recursive: true, force: true })
    const diff = await f.runtime.diff(task.id)
    // Branch still exists (it equals base), so this resolves rather than throwing.
    assert.equal(diff.reason, undefined)
    assert.equal(diff.files.length, 0)
  } finally {
    await teardown(f)
  }
})

test('merge conflict reports the conflicting files and leaves the repo clean', async () => {
  const f = await fixture()
  try {
    const task = await f.runtime.publish({ repoPath: f.repo, title: 'conflict', description: 'd' })
    await commitFile(task.worktreePath, 'src/conflict.txt', 'task\n', 'feat: task')

    await fs.mkdir(join(f.repo, 'src'), { recursive: true })
    await fs.writeFile(join(f.repo, 'src', 'conflict.txt'), 'base\n', 'utf8')
    await git(f.repo, ['add', '.'])
    await git(f.repo, ['commit', '-m', 'base change'])

    const preview = await f.runtime.mergePreview(task.id)
    assert.equal(preview.applicable, true)
    assert.equal(preview.baseAhead, 1)
    assert.deepEqual(preview.overlapFiles, ['src/conflict.txt'])
    assert.equal(preview.conflict, true)
    assert.ok(preview.conflictFiles.includes('src/conflict.txt'))

    await assert.rejects(() => f.runtime.merge(task.id), (error: any) => {
      assert.equal(error.status, 409)
      assert.match(error.message, /无法自动合并/)
      assert.match(error.message, /src\/conflict\.txt/)
      return true
    })
    assert.equal(await exists(join(f.repo, '.git', 'MERGE_HEAD')), false)
  } finally {
    await teardown(f)
  }
})

test('merge records the merged branch tip and later commits show as merged + postMergeAhead', async () => {
  const f = await fixture()
  try {
    const task = await f.runtime.publish({ repoPath: f.repo, title: 'm', description: 'd' })
    await commitFile(task.worktreePath, 'src/a.txt', 'a\n', 'feat: a')
    const merged = await f.runtime.merge(task.id)
    assert.ok(merged.mergedBranchTip, 'mergedBranchTip should be recorded')
    assert.ok(merged.mergedCommit, 'mergedCommit should be recorded')

    // The old branch picks up another commit after the merge.
    await commitFile(task.worktreePath, 'src/b.txt', 'b\n', 'feat: b after merge')
    const view = await f.runtime.view(task)
    assert.equal(view.snapshot.merged, true)
    assert.equal(view.snapshot.status, 'merged')
    assert.equal(view.snapshot.postMergeAhead, 1)
  } finally {
    await teardown(f)
  }
})

test('publish with parentId continues a merged task from the base and records the link', async () => {
  const f = await fixture()
  try {
    const parent = await f.runtime.publish({ repoPath: f.repo, title: '父任务', description: 'd' })
    await commitFile(parent.worktreePath, 'src/parent.txt', 'parent\n', 'feat: parent')
    await f.runtime.merge(parent.id)

    const child = await f.runtime.publish({ repoPath: f.repo, title: '子任务', description: 'd2', parentId: parent.id })
    assert.equal(child.parentId, parent.id)
    assert.equal(child.baseBranch, parent.baseBranch)
    assert.ok(await exists(join(child.worktreePath, 'src/parent.txt')), 'child worktree should contain the merged parent file')
    assert.ok(child.firstPrompt.includes('前序任务'))
    assert.ok(child.firstPrompt.includes(parent.title))
    assert.ok(child.firstPrompt.includes(parent.branch))
  } finally {
    await teardown(f)
  }
})

test('publish with parentId rejects a predecessor that was never merged', async () => {
  const f = await fixture()
  try {
    const parent = await f.runtime.publish({ repoPath: f.repo, title: 'p', description: 'd' })
    await assert.rejects(
      () => f.runtime.publish({ repoPath: f.repo, title: 'c', description: 'd', parentId: parent.id }),
      (e: any) => e instanceof TaskError && /尚未合并/.test(e.message),
    )
  } finally {
    await teardown(f)
  }
})

test('publish with parentId works after the predecessor worktree and branch are cleaned', async () => {
  const f = await fixture()
  try {
    const parent = await f.runtime.publish({ repoPath: f.repo, title: 'p', description: 'd' })
    await commitFile(parent.worktreePath, 'src/p.txt', 'p\n', 'feat: p')
    await f.runtime.merge(parent.id)
    await f.runtime.cleanup(parent.id, { deleteBranch: true })

    const child = await f.runtime.publish({ repoPath: f.repo, title: 'c', description: 'd', parentId: parent.id })
    assert.equal(child.parentId, parent.id)
    assert.ok(await exists(join(child.worktreePath, 'src/p.txt')), 'base still carries the merged changes')
  } finally {
    await teardown(f)
  }
})

test('follow-up prompt lists leftover commits with a cherry-pick hint', async () => {
  const f = await fixture()
  try {
    const parent = await f.runtime.publish({ repoPath: f.repo, title: 'p', description: 'd' })
    await commitFile(parent.worktreePath, 'src/a.txt', 'a\n', 'feat: first')
    await f.runtime.merge(parent.id)
    await commitFile(parent.worktreePath, 'src/b.txt', 'b\n', 'feat: leftover work')

    const view = await f.runtime.view(parent)
    assert.equal(view.snapshot.postMergeAhead, 1)

    const child = await f.runtime.publish({ repoPath: f.repo, title: 'c', description: 'd', parentId: parent.id })
    assert.ok(child.firstPrompt.includes('feat: leftover work'), 'leftover commit subject should be listed')
    assert.ok(child.firstPrompt.includes('cherry-pick'), 'cherry-pick hint should be present')
    // The follow-up branch starts from base, so the leftover file is not present yet.
    assert.equal(await exists(join(child.worktreePath, 'src/b.txt')), false)
  } finally {
    await teardown(f)
  }
})

test('checkout rejects when the worktree only has uncommitted changes (no commits ahead)', async () => {
  const f = await fixture()
  try {
    const task = await f.runtime.publish({ repoPath: f.repo, title: 'dirty-only', description: 'd' })
    await fs.mkdir(join(task.worktreePath, 'src'), { recursive: true })
    await fs.writeFile(join(task.worktreePath, 'src', 'scratch.txt'), 'x\n', 'utf8')
    await assert.rejects(
      () => f.runtime.checkout(task.id),
      (e: any) => e instanceof TaskError && /worktree 有 1 处未提交改动/.test(e.message),
    )
  } finally {
    await teardown(f)
  }
})

test('checkout rejects when the main repo is dirty', async () => {
  const f = await fixture()
  try {
    const task = await f.runtime.publish({ repoPath: f.repo, title: 'repo-dirty', description: 'd' })
    await commitFile(task.worktreePath, 'src/a.txt', 'a\n', 'feat: a')
    await fs.writeFile(join(f.repo, 'README.md'), '# dirty\n', 'utf8')
    await assert.rejects(
      () => f.runtime.checkout(task.id),
      (e: any) => e instanceof TaskError && /主仓库有 1 处未提交改动/.test(e.message),
    )
  } finally {
    await teardown(f)
  }
})

test('checkout rejects while another task of the same repo is being reviewed', async () => {
  const f = await fixture()
  try {
    const a = await f.runtime.publish({ repoPath: f.repo, title: '任务A', description: 'd' })
    const b = await f.runtime.publish({ repoPath: f.repo, title: '任务B', description: 'd' })
    await commitFile(a.worktreePath, 'src/a.txt', 'a\n', 'feat: a')
    await commitFile(b.worktreePath, 'src/b.txt', 'b\n', 'feat: b')
    await f.runtime.checkout(a.id)
    await assert.rejects(
      () => f.runtime.checkout(b.id),
      (e: any) => e instanceof TaskError && /任务「任务A」正在验收/.test(e.message),
    )
  } finally {
    await teardown(f)
  }
})

test('checkout/merge refuse while a merge is in progress', async () => {
  const f = await fixture()
  try {
    const task = await f.runtime.publish({ repoPath: f.repo, title: 'in-progress', description: 'd' })
    await commitFile(task.worktreePath, 'src/a.txt', 'a\n', 'feat: a')
    const gitDir = (await git(f.repo, ['rev-parse', '--absolute-git-dir'])).trim()
    const marker = join(gitDir, 'MERGE_HEAD')
    await fs.writeFile(marker, 'deadbeef\n', 'utf8')
    try {
      await assert.rejects(
        () => f.runtime.checkout(task.id),
        (e: any) => e instanceof TaskError && /未完成的 merge/.test(e.message),
      )
      await assert.rejects(
        () => f.runtime.merge(task.id),
        (e: any) => e instanceof TaskError && /未完成的 merge/.test(e.message),
      )
    } finally {
      await fs.rm(marker, { force: true })
    }
  } finally {
    await teardown(f)
  }
})

test('merge refuses when the main repo is not on the base branch (no silent switch)', async () => {
  const f = await fixture()
  try {
    const task = await f.runtime.publish({ repoPath: f.repo, title: 'not-on-base', description: 'd' })
    await commitFile(task.worktreePath, 'src/a.txt', 'a\n', 'feat: a')
    await f.runtime.checkout(task.id) // main repo now on the task branch
    await assert.rejects(
      () => f.runtime.merge(task.id),
      (e: any) => e instanceof TaskError && /请先切到基线分支/.test(e.message),
    )
  } finally {
    await teardown(f)
  }
})

test('merge refuses when the worktree has uncommitted changes', async () => {
  const f = await fixture()
  try {
    const task = await f.runtime.publish({ repoPath: f.repo, title: 'merge-dirty', description: 'd' })
    await commitFile(task.worktreePath, 'src/a.txt', 'a\n', 'feat: a')
    await fs.writeFile(join(task.worktreePath, 'src', 'extra.txt'), 'x\n', 'utf8')
    await assert.rejects(
      () => f.runtime.merge(task.id),
      (e: any) => e instanceof TaskError && /这些改动不会被合并/.test(e.message),
    )
  } finally {
    await teardown(f)
  }
})

test('back falls back to the base branch when no original branch is recorded', async () => {
  const f = await fixture()
  try {
    const task = await f.runtime.publish({ repoPath: f.repo, title: 'back-fallback', description: 'd' })
    await commitFile(task.worktreePath, 'src/a.txt', 'a\n', 'feat: a')
    await f.runtime.checkout(task.id)
    task.originalBranch = undefined
    f.store.putTask(task)
    await f.runtime.back(task.id)
    const view = await f.runtime.view(task)
    assert.equal(view.snapshot.repo.currentBranch, task.baseBranch)
  } finally {
    await teardown(f)
  }
})

test('back refuses when the main repo is dirty', async () => {
  const f = await fixture()
  try {
    const task = await f.runtime.publish({ repoPath: f.repo, title: 'back-dirty', description: 'd' })
    await commitFile(task.worktreePath, 'src/a.txt', 'a\n', 'feat: a')
    await f.runtime.checkout(task.id)
    await fs.writeFile(join(f.repo, 'README.md'), '# dirty\n', 'utf8')
    await assert.rejects(
      () => f.runtime.back(task.id),
      (e: any) => e instanceof TaskError && /主仓库有 1 处未提交改动/.test(e.message),
    )
  } finally {
    await teardown(f)
  }
})
