/**
 * Low-level, Windows-safe git process execution and environment helpers.
 * All commands run through execFile with an args array (no shell quoting
 * pitfalls) and windowsHide.
 */

import { execFile } from 'node:child_process'

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
export const GIT_ENV = {
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

export function run(gitPath: string, cwd: string, args: string[], timeoutMs = 120_000): Promise<GitRunResult> {
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
export async function tryRun(gitPath: string, cwd: string, args: string[]): Promise<GitRunResult | null> {
  try {
    return await run(gitPath, cwd, args)
  } catch {
    return null
  }
}

/** All values of a git config key (empty when unset). */
export async function gitConfigGetAll(gitPath: string, dir: string, key: string): Promise<string[]> {
  const r = await tryRun(gitPath, dir, ['config', '--get-all', key])
  if (!r) return []
  return r.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
}

export interface GitVersionInfo {
  version: string
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
