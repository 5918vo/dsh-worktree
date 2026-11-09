/**
 * Thin, Windows-safe git wrapper. All commands run through execFile with an
 * args array (no shell quoting pitfalls) and windowsHide. Every helper takes
 * the git executable and a cwd explicitly so callers can point at either the
 * main repo or a linked worktree.
 */

import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'

export class GitError extends Error {
  readonly args: string[]
  readonly stderr: string
  readonly exitCode: number | null
  /** True when the command was killed because it exceeded its timeout. */
  readonly timedOut: boolean

  constructor(args: string[], stderr: string, exitCode: number | null, timedOut = false) {
    super(`git ${args.join(' ')} failed: ${stderr.trim() || '(no stderr)'}`)
    this.name = 'GitError'
    this.args = args
    this.stderr = stderr
    this.exitCode = exitCode
    this.timedOut = timedOut
  }
}

export interface GitRunResult {
  stdout: string
  stderr: string
}

/** Stable, English, non-interactive git environment (Windows Chinese locales included). */
const GIT_ENV = {
  ...process.env,
  LC_ALL: 'C',
  LANG: 'C',
  LANGUAGE: 'C',
  GIT_TERMINAL_PROMPT: '0',
  GIT_EDITOR: 'true',
  GIT_MERGE_AUTOEDIT: 'no',
}

/** Long lease for git operations that may run user hooks (eslint, etc.). */
export const GIT_OP_TIMEOUT_MS = 10 * 60 * 1000

function run(gitPath: string, cwd: string, args: string[], timeoutMs = 120_000): Promise<GitRunResult> {
  return new Promise((resolve, reject) => {
    // -c core.quotePath=false keeps non-ASCII paths unquoted in every command.
    const execArgs = ['-c', 'core.quotePath=false', ...args]
    execFile(
      gitPath,
      execArgs,
      { cwd, env: GIT_ENV, windowsHide: true, maxBuffer: 16 * 1024 * 1024, timeout: timeoutMs },
      (error, stdout, stderr) => {
        if (error) {
          const code = typeof (error as any).code === 'number' ? (error as any).code : null
          const timedOut = (error as any).killed === true || (error as any).code === 'ETIMEDOUT' || (error as any).signal === 'SIGTERM'
          // git writes merge/checkout diagnostics to stdout as well; without it
          // the UI only ever saw "Command failed".
          const detail = [String(stderr || ''), String(stdout || '')].filter((text) => text.trim()).join('\n')
          reject(new GitError(args, detail || error.message || '', code, timedOut))
          return
        }
        resolve({ stdout: String(stdout ?? ''), stderr: String(stderr ?? '') })
      },
    )
  })
}

/** Like run(), but resolves null on failure instead of rejecting. */
async function tryRun(gitPath: string, cwd: string, args: string[]): Promise<GitRunResult | null> {
  try {
    return await run(gitPath, cwd, args)
  } catch {
    return null
  }
}

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

export async function currentBranch(gitPath: string, dir: string): Promise<string | null> {
  const r = await tryRun(gitPath, dir, ['branch', '--show-current'])
  const out = r?.stdout.trim()
  return out ? out : null // empty stdout = detached HEAD
}

