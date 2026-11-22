/**
 * Cross-process lock for git-mutating work on one main repo.
 *
 * The board already serializes actions inside one DSH process with an in-memory
 * Map, but two DSH instances (different ports or profiles) share the same
 * repos. Git's own index/ref locks only cover individual commands, so a
 * multi-step checkout/merge sequence can still interleave. This lock file lives
 * in the shared store directory and is keyed by the repo's common git dir, so
 * every worktree of a repo competes for the same lock.
 */

import { closeSync, mkdirSync, openSync, readFileSync, rmSync, statSync, writeSync } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { join } from 'node:path'

/**
 * A hung holder older than this is treated as crashed. PID liveness catches
 * normal crashes immediately; the age fallback also clears a lock whose PID was
 * recycled by an unrelated live process.
 */
export const REPO_LOCK_STALE_MS = 6 * 60 * 60 * 1000

export class RepoLockBusyError extends Error {
  readonly label: string

  constructor(label: string) {
    super(`主仓库正在执行「${label}」`)
    this.name = 'RepoLockBusyError'
    this.label = label
  }
}

export interface RepoLockHandle {
  readonly file: string
  readonly token: string
  release(): void
}

export interface AcquireRepoLockOptions {
  /** Clock override for tests. */
  now?: () => number
  /** Owner PID override for tests. */
  pid?: number
  staleMs?: number
}

interface LockInfo {
  pid: number
  token: string
  label: string
  at: number
}

function lockFile(dir: string, identity: string): string {
  const hash = createHash('sha256').update(identity).digest('hex').slice(0, 32)
  return join(dir, hash + '.lock')
}

function readInfo(file: string): LockInfo | null {
  try {
    const value = JSON.parse(readFileSync(file, 'utf8'))
    if (!value || typeof value !== 'object') return null
    const info: LockInfo = {
      pid: Number(value.pid),
      token: String(value.token || ''),
      label: String(value.label || ''),
      at: Number(value.at),
    }
    if (!info.token || !Number.isFinite(info.pid) || !Number.isFinite(info.at)) return null
    return info
  } catch {
    return null
  }
}

function pidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error: any) {
    // EPERM means the process exists but belongs to another user.
    return !!error && error.code === 'EPERM'
  }
}

function isStale(file: string, info: LockInfo | null, now: number, staleMs: number): boolean {
  if (info) {
    if (now - info.at > staleMs) return true
    return !pidAlive(info.pid)
  }
  // Unreadable/partially written lock: only age can decide.
  try {
    return now - statSync(file).mtimeMs > staleMs
  } catch {
    return true
  }
}

/**
 * Acquire the repo lock or throw `RepoLockBusyError`.
 *
 * `O_EXCL` makes creation atomic across processes. A stale file is removed and
 * acquisition retried exactly once; if another process wins that race, this
 * call reports busy instead of waiting (actions are user-triggered and should
 * fail fast with a reason, like the in-process gate).
 */
export function acquireRepoLock(
  dir: string,
  identity: string,
  label: string,
  options: AcquireRepoLockOptions = {},
): RepoLockHandle {
  const now = options.now || Date.now
  const pid = options.pid || process.pid
  const staleMs = options.staleMs === undefined ? REPO_LOCK_STALE_MS : options.staleMs
  const file = lockFile(dir, identity)
  const token = randomUUID()
  mkdirSync(dir, { recursive: true })

  for (let attempt = 0; attempt < 2; attempt++) {
    let fd: number | null = null
    let created = false
    try {
      fd = openSync(file, 'wx')
      created = true
      const info: LockInfo = { pid, token, label, at: now() }
      writeSync(fd, JSON.stringify(info))
      closeSync(fd)
      fd = null
      return { file, token, release: () => releaseRepoLock(file, token) }
    } catch (error: any) {
      if (fd !== null) {
        try {
          closeSync(fd)
        } catch {
          /* already closed */
        }
      }
      if (created) {
        // Do not leave an empty lock behind when the holder could not write it.
        try {
          rmSync(file, { force: true })
        } catch {
          /* the next acquirer clears it as stale */
        }
      }
      if (!error || error.code !== 'EEXIST') throw error
      const existing = readInfo(file)
      if (!isStale(file, existing, now(), staleMs)) {
        throw new RepoLockBusyError((existing && existing.label) || '其他 Git 操作')
      }
      try {
        rmSync(file, { force: true })
      } catch {
        /* another process may have won the race; the retry reports busy */
      }
    }
  }
  throw new RepoLockBusyError('其他 Git 操作')
}

/** Remove the lock only when it still belongs to this holder. */
function releaseRepoLock(file: string, token: string): void {
  try {
    const info = readInfo(file)
    if (!info || info.token !== token) return
    rmSync(file, { force: true })
  } catch {
    /* a failed release leaves a stale lock that the next acquirer clears */
  }
}
