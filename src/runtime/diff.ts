/**
 * Per-task unified diff computation (including synthetic patches for untracked files).
 */

import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import * as gitx from '../gitx.js'
import { DiffFile, TaskDiff } from '../models.js'
import { needTask, RuntimeContext } from './types.js'

// Diff payloads travel through the board's JSON API; keep them bounded so a
// task touching a huge generated file cannot stall the review screen.
const DIFF_MAX_FILES = 300
const DIFF_MAX_FILE_CHARS = 60_000
const DIFF_MAX_TOTAL_CHARS = 300_000
const UNTRACKED_READ_BYTES = 256 * 1024

/** Render an untracked file as a synthetic "new file" unified diff. */
async function readUntrackedDiff(dir: string, rel: string): Promise<DiffFile | null> {
  const abs = join(dir, rel)
  let stat
  try {
    stat = await fs.stat(abs)
  } catch {
    return null
  }
  if (!stat.isFile()) return null
  let buf: Buffer
  let truncated = false
  try {
    const len = Math.min(stat.size, UNTRACKED_READ_BYTES)
    truncated = stat.size > len
    const handle = await fs.open(abs, 'r')
    try {
      const out = Buffer.alloc(len)
      await handle.read(out, 0, len, 0)
      buf = out
    } finally {
      await handle.close()
    }
  } catch {
    return null
  }
  const binary = buf.subarray(0, 8000).includes(0)
  if (binary) {
    return {
      path: rel,
      status: 'untracked',
      additions: 0,
      deletions: 0,
      binary: true,
      patch: `diff --git a/${rel} b/${rel}\nnew file mode 100644\nBinary files /dev/null and b/${rel} differ`,
    }
  }
  const text = buf.toString('utf8').replace(/\r\n/g, '\n')
  const lines = text.length ? text.replace(/\n$/, '').split('\n') : []
  const header = `diff --git a/${rel} b/${rel}\nnew file mode 100644\n--- /dev/null\n+++ b/${rel}\n@@ -0,0 +1,${lines.length} @@`
  const body = lines.map((line) => '+' + line).join('\n')
  return {
    path: rel,
    status: 'untracked',
    additions: lines.length,
    deletions: 0,
    binary: false,
    patch: header + (body ? '\n' + body : '') + (truncated ? '\n… (truncated)' : ''),
  }
}

/**
 * The task's changes against its base branch, as per-file unified diffs.
 * Reads the worktree when it still exists so uncommitted and untracked files
 * show up; falls back to the recorded branch (committed changes only) after
 * the worktree is gone.
 */
/** Shared truncation/sorting tail for every diff source. */
function finishDiff(result: TaskDiff, input: DiffFile[]): TaskDiff {
  let files = input.slice().sort((a, b) => a.path.localeCompare(b.path))
    if (files.length > DIFF_MAX_FILES) {
      files = files.slice(0, DIFF_MAX_FILES)
      result.truncated = true
    }
    let budget = DIFF_MAX_TOTAL_CHARS
    for (const file of files) {
      let patch = file.patch
      if (patch.length > DIFF_MAX_FILE_CHARS) {
        patch = patch.slice(0, DIFF_MAX_FILE_CHARS)
        result.truncated = true
      }
      if (patch.length > budget) {
        patch = patch.slice(0, budget)
        result.truncated = true
      }
      if (patch.length < file.patch.length) patch = patch + '\n… (truncated)'
      file.patch = patch
      budget = Math.max(0, budget - patch.length)
      result.totalAdditions += file.additions
      result.totalDeletions += file.deletions
    }
    result.files = files
  return result
}

export async function taskDiff(ctx: RuntimeContext, id: string): Promise<TaskDiff> {
  const task = needTask(ctx, id)
  const result: TaskDiff = { base: task.baseBranch, mergeBase: null, files: [], totalAdditions: 0, totalDeletions: 0, truncated: false }
  try {
    const wtExists = await fs.stat(task.worktreePath).then((s) => s.isDirectory()).catch(() => false)
    let dir: string
    let toRef: string | undefined
    let includeUntracked = false
    // A merged task's branch is contained in the base, so a branch-vs-base
    // diff is empty by definition. Show what the merge actually brought in.
    if (task.mergedAt && task.mergedCommit) {
      const mergeParent = await gitx.revParse(ctx.gitPath, task.repoPath, `${task.mergedCommit}^1`)
      if (mergeParent) {
        result.source = 'merge-commit'
        const raw = await gitx.diffFiles(ctx.gitPath, task.repoPath, mergeParent, task.mergedCommit)
        result.mergeBase = mergeParent
        return finishDiff(result, raw.map((file) => ({ ...file })))
      }
    }
    if (wtExists) {
      dir = task.worktreePath
      includeUntracked = true
    } else if (await gitx.branchExists(ctx.gitPath, task.repoPath, task.branch)) {
      dir = task.repoPath
      toRef = task.branch
    } else {
      result.reason = 'worktree-missing'
      return result
    }

    const mb = await gitx.mergeBase(ctx.gitPath, dir, task.baseBranch, toRef ?? 'HEAD')
    if (!mb) {
      result.reason = 'no-merge-base'
      return result
    }
    result.mergeBase = mb

    const raw = await gitx.diffFiles(ctx.gitPath, dir, mb, toRef)
    let files: DiffFile[] = raw.map((file) => ({ ...file }))
    if (includeUntracked) {
      for (const rel of await gitx.listUntracked(ctx.gitPath, dir)) {
        const file = await readUntrackedDiff(dir, rel)
        if (file) files.push(file)
      }
    }
    return finishDiff(result, files)
  } catch (error) {
    result.reason = 'error'
    result.error = error instanceof Error ? error.message : String(error)
  }
  return result
}
