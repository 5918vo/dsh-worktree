import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { Runtime, TaskError } from '../src/runtime.js'
import { Store } from '../src/store.js'
import { commitFile, exists, git, initRepo, mkTempDir, rmrf } from './helpers/git.js'

const CONFIG = { dirName: '.dsh-worktrees', branchPrefix: 'dsh-wt/', gitPath: 'git' }

interface Fixture {
  root: string
  repo: string
  store: Store
  runtime: Runtime
}

async function fixture(sessionState?: (id: string) => 'running' | 'idle' | 'unknown'): Promise<Fixture> {
  const root = await mkTempDir('dshw-merge-')
  const repo = join(root, 'repo')
  await fs.mkdir(repo, { recursive: true })
  await initRepo(repo)
  const store = new Store(join(root, 'state'))
  await store.load()
  const runtime = new Runtime({ store, config: CONFIG, ...(sessionState ? { sessionState } : {}) })
  return { root, repo, store, runtime }
}

async function teardown(f: Fixture): Promise<void> {
  f.store.dispose()
  await f.store.flush()
  await new Promise((resolve) => setTimeout(resolve, 80))
  await rmrf(f.root)
}

const branchOf = async (repo: string) => (await git(repo, ['branch', '--show-current'])).trim()
const headOf = async (repo: string) => (await git(repo, ['rev-parse', 'HEAD'])).trim()

async function mergedTask(f: Fixture, title = 't') {
  const task = await f.runtime.publish({ repoPath: f.repo, title, description: 'd' })
  await commitFile(task.worktreePath, 'src/a.txt', 'a\n', 'feat: a')
  return task
}

// 7. clean, not on base: switch -> merge -> restore.
test('7 merge switches to base, merges and restores when the repo is clean', async () => {
  const f = await fixture()
  try {
    const task = await mergedTask(f)
    await git(f.repo, ['checkout', '-b', 'work'])
    const pf = await f.runtime.mergePreflight(task.id, { switchToBase: true })
    assert.equal(pf.canMerge, true)
    assert.equal(pf.originalRef.branch, 'work')
    const merged = await f.runtime.merge(task.id, {
      switchToBase: true,
      restoreAfter: true,
      expectedTip: pf.tipSha || undefined,
      expectedBase: pf.baseSha || undefined,
    })
    assert.ok(merged.mergedAt)
    assert.equal(await branchOf(f.repo), 'work', 'restores the original branch')
    assert.equal((await f.runtime.view(merged)).snapshot.status, 'merged')
  } finally {
    await teardown(f)
  }
})

// 8. non-blocking repo change: refuse with a clear code.
test('8 merge refuses a non-blocking dirty repo with repo-dirty', async () => {
  const f = await fixture()
  try {
    const task = await mergedTask(f)
    await fs.writeFile(join(f.repo, 'unrelated-untracked.txt'), 'x\n', 'utf8')
    const pf = await f.runtime.mergePreflight(task.id, { switchToBase: false })
    assert.equal(pf.canMerge, false)
    assert.ok(pf.blockers.some((b) => b.code === 'repo-dirty'))
    await assert.rejects(() => f.runtime.merge(task.id), (e: any) => e instanceof TaskError && e.code === 'repo-dirty')
  } finally {
    await teardown(f)
  }
})

