/**
 * Repository metadata, branches, worktrees, and working-tree checkout helpers.
 */

import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import { GitError, GIT_OP_TIMEOUT_MS, run, tryRun } from './exec.js'

export async function isRepo(gitPath: string, dir: string): Promise<boolean> {
  const r = await tryRun(gitPath, dir, ['rev-parse', '--is-inside-work-tree'])
  return r?.stdout.trim() === 'true'
}

export async function isGitDir(gitPath: string, dir: string): Promise<boolean> {
  const r = await tryRun(gitPath, dir, ['rev-parse', '--is-inside-git-dir'])
  return r?.stdout.trim() === 'true'
}

export async function repoTopLevel(gitPath: string, dir: string): Promise<string | null> {
  const r = await tryRun(gitPath, dir, ['rev-parse', '--show-toplevel'])
  const out = r?.stdout.trim()
  return out ? out : null
}

/** Path of the shared .git directory (same for every linked worktree). */
export async function gitCommonDir(gitPath: string, dir: string): Promise<string | null> {
  const r = await tryRun(gitPath, dir, ['rev-parse', '--path-format=absolute', '--git-common-dir'])
  const out = r?.stdout.trim()
  return out ? out : null
}

/** Absolute path of this working tree's git dir (correct for linked worktrees). */
export async function absoluteGitDir(gitPath: string, dir: string): Promise<string | null> {
  const r = await tryRun(gitPath, dir, ['rev-parse', '--absolute-git-dir'])
  const out = r?.stdout.trim()
  return out ? out : null
}

export type InProgressKind = 'merge' | 'rebase' | 'cherry-pick' | 'revert'

/** Detect an unfinished multi-step git operation (merge/rebase/cherry-pick/revert). */
export async function inProgress(gitPath: string, dir: string): Promise<InProgressKind | null> {
  const gd = await absoluteGitDir(gitPath, dir)
  if (!gd) return null
  const has = async (name: string) => fs.stat(join(gd, name)).then(() => true).catch(() => false)
  if (await has('MERGE_HEAD')) return 'merge'
  if ((await has('rebase-merge')) || (await has('rebase-apply'))) return 'rebase'
  if (await has('CHERRY_PICK_HEAD')) return 'cherry-pick'
  if (await has('REVERT_HEAD')) return 'revert'
  return null
}

/**
 * Idempotently add `/<dirName>/` to the repo's local exclude file
 * (.git/info/exclude via git-common-dir, so it works from any linked
 * worktree and never touches tracked files).
 */
export async function ensureExclude(gitPath: string, dir: string, dirName: string): Promise<void> {
  const common = await gitCommonDir(gitPath, dir)
  if (!common) return
  const file = join(common, 'info', 'exclude')
  const entry = `/${dirName}/`
  let text = ''
  try {
    text = await fs.readFile(file, 'utf8')
  } catch {
    text = ''
  }
  const already = text.split('\n').some((l) => l.trim() === entry)
  if (already) return
  const sep = text.length > 0 && !text.endsWith('\n') ? '\n' : ''
  await fs.mkdir(dirname(file), { recursive: true })
  await fs.writeFile(file, `${text}${sep}# added by dsh-deepseek-worktree\n${entry}\n`, 'utf8')
}

export async function currentBranch(gitPath: string, dir: string): Promise<string | null> {
  const r = await tryRun(gitPath, dir, ['branch', '--show-current'])
  const out = r?.stdout.trim()
  return out ? out : null // empty stdout = detached HEAD
}

