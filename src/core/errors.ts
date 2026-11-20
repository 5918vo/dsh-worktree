export type TaskErrorCode =
  | 'bad-token'
  | 'stale'
  | 'conflict'
  | 'repo-busy'
  | 'timeout'
  | 'agent-running'
  | 'agent-unknown'
  | 'pending-stash'
  | 'pending-op'
  | 'merge-committed'
  | 'dirty-blocks-switch'
  | 'stash-failed'
  | 'stash-missing'
  | 'stash-unverified'
  | 'stash-apply-conflict'
  | 'switch-failed'
  | 'precheck-unavailable'
  | 'hook-failed'
  | 'not-committed'
  | 'no-target'
  | string

export class TaskError extends Error {
  readonly status: number
  readonly code?: TaskErrorCode

  constructor(message: string, status = 400, code?: TaskErrorCode) {
    super(message)
    this.name = 'TaskError'
    this.status = status
    if (code) this.code = code
  }
}

/** 从 git 输出中提取去重后的冲突文件路径 */
export function extractConflictFiles(text: string): string[] {
  const files = new Set<string>()
  for (const match of text.matchAll(/Merge conflict in ([^\r\n]+)/g)) {
    files.add(match[1].trim())
  }
  for (const match of text.matchAll(/CONFLICT \([^)]*\):\s*(.+?)\s+(?:deleted|modified) in/gi)) {
    files.add(match[1].trim())
  }
  return [...files]
}