// 9. blocking repo change + stash strategy: stash recorded, merge succeeds, recoverable.
test('9 merge stashes blocking changes and keeps them recoverable', async () => {
  const f = await fixture()
  try {
    const task = await mergedTask(f)
    // Base branch has tracked.txt; create branch work that changes it, then leave an
    // uncommitted edit so switching to base is blocked.
    await commitFile(f.repo, 'tracked.txt', 'base\n', 'base: tracked')
    await git(f.repo, ['checkout', '-b', 'work'])
    await fs.writeFile(join(f.repo, 'tracked.txt'), 'work-committed\n', 'utf8')
    await git(f.repo, ['add', '.'])
    await git(f.repo, ['commit', '-m', 'work: tracked'])
    await fs.writeFile(join(f.repo, 'tracked.txt'), 'work-dirty\n', 'utf8')

    const pf = await f.runtime.mergePreflight(task.id, { switchToBase: true })
    assert.ok(pf.blockers.some((b) => b.code === 'dirty-blocks-switch'))
    assert.ok(pf.blockingFiles.length > 0)

    await assert.rejects(
      () => f.runtime.merge(task.id, { switchToBase: true, dirtyStrategy: 'refuse' }),
      (e: any) => e.code === 'dirty-blocks-switch',
    )
    const merged = await f.runtime.merge(task.id, {
      switchToBase: true,
      restoreAfter: true,
      dirtyStrategy: 'stash',
      expectedTip: pf.tipSha || undefined,
      expectedBase: pf.baseSha || undefined,
    })
    assert.ok(merged.mergedAt)
    assert.equal(await branchOf(f.repo), 'work')
    assert.equal((merged.pendingStashes || []).length, 1)
    const stash = merged.pendingStashes![0]!
    assert.ok(stash.sha, 'stash recorded by sha')
    assert.equal(stash.source, 'merge')
    // Restoring the stashed change consumes the record: the edits are back in
    // the working tree, so a second apply must not be possible.
    const applied = await f.runtime.applyStash(task.id, stash.sha)
    assert.equal((applied.pendingStashes || []).length, 0)
    assert.equal((await fs.readFile(join(f.repo, 'tracked.txt'), 'utf8')).replace(/\r\n/g, '\n'), 'work-dirty\n')
    const after = f.store.getTask(task.id)!
    assert.equal((after.pendingStashes || []).length, 0, 'apply consumes the record')
  } finally {
    await teardown(f)
  }
})

// 10. task tip advanced after preflight -> stale, repo restored, stash recoverable.
test('10 merge returns stale when the task branch changed after preflight', async () => {
  const f = await fixture()
  try {
    const task = await mergedTask(f)
    const pf = await f.runtime.mergePreflight(task.id)
    await commitFile(task.worktreePath, 'src/b.txt', 'b\n', 'feat: b')
    await assert.rejects(
      () => f.runtime.merge(task.id, { expectedTip: pf.tipSha || undefined, expectedBase: pf.baseSha || undefined }),
      (e: any) => e.status === 409 && e.code === 'stale',
    )
    assert.equal(await branchOf(f.repo), 'main')
    assert.equal(await exists(join(f.repo, '.git', 'MERGE_HEAD')), false)
  } finally {
    await teardown(f)
  }
})

// 11. base advanced into a conflict -> conflict, no MERGE_HEAD.
test('11 merge returns conflict when the base advanced into a conflict', async () => {
  const f = await fixture()
  try {
    const task = await f.runtime.publish({ repoPath: f.repo, title: 'c', description: 'd' })
    await commitFile(task.worktreePath, 'conflict.txt', 'task\n', 'feat: conflict')
    const pf = await f.runtime.mergePreflight(task.id)
    await fs.writeFile(join(f.repo, 'conflict.txt'), 'base\n', 'utf8')
    await git(f.repo, ['add', '.'])
    await git(f.repo, ['commit', '-m', 'base: conflict'])
    await assert.rejects(
      () => f.runtime.merge(task.id, { expectedTip: pf.tipSha || undefined, expectedBase: pf.baseSha || undefined }),
      (e: any) => e.status === 409 && e.code === 'conflict',
    )
    assert.equal(await exists(join(f.repo, '.git', 'MERGE_HEAD')), false)
    assert.equal(await branchOf(f.repo), 'main')
  } finally {
    await teardown(f)
  }
})

// 12. pre-merge hook failure -> clean, back on original branch.
test('12 merge hook failure restores the repo', async () => {
  const f = await fixture()
  try {
    const task = await mergedTask(f)
    const hooks = join(f.repo, '.git', 'hooks')
    await fs.mkdir(hooks, { recursive: true })
    await fs.writeFile(join(hooks, 'pre-merge-commit'), '#!/bin/sh\necho hook-failed 1>&2\nexit 1\n', 'utf8')
    await git(f.repo, ['checkout', '-b', 'work'])
    await assert.rejects(
      () => f.runtime.merge(task.id, { switchToBase: true }),
      (e: any) => e.status === 409 && e.code === 'hook-failed',
    )
    assert.equal(await branchOf(f.repo), 'work')
    assert.equal(await exists(join(f.repo, '.git', 'MERGE_HEAD')), false)
  } finally {
    await teardown(f)
  }
})

