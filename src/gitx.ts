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

  constructor(args: string[], stderr: string, exitCode: number | null) {
    super(`git ${args.join(' ')} failed: ${stderr.trim() || '(no stderr)'}`)
    this.name = 'GitError'
    this.args = args
    this.stderr = stderr
    this.exitCode = exitCode
  }
}

export interface GitRunResult {
  stdout: string
  stderr: string
}

function run(gitPath: string, cwd: string, args: string[], timeoutMs = 120_000): Promise<GitRunResult> {
  return new Promise((resolve, reject) => {
    execFile(
      gitPath,
      args,
      { cwd, windowsHide: true, maxBuffer: 16 * 1024 * 1024, timeout: timeoutMs },
      (error, stdout, stderr) => {
        if (error) {
          const code = typeof (error as any).code === 'number' ? (error as any).code : null
          // git writes merge/checkout diagnostics to stdout as well; without it
          // the UI only ever saw "Command failed".
          const detail = [String(stderr || ''), String(stdout || '')].filter((text) => text.trim()).join('\n')
          reject(new GitError(args, detail || error.message || '', code))
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

export async function worktreeAdd(gitPath: string, repoDir: string, worktreePath: string, newBranch: string, baseBranch: string): Promise<void> {
  await run(gitPath, repoDir, ['worktree', 'add', '-b', newBranch, worktreePath, baseBranch])
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
export async function switchBranch(gitPath: string, repoDir: string, branch: string): Promise<void> {
  try {
    await run(gitPath, repoDir, ['switch', branch])
  } catch (error) {
    const msg = error instanceof GitError ? error.stderr : String(error)
    if (/used by worktree|already checked out/i.test(msg)) {
      await run(gitPath, repoDir, ['switch', '--ignore-other-worktrees', branch])
      return
    }
    throw error
  }
}

export async function mergeNoFF(gitPath: string, repoDir: string, branch: string): Promise<void> {
  try {
    await run(gitPath, repoDir, ['merge', '--no-ff', '--no-edit', branch])
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

/** Resolve the merge-base of two revisions, or null when they share no history. */
export async function mergeBase(gitPath: string, dir: string, a: string, b: string): Promise<string | null> {
  const r = await tryRun(gitPath, dir, ['merge-base', a, b])
  const out = r?.stdout.trim()
  return out ? out.split('\n')[0]!.trim() : null
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
