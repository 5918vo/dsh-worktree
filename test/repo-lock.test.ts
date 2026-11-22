import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { acquireRepoLock, RepoLockBusyError } from '../src/repo-lock.js'
import { withRepoLock } from '../src/runtime/types.js'
import { TaskError } from '../src/runtime.js'
import { mkTempDir, rmrf } from './helpers/git.js'

async function lockDir(): Promise<string> {
  return mkTempDir('dshw-lock-')
}

test('one repo lock is exclusive and releases for the next holder', async () => {
  const dir = await lockDir()
  try {
    const first = acquireRepoLock(dir, 'repo-1', '合并')
    assert.throws(
      () => acquireRepoLock(dir, 'repo-1', '清理'),
      (error: any) => error instanceof RepoLockBusyError && error.label === '合并',
    )
    first.release()
    const second = acquireRepoLock(dir, 'repo-1', '清理')
    second.release()
  } finally {
    await rmrf(dir)
  }
})

test('different repos use different lock files', async () => {
  const dir = await lockDir()
  try {
    const a = acquireRepoLock(dir, 'repo-a', '合并')
    const b = acquireRepoLock(dir, 'repo-b', '清理')
    assert.notEqual(a.file, b.file)
    a.release()
    b.release()
  } finally {
    await rmrf(dir)
  }
})

test('a lock left by a dead process is reclaimed', async () => {
  const dir = await lockDir()
  try {
    const dead = acquireRepoLock(dir, 'repo-1', '合并', { pid: 2147483647 })
    const next = acquireRepoLock(dir, 'repo-1', '清理')
    // The dead holder's late release must not remove the new lock.
    dead.release()
    await fs.stat(next.file)
    next.release()
    await assert.rejects(fs.stat(next.file), /ENOENT/)
  } finally {
    await rmrf(dir)
  }
})

test('an over-age lock is reclaimed and its old release cannot delete the replacement', async () => {
  const dir = await lockDir()
  try {
    const old = acquireRepoLock(dir, 'repo-1', '合并', { now: () => 1_000, staleMs: 100 })
    const next = acquireRepoLock(dir, 'repo-1', '清理', { now: () => 1_101, staleMs: 100 })
    await fs.stat(next.file)
    old.release()
    await fs.stat(next.file) // token mismatch: still the new holder's file
    next.release()
    await assert.rejects(fs.stat(next.file), /ENOENT/)
  } finally {
    await rmrf(dir)
  }
})

test('withRepoLock rejects a second process and frees the repo afterwards', async () => {
  const dir = await lockDir()
  const repo = await mkTempDir('dshw-repo-')
  const ctx = (): any => ({ gitPath: 'git', gitOps: new Map(), repoLockDir: dir })
  try {
    let release!: () => void
    let enter!: () => void
    const entered = new Promise<void>((resolve) => { enter = resolve })
    const first = withRepoLock(ctx(), repo, '合并', () => {
      enter()
      return new Promise<void>((resolve) => { release = resolve })
    })
    await entered
    await assert.rejects(
      withRepoLock(ctx(), repo, '清理', async () => 'never'),
      (error: any) => error instanceof TaskError && error.status === 409 && error.code === 'repo-busy',
    )
    release()
    await first
    assert.equal(await withRepoLock(ctx(), repo, '清理', async () => 'ok'), 'ok')
  } finally {
    await rmrf(dir)
    await rmrf(repo)
  }
})