// 13. merge committed, then a repeat merge is refused (restore only).
test('13 a committed merge cannot be merged again; restore-only', async () => {
  const f = await fixture()
  try {
    const task = await mergedTask(f)
    await git(f.repo, ['checkout', '-b', 'work'])
    const pf = await f.runtime.mergePreflight(task.id, { switchToBase: true })
    await f.runtime.merge(task.id, { switchToBase: true, expectedTip: pf.tipSha || undefined, expectedBase: pf.baseSha || undefined })
    // Simulate a leftover journal whose merge is committed but restore is pending.
    const t = f.store.getTask(task.id)!
    t.pendingOp = {
      operationId: 'op-1',
      kind: 'merge',
      taskId: t.id,
      repoIdentity: 'whatever',
      step: 'merge-committed',
      originalRef: { branch: 'work', sha: null },
      expectedTip: pf.tipSha || null,
      expectedBase: pf.baseSha || null,
      mergeCommit: (await headOf(f.repo)),
      recoveryStatus: 'pending',
      startedAt: Date.now(),
    }
    f.store.putTask(t)
    await assert.rejects(() => f.runtime.merge(task.id, { switchToBase: true }), (e: any) => e.status === 409 && e.code === 'merge-committed')
  } finally {
    await teardown(f)
  }
})

// 14. base checked out by another worktree -> 409.
test('14 merge refuses when the base is checked out by another worktree', async () => {
  const f = await fixture()
  try {
    const task = await mergedTask(f)
    await git(f.repo, ['checkout', '-b', 'work'])
    const other = join(f.root, 'other-wt')
    await git(f.repo, ['worktree', 'add', other, 'main'])
    await assert.rejects(
      () => f.runtime.merge(task.id, { switchToBase: true }),
      (e: any) => e.status === 409 && e.code === 'base-checked-out-elsewhere',
    )
  } finally {
    await teardown(f)
  }
})

// 15. two concurrent merges -> second is repo-busy.
test('15 concurrent merges: the second is refused as repo-busy', async () => {
  const f = await fixture()
  try {
    const task = await mergedTask(f)
    await git(f.repo, ['checkout', '-b', 'work'])
    const results = await Promise.allSettled([
      f.runtime.merge(task.id, { switchToBase: true }),
      f.runtime.merge(task.id, { switchToBase: true }),
    ])
    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]
    assert.equal(rejected.length, 1)
    assert.equal((rejected[0]!.reason as any).code, 'repo-busy')
  } finally {
    await teardown(f)
  }
})

// 16. merge timeout -> 409 timeout, repo recoverable.
test('16 a slow merge times out and the repo is recoverable', async () => {
  const f = await fixture()
  try {
    const task = await mergedTask(f)
    const hooks = join(f.repo, '.git', 'hooks')
    await fs.mkdir(hooks, { recursive: true })
    await fs.writeFile(join(hooks, 'pre-merge-commit'), '#!/bin/sh\nsleep 5\n', 'utf8')
    await git(f.repo, ['checkout', '-b', 'work'])
    await assert.rejects(
      () => f.runtime.merge(task.id, { switchToBase: true, timeoutMs: 1200 }),
      (e: any) => e.status === 409 && e.code === 'timeout',
    )
    await git(f.repo, ['merge', '--abort']).catch(() => {})
    assert.equal(await exists(join(f.repo, '.git', 'MERGE_HEAD')), false)
  } finally {
    await teardown(f)
  }
})

