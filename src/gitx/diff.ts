/**
 * Unified diff execution and per-file patch parsing.
 */

import { tryRun } from './exec.js'

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
