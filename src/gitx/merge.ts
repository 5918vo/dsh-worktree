/**
 * Merge execution, abort, and dry-run merge-tree conflict checks.
 */

import { execFile } from 'node:child_process'
import { GIT_ENV, GIT_OP_TIMEOUT_MS, run, tryRun } from './exec.js'
import { revParse } from './history.js'

export async function mergeNoFF(gitPath: string, repoDir: string, branch: string, timeoutMs = GIT_OP_TIMEOUT_MS): Promise<void> {
  try {
    await run(gitPath, repoDir, ['merge', '--no-ff', '--no-edit', branch], timeoutMs)
  } catch (error) {
    // Undo a conflicted merge so the repo is not left mid-merge.
    await tryRun(gitPath, repoDir, ['merge', '--abort'])
    throw error
  }
}

/** Whether MERGE_HEAD exists during an in-progress merge. */
export async function hasMergeHead(gitPath: string, dir: string): Promise<boolean> {
  return (await revParse(gitPath, dir, 'MERGE_HEAD')) !== null
}

/** Abort an in-progress merge; never throws (best effort). */
export async function mergeAbort(gitPath: string, dir: string, timeoutMs = GIT_OP_TIMEOUT_MS): Promise<boolean> {
  const result = await tryRun(gitPath, dir, ['merge', '--abort'])
  void timeoutMs
  return result !== null
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