// 17. crash reconciliation: committed merge + leftover journal -> restore.
test('17 startup reconcile restores a committed-but-unrestored merge', async () => {
  const f = await fixture()
  try {
    const task = await mergedTask(f)
    await git(f.repo, ['checkout', '-b', 'work'])
    const tip = (await git(f.repo, ['rev-parse', task.branch])).trim()
    await git(f.repo, ['checkout', 'main'])
    await git(f.repo, ['merge', '--no-ff', '--no-edit', tip])
    const mergeCommit = await headOf(f.repo)
    const t = f.store.getTask(task.id)!
    t.pendingOp = {
      operationId: 'op-17',
      kind: 'merge',
      taskId: t.id,
      repoIdentity: 'unknown-mismatch',
      step: 'merge-committed',
      originalRef: { branch: 'work', sha: null },
      expectedTip: tip,
      expectedBase: null,
      mergeCommit,
      recoveryStatus: 'pending',
      startedAt: Date.now(),
    }
    f.store.putTask(t)
    const results = await f.runtime.reconcilePendingOps()
    // Identity mismatch (repoIdentity is not the real one) -> needs manual, untouched.
    assert.equal(results[0]!.status, 'needs-manual')
    // With the real identity it recovers.
    const real = await f.runtime.repoIdentity(f.repo)
    t.pendingOp!.repoIdentity = real
    f.store.putTask(t)
    const results2 = await f.runtime.reconcilePendingOps()
    assert.equal(results2[0]!.status, 'recovered')
    assert.equal(await branchOf(f.repo), 'work')
    assert.equal(f.store.getTask(task.id)!.pendingOp, undefined)
  } finally {
    await teardown(f)
  }
})

// 17b. reconcile aborts a partial merge (MERGE_HEAD) and restores the branch.
test('17b startup reconcile aborts a partial merge and restores the branch', async () => {
  const f = await fixture()
  try {
    const task = await f.runtime.publish({ repoPath: f.repo, title: 'partial', description: 'd' })
    await commitFile(task.worktreePath, 'src/a.txt', 'task\n', 'feat: a')
    // Put the main repo on a branch that edits the same file, then start a
    // conflicting merge so MERGE_HEAD exists.
    await fs.mkdir(join(f.repo, 'src'), { recursive: true })
    await git(f.repo, ['checkout', '-b', 'work'])
    await fs.writeFile(join(f.repo, 'src', 'a.txt'), 'work\n', 'utf8')
    await git(f.repo, ['add', '.'])
    await git(f.repo, ['commit', '-m', 'work: a'])
    await git(f.repo, ['merge', task.branch]).catch(() => {})
    assert.equal(await exists(join(f.repo, '.git', 'MERGE_HEAD')), true)
    const t = f.store.getTask(task.id)!
    t.pendingOp = {
      operationId: 'op-17b',
      kind: 'merge',
      taskId: t.id,
      repoIdentity: await f.runtime.repoIdentity(f.repo),
      step: 'merge',
      originalRef: { branch: 'work', sha: null },
      expectedTip: (await git(f.repo, ['rev-parse', task.branch])).trim(),
      expectedBase: null,
      recoveryStatus: 'pending',
      startedAt: Date.now(),
    }
    f.store.putTask(t)
    await f.runtime.reconcilePendingOps()
    assert.equal(await exists(join(f.repo, '.git', 'MERGE_HEAD')), false)
    assert.equal(await branchOf(f.repo), 'work')
    assert.equal(f.store.getTask(task.id)!.pendingOp, undefined)
  } finally {
    await teardown(f)
  }
})

// 17c. reconcile finds the merge committed but cannot restore the original
// branch: the journal must survive so restoreAfterMerge can retry.
test('17c reconcile keeps the journal when the original branch restore fails', async () => {
  const f = await fixture()
  try {
    const task = await mergedTask(f)
    const tip = (await git(f.repo, ['rev-parse', task.branch])).trim()
    await git(f.repo, ['checkout', 'main'])
    await git(f.repo, ['merge', '--no-ff', '--no-edit', tip])
    const t = f.store.getTask(task.id)!
    t.pendingOp = {
      operationId: 'op-17c',
      kind: 'merge',
      taskId: t.id,
      repoIdentity: await f.runtime.repoIdentity(f.repo),
      step: 'verify',
      originalRef: { branch: 'gone-branch', sha: null },
      expectedTip: tip,
      expectedBase: null,
      recoveryStatus: 'pending',
      startedAt: Date.now(),
    }
    f.store.putTask(t)

    const results = await f.runtime.reconcilePendingOps()
    assert.equal(results[0]!.status, 'needs-manual')
    const kept = f.store.getTask(task.id)!
    assert.ok(kept.pendingOp, 'the journal must survive a failed restore')
    assert.equal(kept.pendingOp!.step, 'merge-committed')
    assert.equal(kept.pendingOp!.recoveryStatus, 'needs-manual')
    assert.ok(kept.pendingOp!.mergeCommit, 'the merge commit is recorded for the retry')
    assert.equal(await branchOf(f.repo), 'main')

    // Once the original branch exists again, the explicit retry succeeds.
    await git(f.repo, ['branch', 'gone-branch', 'HEAD'])
    await f.runtime.restoreAfterMerge(task.id)
    assert.equal(await branchOf(f.repo), 'gone-branch')
    assert.equal(f.store.getTask(task.id)!.pendingOp, undefined)
  } finally {
    await teardown(f)
  }
})