export async function branchExists(gitPath: string, dir: string, branch: string): Promise<boolean> {
  const r = await tryRun(gitPath, dir, ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`])
  return !!r && r.stdout.trim().length > 0
}

export interface BranchInfo {
  name: string
  current: boolean
}

export async function listBranches(gitPath: string, dir: string): Promise<{ branches: BranchInfo[]; current: string | null; default: string | null }> {
  const r = await tryRun(gitPath, dir, ['branch', `--format=%(refname:short)\t%(HEAD)`])
  if (!r) return { branches: [], current: null, default: null }
  const branches: BranchInfo[] = []
  let current: string | null = null
  for (const line of r.stdout.split('\n')) {
    if (!line.trim()) continue
    const [name, head] = line.split('\t')
    if (!name) continue
    const isCurrent = (head || '').trim() === '*'
    branches.push({ name, current: isCurrent })
    if (isCurrent) current = name
  }
  const fallback =
    branches.find((b) => b.name === 'main')?.name ??
    branches.find((b) => b.name === 'master')?.name ??
    branches[0]?.name ??
    null
  // Prefer origin/HEAD when available; fall back to main/master.
  const sym = await tryRun(gitPath, dir, ['symbolic-ref', '-q', '--short', 'refs/remotes/origin/HEAD'])
  const remoteDefault = sym?.stdout.trim().replace(/^origin\//, '') ?? null
  return { branches, current, default: remoteDefault && branches.some((b) => b.name === remoteDefault) ? remoteDefault : fallback }
}

export async function uniqueBranchName(gitPath: string, dir: string, want: string): Promise<string> {
  let name = want
  for (let i = 2; await branchExists(gitPath, dir, name); i += 1) {
    name = `${want}-${i}`
    if (i > 200) throw new Error(`cannot find a free branch name similar to ${want}`)
  }
  return name
}

export async function removeBranch(gitPath: string, repoDir: string, branch: string, force: boolean): Promise<void> {
  await run(gitPath, repoDir, ['branch', force ? '-D' : '-d', branch])
}

export async function worktreeAdd(gitPath: string, repoDir: string, worktreePath: string, newBranch: string, baseBranch: string, timeoutMs = GIT_OP_TIMEOUT_MS): Promise<void> {
  await run(gitPath, repoDir, ['worktree', 'add', '-b', newBranch, worktreePath, baseBranch], timeoutMs)
}

export async function worktreeRemove(gitPath: string, repoDir: string, worktreePath: string, force: boolean): Promise<void> {
  const args = ['worktree', 'remove']
  if (force) args.push('--force')
  args.push(worktreePath)
  await run(gitPath, repoDir, args)
}

/** Drop stale administrative data for worktrees whose directory is gone. */
export async function worktreePrune(gitPath: string, repoDir: string): Promise<void> {
  await tryRun(gitPath, repoDir, ['worktree', 'prune'])
}

export interface WorktreeEntry {
  path: string
  head: string | null
  branch: string | null
  bare: boolean
  detached: boolean
}

export async function worktreeList(gitPath: string, repoDir: string): Promise<WorktreeEntry[]> {
  const r = await tryRun(gitPath, repoDir, ['worktree', 'list', '--porcelain'])
  if (!r) return []
  const out: WorktreeEntry[] = []
  let cur: Partial<WorktreeEntry> = {}
  const flush = () => {
    if (cur.path) {
      out.push({
        path: cur.path,
        head: cur.head ?? null,
        branch: cur.branch ?? null,
        bare: cur.bare === true,
        detached: cur.detached === true,
      })
    }
    cur = {}
  }
  for (const line of r.stdout.split('\n')) {
    if (!line.trim()) {
      flush()
      continue
    }
    if (line.startsWith('worktree ')) cur.path = line.slice('worktree '.length)
    else if (line.startsWith('HEAD ')) cur.head = line.slice('HEAD '.length)
    else if (line.startsWith('branch ')) cur.branch = line.slice('branch '.length).replace(/^refs\/heads\//, '')
    else if (line === 'bare') cur.bare = true
    else if (line === 'detached') cur.detached = true
  }
  flush()
  return out
}

/**
 * Switch the repo's checked-out branch. A task branch is checked out by its
 * worktree, so the plain switch fails with "already used by worktree"; retry
 * with --ignore-other-worktrees (review happens with both checkouts alive).
 */
export async function switchBranch(gitPath: string, repoDir: string, branch: string, timeoutMs = GIT_OP_TIMEOUT_MS): Promise<void> {
  try {
    await run(gitPath, repoDir, ['switch', branch], timeoutMs)
  } catch (error) {
    const msg = error instanceof GitError ? error.stderr : String(error)
    if (/used by worktree|already checked out/i.test(msg)) {
      await run(gitPath, repoDir, ['switch', '--ignore-other-worktrees', branch], timeoutMs)
      return
    }
    throw error
  }
}

/** Detached checkout of an exact commit (acceptance review; avoids dual branch checkout). */
export async function checkoutDetach(gitPath: string, repoDir: string, rev: string, timeoutMs = GIT_OP_TIMEOUT_MS): Promise<void> {
  await run(gitPath, repoDir, ['checkout', '--detach', rev], timeoutMs)
}

/** Refresh the index stat cache so CRLF/mtime-only changes are not reported dirty. */
export async function updateIndexRefresh(gitPath: string, repoDir: string): Promise<void> {
  await tryRun(gitPath, repoDir, ['update-index', '-q', '--refresh'])
}

/** Restore paths in the index and working tree to HEAD (discard local changes). */
export async function restorePaths(gitPath: string, dir: string, paths: string[]): Promise<void> {
  if (!paths.length) return
  await run(gitPath, dir, ['restore', '--staged', '--worktree', '--', ...paths], GIT_OP_TIMEOUT_MS)
}