export async function branchExists(gitPath: string, dir: string, branch: string): Promise<boolean> {
  const r = await tryRun(gitPath, dir, ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`])
  return !!r && r.stdout.trim().length > 0
}

export async function isDirty(gitPath: string, dir: string, includeUntracked = true): Promise<number> {
  const args = ['status', '--porcelain']
  if (!includeUntracked) args.push('--untracked-files=no')
  const r = await tryRun(gitPath, dir, args)
  if (!r) return 0
  return r.stdout.split('\n').filter((l) => l.trim().length > 0).length
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

export async function mergeNoFF(gitPath: string, repoDir: string, branch: string, timeoutMs = GIT_OP_TIMEOUT_MS): Promise<void> {
  try {
    await run(gitPath, repoDir, ['merge', '--no-ff', '--no-edit', branch], timeoutMs)
  } catch (error) {
    // Undo a conflicted merge so the repo is not left mid-merge.
    await tryRun(gitPath, repoDir, ['merge', '--abort'])
    throw error
  }
}

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

/** Files changed between two revisions. */
export async function diffNameOnly(gitPath: string, dir: string, from: string, to: string): Promise<string[]> {
  const result = await tryRun(gitPath, dir, ['diff', '--name-only', from, to])
  if (!result) return []
  return result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
}

/** Same as diffNameOnly but NUL-separated (safe for spaces/non-ASCII paths). */
export async function diffNameOnlyZ(gitPath: string, dir: string, from: string, to: string): Promise<string[]> {
  const result = await tryRun(gitPath, dir, ['diff', '--name-only', '-z', from, to])
  if (!result) return []
  return result.stdout.split('\0').filter(Boolean)
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

/** All tracked paths in a revision (used to detect untracked-file overwrite). */
export async function lsTreePaths(gitPath: string, dir: string, rev: string): Promise<Set<string>> {
  const result = await tryRun(gitPath, dir, ['ls-tree', '-r', '--name-only', '-z', rev])
  if (!result) return new Set()
  return new Set(result.stdout.split('\0').filter(Boolean))
}

export async function stashPush(gitPath: string, dir: string, message: string): Promise<void> {
  await run(gitPath, dir, ['stash', 'push', '-u', '-m', message], GIT_OP_TIMEOUT_MS)
}

/** Find a stash entry by exact message; returns its stash@{n} ref. */
async function stashRefForMessage(gitPath: string, dir: string, message: string): Promise<string | null> {
  const result = await tryRun(gitPath, dir, ['stash', 'list', '--format=%gd\t%s'])
  if (!result) return null
  for (const line of result.stdout.split(/\r?\n/)) {
    const tab = line.indexOf('\t')
    if (tab < 0) continue
    if (line.slice(tab + 1) === message) return line.slice(0, tab)
  }
  return null
}

export async function stashApplyByMessage(gitPath: string, dir: string, message: string): Promise<void> {
  const ref = await stashRefForMessage(gitPath, dir, message)
  if (!ref) throw new Error(`stash not found: ${message}`)
  await run(gitPath, dir, ['stash', 'apply', ref], GIT_OP_TIMEOUT_MS)
}

export async function stashDropByMessage(gitPath: string, dir: string, message: string): Promise<void> {
  const ref = await stashRefForMessage(gitPath, dir, message)
  if (!ref) return
  await run(gitPath, dir, ['stash', 'drop', ref], GIT_OP_TIMEOUT_MS)
}

/** Unified patch for a stash entry (used by the "view stash" dialog). */
export async function stashShowByMessage(gitPath: string, dir: string, message: string): Promise<string> {
  const ref = await stashRefForMessage(gitPath, dir, message)
  if (!ref) return ''
  const result = await tryRun(gitPath, dir, ['stash', 'show', '-p', ref])
  return result ? result.stdout : ''
}

export interface StashEntry {
  /** Reflog selector, e.g. stash@{0}. */
  ref: string
  /** Stash commit SHA — stable even as the reflog shifts. */
  sha: string
  message: string
}

/** List stash entries with their stable commit SHAs. */
export async function stashListEntries(gitPath: string, dir: string): Promise<StashEntry[]> {
  const result = await tryRun(gitPath, dir, ['stash', 'list', '--format=%gd%x09%H%x09%s'])
  if (!result) return []
  const out: StashEntry[] = []
  for (const line of result.stdout.split(/\r?\n/)) {
    if (!line.trim()) continue
    const [ref, sha, ...rest] = line.split('\t')
    if (!ref || !sha) continue
    out.push({ ref, sha, message: rest.join('\t') })
  }
  return out
}

/** Find a stash entry by its message; unverified when no unique match exists. */
export async function stashEntryForMessage(gitPath: string, dir: string, message: string): Promise<{ entry: StashEntry | null; unique: boolean }> {
  const matches = (await stashListEntries(gitPath, dir)).filter(
    (entry) => entry.message === message || entry.message.endsWith(': ' + message),
  )
  if (matches.length === 1) return { entry: matches[0], unique: true }
  return { entry: matches.length ? matches[0] : null, unique: false }
}

/** Push a stash (including untracked) and return the created stash commit SHA. */
export async function stashPushSha(gitPath: string, dir: string, message: string): Promise<string> {
  await run(gitPath, dir, ['stash', 'push', '-u', '-m', message], GIT_OP_TIMEOUT_MS)
  const sha = await revParse(gitPath, dir, 'stash@{0}')
  if (!sha) throw new Error(`stash push did not create an entry: ${message}`)
  return sha
}

/** Files captured by a stash commit. */
export async function stashFiles(gitPath: string, dir: string, sha: string): Promise<string[]> {
  const result = await tryRun(gitPath, dir, ['stash', 'show', '--name-only', sha])
  if (!result) return []
  return result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
}

export async function stashApplyBySha(gitPath: string, dir: string, sha: string): Promise<void> {
  await run(gitPath, dir, ['stash', 'apply', sha], GIT_OP_TIMEOUT_MS)
}

export async function stashShowBySha(gitPath: string, dir: string, sha: string): Promise<string> {
  const result = await tryRun(gitPath, dir, ['stash', 'show', '-p', sha])
  return result ? result.stdout : ''
}

/** Drop a stash by its commit SHA (locates the current reflog ref first). */
export async function stashDropBySha(gitPath: string, dir: string, sha: string): Promise<boolean> {
  const entry = (await stashListEntries(gitPath, dir)).find((item) => item.sha === sha)
  if (!entry) return false
  await run(gitPath, dir, ['stash', 'drop', entry.ref], GIT_OP_TIMEOUT_MS)
  return true
}

/** Whether `rev` can be resolved (MERGE_HEAD exists during a merge). */
export async function hasMergeHead(gitPath: string, dir: string): Promise<boolean> {
  return (await revParse(gitPath, dir, 'MERGE_HEAD')) !== null
}

/** Abort an in-progress merge; never throws (best effort). */
export async function mergeAbort(gitPath: string, dir: string, timeoutMs = GIT_OP_TIMEOUT_MS): Promise<boolean> {
  const result = await tryRun(gitPath, dir, ['merge', '--abort'])
  void timeoutMs
  return result !== null
}

/** Restore paths in the index and working tree to HEAD (discard local changes). */
export async function restorePaths(gitPath: string, dir: string, paths: string[]): Promise<void> {
  if (!paths.length) return
  await run(gitPath, dir, ['restore', '--staged', '--worktree', '--', ...paths], GIT_OP_TIMEOUT_MS)
}

export interface MergeTreeCheck {
  supported: boolean
  conflict: boolean
  files: string[]
  error?: string
}

function mergeTreeFiles(stdout: string, stderr: string): string[] {
  const files = new Set<string>()
  const firstBlock = stdout.split(/\r?\n\r?\n/)[0] || ''
  const lines = firstBlock.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  for (const line of lines.slice(1)) {
    if (/^[0-9a-f]{40,64}$/i.test(line)) continue
    if (/^(auto-merging|conflict|error)\b/i.test(line)) continue
    files.add(line)
  }
  const all = `${stdout}\n${stderr}`
  for (const match of all.matchAll(/Merge conflict in (.+)$/gm)) files.add(match[1].trim())
  for (const match of all.matchAll(/CONFLICT \([^)]*\):\s*(.+?)\s+(?:deleted|modified) in/gi)) files.add(match[1].trim())
  return [...files]
}

/** All values of a git config key (empty when unset). */
export async function gitConfigGetAll(gitPath: string, dir: string, key: string): Promise<string[]> {
  const r = await tryRun(gitPath, dir, ['config', '--get-all', key])
  if (!r) return []
  return r.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
}

export interface GitVersionInfo {  version: string
  major: number
  minor: number
  /** Whether `merge-tree --write-tree` (>= 2.38) is available. */
  mergeTreeSupported: boolean
}

/** Parse `git --version` once; used for a startup capability banner. */
export async function gitVersion(gitPath: string): Promise<GitVersionInfo | null> {
  const r = await tryRun(gitPath, process.cwd(), ['--version'])
  if (!r) return null
  const text = r.stdout.trim()
  const match = text.match(/(\d+)\.(\d+)(?:\.(\d+))?/)
  if (!match) return null
  const major = Number(match[1])
  const minor = Number(match[2])
  return {
    version: text.replace(/^git version\s+/i, ''),
    major,
    minor,
    mergeTreeSupported: major > 2 || (major === 2 && minor >= 38),
  }
}

/**
 * Dry-run a merge without touching either working tree.
 * Requires git >= 2.38 (`merge-tree --write-tree`); older versions report
 * `supported: false` so callers can fall back to an overlap-only warning.
 */
export function mergeTreeCheck(gitPath: string, dir: string, base: string, branch: string): Promise<MergeTreeCheck> {
  return new Promise((resolve) => {
    execFile(
      gitPath,
      ['-c', 'core.quotePath=false', 'merge-tree', '--write-tree', '--name-only', base, branch],
      { cwd: dir, env: GIT_ENV, windowsHide: true, maxBuffer: 16 * 1024 * 1024, timeout: GIT_OP_TIMEOUT_MS },
      (error, stdout, stderr) => {
        const out = String(stdout ?? '')
        const err = String(stderr ?? '')
        const text = `${err}\n${out}`.trim()
        if (!error) {
          resolve({ supported: true, conflict: false, files: [] })
          return
        }
        const code = typeof (error as any).code === 'number' ? (error as any).code : null
        const unsupported = /unknown option|usage:\s*git merge-tree|is not a git command/i.test(text) && code !== 1
        if (unsupported) {
          resolve({ supported: false, conflict: false, files: [], error: text })
          return
        }
        if (code === 1) {
          resolve({ supported: true, conflict: true, files: mergeTreeFiles(out, err) })
          return
        }
        resolve({ supported: true, conflict: false, files: [], error: text })
      },
    )
  })
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

export async function removeBranch(gitPath: string, repoDir: string, branch: string, force: boolean): Promise<void> {
  await run(gitPath, repoDir, ['branch', force ? '-D' : '-d', branch])
}

export interface RawDiffFile {
  path: string
  oldPath?: string
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  additions: number
  deletions: number
  binary: boolean
  patch: string
}

/** Drop the `a/` or `b/` prefix git adds to patch paths. */
function stripDiffPrefix(value: string, side: 'a' | 'b'): string {
  const prefix = side + '/'
  return (value.startsWith(prefix) ? value.slice(prefix.length) : value).replace(/\t$/, '')
}

/**
 * Diff `fromRef` against `toRef` (or the working tree when `toRef` is omitted)
 * and split the unified patch into per-file records. Paths are emitted
 * unquoted (core.quotePath=false) so non-ASCII filenames round-trip intact.
 */
export async function diffFiles(gitPath: string, dir: string, fromRef: string, toRef?: string): Promise<RawDiffFile[]> {
  const args = ['-c', 'core.quotePath=false', 'diff', '--no-color', '--no-ext-diff', '-M', fromRef]
  if (toRef) args.push(toRef)
  args.push('--')
  const r = await tryRun(gitPath, dir, args)
  if (!r) return []
  return parseUnifiedDiff(r.stdout)
}

/** Split `git diff` output into per-file blocks with add/remove counts. */
export function parseUnifiedDiff(text: string): RawDiffFile[] {
  const out: RawDiffFile[] = []
  const lines = text.split('\n')
  let cur: {
    patch: string[]
    oldHeader: string
    newHeader: string
    renameFrom: string
    renameTo: string
    added: boolean
    deleted: boolean
    binary: boolean
    binaryPath: string
    additions: number
    deletions: number
  } | null = null
  let inHunk = false

  const finalize = () => {
    if (!cur) return
    let path = cur.newHeader || cur.renameTo || cur.binaryPath || cur.oldHeader
    if (cur.deleted && cur.oldHeader) path = cur.oldHeader
    const oldPath = cur.renameFrom && cur.renameTo && cur.renameFrom !== cur.renameTo ? cur.renameFrom : undefined
    const status: RawDiffFile['status'] = cur.added ? 'added' : cur.deleted ? 'deleted' : oldPath ? 'renamed' : 'modified'
    if (path) {
      out.push({ path, oldPath, status, additions: cur.additions, deletions: cur.deletions, binary: cur.binary, patch: cur.patch.join('\n') })
    }
    cur = null
  }

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      finalize()
      cur = { patch: [line], oldHeader: '', newHeader: '', renameFrom: '', renameTo: '', added: false, deleted: false, binary: false, binaryPath: '', additions: 0, deletions: 0 }
      inHunk = false
      continue
    }
    if (!cur) continue
    cur.patch.push(line)
    // Inside a hunk every line is file content: only count it, never re-read headers.
    if (inHunk) {
      if (line.startsWith('+')) cur.additions += 1
      else if (line.startsWith('-')) cur.deletions += 1
      continue
    }
    if (line.startsWith('new file mode')) { cur.added = true; continue }
    if (line.startsWith('deleted file mode')) { cur.deleted = true; continue }
    if (line.startsWith('rename from ')) { cur.renameFrom = line.slice('rename from '.length); continue }
    if (line.startsWith('rename to ')) { cur.renameTo = line.slice('rename to '.length); continue }
    if (line.startsWith('--- ')) {
      const v = line.slice(4)
      if (v !== '/dev/null') cur.oldHeader = stripDiffPrefix(v, 'a')
      continue
    }
    if (line.startsWith('+++ ')) {
      const v = line.slice(4)
      if (v !== '/dev/null') cur.newHeader = stripDiffPrefix(v, 'b')
      continue
    }
    if (line.startsWith('Binary files ')) {
      cur.binary = true
      const body = line.slice('Binary files '.length).replace(/ differ$/, '')
      const [left = '', right = ''] = body.split(' and ')
      const leftPath = left.startsWith('/dev/null') ? '' : stripDiffPrefix(left, 'a')
      const rightPath = right.startsWith('/dev/null') ? '' : stripDiffPrefix(right, 'b')
      cur.binaryPath = rightPath || leftPath
      if (!cur.oldHeader && leftPath) cur.oldHeader = leftPath
      if (!cur.newHeader && rightPath) cur.newHeader = rightPath
      continue
    }
    if (line.startsWith('@@')) { inHunk = true; continue }
  }
  finalize()
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

export type InProgressKind = 'merge' | 'rebase' | 'cherry-pick' | 'revert'

/** Absolute path of this working tree's git dir (correct for linked worktrees). */
export async function absoluteGitDir(gitPath: string, dir: string): Promise<string | null> {
  const r = await tryRun(gitPath, dir, ['rev-parse', '--absolute-git-dir'])
  const out = r?.stdout.trim()
  return out ? out : null
}

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