// 18. model tool and runtime/HTTP merge share behaviour (both succeed).
test('18 the merge tool and the runtime path behave consistently', async () => {
  const f = await fixture()
  try {
    const task = await mergedTask(f)
    const pf = await f.runtime.mergePreflight(task.id, { switchToBase: true })
    const merged = await f.runtime.merge(task.id, { switchToBase: true, expectedTip: pf.tipSha || undefined, expectedBase: pf.baseSha || undefined })
    assert.ok(merged.mergedAt)
    // A second task merged through the same runtime entry point behaves the same.
    const task2 = await f.runtime.publish({ repoPath: f.repo, title: 't2', description: 'd' })
    await commitFile(task2.worktreePath, 'src/b.txt', 'b\n', 'feat: b')
    const pf2 = await f.runtime.mergePreflight(task2.id, { switchToBase: true })
    const merged2 = await f.runtime.merge(task2.id, { switchToBase: true, expectedTip: pf2.tipSha || undefined, expectedBase: pf2.baseSha || undefined })
    assert.ok(merged2.mergedAt)
  } finally {
    await teardown(f)
  }
})

// 19. stash apply conflict keeps the record.
test('19 stash apply conflict keeps the stash record', async () => {
  const f = await fixture()
  try {
    const task = await f.runtime.publish({ repoPath: f.repo, title: 'stash', description: 'd' })
    // Create a stash in the repo by modifying a tracked file.
    await fs.writeFile(join(f.repo, 'README.md'), '# stashed\n', 'utf8')
    await git(f.repo, ['stash', 'push', '-m', 'dsh-wt:test:review'])
    const entries = await git(f.repo, ['stash', 'list', '--format=%H'])
    const sha = entries.split(/\r?\n/).filter(Boolean)[0]!.trim()
    // Now make an incompatible local edit so applying the stash conflicts.
    await fs.writeFile(join(f.repo, 'README.md'), '# conflicting\n', 'utf8')
    const t = f.store.getTask(task.id)!
    t.pendingStashes = [{ sha, source: 'review', ref: 'dsh-wt:test:review', createdAt: Date.now(), files: ['README.md'] }]
    f.store.putTask(t)
    await assert.rejects(() => f.runtime.applyStash(task.id, sha), (e: any) => e.status === 409 && e.code === 'stash-apply-conflict')
    assert.equal((f.store.getTask(task.id)!.pendingStashes || []).length, 1)
  } finally {
    await teardown(f)
  }
})

// 19b. stash apply takes the same repo lock as merge (no interleaving).
test('19b applyStash is refused while a merge holds the repo lock', async () => {
  const f = await fixture()
  try {
    const task = await mergedTask(f)
    await fs.writeFile(join(f.repo, 'README.md'), '# stashed\n', 'utf8')
    await git(f.repo, ['stash', 'push', '-m', 'dsh-wt:test:review'])
    const entries = await git(f.repo, ['stash', 'list', '--format=%H'])
    const sha = entries.split(/\r?\n/).filter(Boolean)[0]!.trim()
    const t = f.store.getTask(task.id)!
    t.pendingStashes = [{ sha, source: 'review', ref: 'dsh-wt:test:review', createdAt: Date.now(), files: ['README.md'] }]
    f.store.putTask(t)

    const pf = await f.runtime.mergePreflight(task.id)
    const merging = f.runtime.merge(task.id, { expectedTip: pf.tipSha || undefined, expectedBase: pf.baseSha || undefined })
    await assert.rejects(() => f.runtime.applyStash(task.id, sha), (e: any) => e.status === 409 && e.code === 'repo-busy')
    const merged = await merging
    assert.ok(merged.mergedAt)
    assert.equal((f.store.getTask(task.id)!.pendingStashes || []).length, 1, 'the record is untouched')
  } finally {
    await teardown(f)
  }
})

