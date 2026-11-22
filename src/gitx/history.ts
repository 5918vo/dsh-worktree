/**
 * Commit history, revision resolution, and working-tree status helpers.
 */

import { tryRun } from './exec.js'

export interface CommitLine {
  hash: string
  subject: string
}

export async function logOneline(gitPath: string, dir: string, range: string, limit = 30): Promise<CommitLine[]> {
  const r = await tryRun(gitPath, dir, ['log', '--oneline', '--no-decorate', `-n`, String(limit), range])
  if (!r) return []
  const out: CommitLine[] = []
  for (const line of r.stdout.split('\n')) {
    if (!line.trim()) continue
    const sp = line.indexOf(' ')
    if (sp <= 0) continue
    out.push({ hash: line.slice(0, sp), subject: line.slice(sp + 1) })
  }
  return out
}

export async function countCommits(gitPath: string, dir: string, range: string): Promise<number> {
  const r = await tryRun(gitPath, dir, ['rev-list', '--count', range])
  const n = Number.parseInt((r?.stdout ?? '0').trim(), 10)
  return Number.isFinite(n) ? n : 0
}

export async function lastCommitTime(gitPath: string, dir: string, ref = 'HEAD'): Promise<number | null> {
  const r = await tryRun(gitPath, dir, ['log', '-1', '--format=%ct', ref])
  const n = Number.parseInt((r?.stdout ?? '').trim(), 10)
  return Number.isFinite(n) && n > 0 ? n * 1000 : null
}

export async function isAncestor(gitPath: string, dir: string, ancestor: string, descendant: string): Promise<boolean> {
  const r = await tryRun(gitPath, dir, ['merge-base', '--is-ancestor', ancestor, descendant])
  return !!r // exit 0 = ancestor; nonzero (killed by tryRun) = not
}

export async function sameCommit(gitPath: string, dir: string, a: string, b: string): Promise<boolean> {
  const [ra, rb] = await Promise.all([
    tryRun(gitPath, dir, ['rev-parse', '--verify', '--quiet', a]),
    tryRun(gitPath, dir, ['rev-parse', '--verify', '--quiet', b]),
  ])
  if (!ra || !rb) return false
  return ra.stdout.trim() === rb.stdout.trim()
}

/** Commit timestamp in seconds, or null when the revision does not resolve. */
export async function commitTime(gitPath: string, dir: string, rev: string): Promise<number | null> {
  const result = await tryRun(gitPath, dir, ['show', '-s', '--format=%ct', rev])
  if (!result) return null
  const seconds = Number(result.stdout.trim())
  return Number.isFinite(seconds) ? seconds : null
}

export async function revParse(gitPath: string, dir: string, rev: string): Promise<string | null> {
  const result = await tryRun(gitPath, dir, ['rev-parse', '--verify', '--quiet', rev])
  const value = result ? result.stdout.trim() : ''
  return value || null
}

export async function mergeBase(gitPath: string, dir: string, a: string, b: string): Promise<string | null> {
  const result = await tryRun(gitPath, dir, ['merge-base', a, b])
  const value = result ? result.stdout.trim() : ''
  return value || null
}

/** All tracked paths in a revision (used to detect untracked-file overwrite). */
export async function lsTreePaths(gitPath: string, dir: string, rev: string): Promise<Set<string>> {
  const result = await tryRun(gitPath, dir, ['ls-tree', '-r', '--name-only', '-z', rev])
  if (!result) return new Set()
  return new Set(result.stdout.split('\0').filter(Boolean))
}

export async function isDirty(gitPath: string, dir: string, includeUntracked = true): Promise<number> {
  const args = ['status', '--porcelain']
  if (!includeUntracked) args.push('--untracked-files=no')
  const r = await tryRun(gitPath, dir, args)
  if (!r) return 0
  return r.stdout.split('\n').filter((l) => l.trim().length > 0).length
}

export interface StatusEntry {
  /** Repo-relative path (rename/copy: the new path). */
  path: string
  /** Two-letter porcelain status, e.g. " M", "??", "A ". */
  status: string
  untracked: boolean
}

/**
 * Working-tree entries from `git status --porcelain=v1 -z`.
 * Ignored files never appear; `--untracked-files=all` lists every untracked file.
 */
export async function statusEntries(gitPath: string, dir: string, includeUntracked = true): Promise<StatusEntry[]> {
  const args = ['status', '--porcelain=v1', '-z']
  args.push(includeUntracked ? '--untracked-files=all' : '--untracked-files=no')
  const result = await tryRun(gitPath, dir, args)
  if (!result) return []
  const parts = result.stdout.split('\0')
  const out: StatusEntry[] = []
  for (let i = 0; i < parts.length; i += 1) {
    const entry = parts[i]
    if (!entry) continue
    const status = entry.slice(0, 2)
    let path = entry.slice(3)
    if (status[0] === 'R' || status[0] === 'C') {
      // Rename/copy carries the original path in the next NUL field.
      const original = parts[i + 1]
      if (original) { i += 1; if (!path) path = original }
    }
    if (path) out.push({ path, status, untracked: status[0] === '?' })
  }
  return out
}

/** Repo-relative paths of files git does not track (respecting .gitignore). */
export async function listUntracked(gitPath: string, dir: string): Promise<string[]> {
  const r = await tryRun(gitPath, dir, ['ls-files', '--others', '--exclude-standard', '-z'])
  if (!r) return []
  return r.stdout.split('\0').filter((path) => path.length > 0)
}

/** Repo-relative paths of changed files reported by `git status --porcelain`. */
export async function dirtyFiles(gitPath: string, dir: string, includeUntracked = true): Promise<string[]> {
  const args = ['status', '--porcelain']
  if (!includeUntracked) args.push('--untracked-files=no')
  const r = await tryRun(gitPath, dir, args)
  if (!r) return []
  const out: string[] = []
  for (const line of r.stdout.split('\n')) {
    if (!line.trim()) continue
    // "XY path" or "XY old -> new" (rename); strip the status prefix.
    let p = line.slice(3).trim()
    const arrow = p.indexOf(' -> ')
    if (arrow >= 0) p = p.slice(arrow + 4)
    p = p.replace(/^"(.*)"$/, '$1')
    if (p) out.push(p)
  }
  return out
}