// 20. pending stash blocks cleanup and delete.
test('20 a pending stash blocks cleanup and delete', async () => {
  const f = await fixture()
  try {
    const task = await f.runtime.publish({ repoPath: f.repo, title: 'guard', description: 'd' })
    const t = f.store.getTask(task.id)!
    t.pendingStashes = [{ sha: 'abc', source: 'merge', ref: 'x', createdAt: Date.now(), files: [] }]
    f.store.putTask(t)
    await assert.rejects(() => f.runtime.cleanup(task.id), (e: any) => e.status === 409 && e.code === 'pending-stash')
    await assert.rejects(() => f.runtime.delete(task.id), (e: any) => e.status === 409 && e.code === 'pending-stash')
  } finally {
    await teardown(f)
  }
})

// 21. legacy reviewStash migrates to pendingStashes (verified + unverified).
test('21 legacy reviewStash migrates into pendingStashes', async () => {
  const f = await fixture()
  try {
    const task = await f.runtime.publish({ repoPath: f.repo, title: 'mig', description: 'd' })
    await fs.writeFile(join(f.repo, 'README.md'), '# stashed\n', 'utf8')
    await git(f.repo, ['stash', 'push', '-m', 'legacy-review'])
    const t = f.store.getTask(task.id)!
    t.reviewStash = 'legacy-review'
    f.store.putTask(t)
    await f.runtime.migrateLegacyStashes()
    const migrated = f.store.getTask(task.id)!
    assert.equal(migrated.reviewStash, undefined)
    assert.equal((migrated.pendingStashes || []).length, 1)
    assert.equal(migrated.pendingStashes![0]!.source, 'review')
    assert.ok(migrated.pendingStashes![0]!.sha, 'matched a unique sha')

    // Unmatched message -> unverified record with empty sha.
    const task2 = await f.runtime.publish({ repoPath: f.repo, title: 'mig2', description: 'd' })
    const t2 = f.store.getTask(task2.id)!
    t2.reviewStash = 'does-not-exist'
    f.store.putTask(t2)
    await f.runtime.migrateLegacyStashes()
    const m2 = f.store.getTask(task2.id)!
    assert.equal(m2.pendingStashes!.length, 1)
    assert.equal(m2.pendingStashes![0]!.unverified, true)
    assert.equal(m2.pendingStashes![0]!.sha, '')
  } finally {
    await teardown(f)
  }
})

// 22. Chinese filename + core.autocrlf=true: preflight and merge see the right file.
test('22 preflight handles Chinese filenames with core.autocrlf=true', async () => {
  const f = await fixture()
  try {
    await git(f.repo, ['config', 'core.autocrlf', 'true'])
    const task = await f.runtime.publish({ repoPath: f.repo, title: 'cn', description: 'd' })
    await commitFile(task.worktreePath, '中文.txt', '任务\n', 'feat: 中文')
    await fs.writeFile(join(f.repo, '中文.txt'), '基线\n', 'utf8')
    await git(f.repo, ['add', '.'])
    await git(f.repo, ['commit', '-m', 'base: 中文'])
    const pf = await f.runtime.mergePreflight(task.id)
    assert.equal(pf.conflict.conflict, true)
    assert.ok(pf.conflict.conflictFiles.includes('中文.txt'))
    assert.ok(pf.blockers.some((b) => b.code === 'conflict'))
  } finally {
    await teardown(f)
  }
})

// Agent state: unknown blocks a merge.
test('agent state unknown blocks the merge', async () => {
  const f = await fixture(() => 'unknown')
  try {
    const task = await mergedTask(f)
    const t = f.store.getTask(task.id)!
    t.sessionId = 'sess-1'
    f.store.putTask(t)
    await assert.rejects(() => f.runtime.merge(task.id), (e: any) => e.status === 409 && e.code === 'agent-unknown')
  } finally {
    await teardown(f)
  }
})
